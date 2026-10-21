// utils/stepTracker.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as BackgroundFetch from "expo-background-fetch";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import {
  PermissionStatus, // ✅ Add this
  getPermissionsAsync,
  getTodayStepCountAsync,
  isAvailableAsync,
  isBackgroundAvailableAsync,
  requestBackgroundPermissionsAsync,
  requestPermissionsAsync,
  startStepCountUpdatesAsync,
  type StepCountTaskData,
} from "expo-pedometer";
import * as TaskManager from "expo-task-manager";
import {
  Alert,
  AppState,
  DeviceEventEmitter,
  Linking,
  Platform,
} from "react-native";

// ─── Constants ───────────────────────────────────────────────
const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

const QUEUE_KEY = "@taskcare360_step_queue_v1";
const BASELINE_COUNT_KEY = "@taskcare360_baseline_count";
const BASELINE_DATE_KEY = "@taskcare360_baseline_date";
const LAST_SYNCED_COUNT_KEY = "@taskcare360_last_synced_count";
const LAST_SYNCED_DATE_KEY = "@taskcare360_last_synced_date";
const LAST_TIMESTAMP_KEY = "@taskcare360_last_sync_time";
const TREADMILL_MODE_KEY = "@taskcare360_treadmill_mode";

const STEP_COUNT_TASK = "taskcare360-step-count-task";
const BACKGROUND_FETCH_TASK = "taskcare360-background-fetch";

const SYNC_DEBOUNCE_MS = 2000;
const FOREGROUND_POLL_MS = 3000;
const FETCH_TIMEOUT_MS = 20000;
const MAX_BATCH_SIZE = 50;
const RETRY_INTERVAL_MS = 30000;

// ─── Module state ────────────────────────────────────────────
let isFlushing = false;
let isRecovering = false; // ✅ NEW: Prevents step doubling from race conditions
let debounceTimer: any = null;
let retryTimer: any = null;
let netListenerAttached = false;
let appStateListenerAttached = false;
let initialized = false;
let foregroundPollTimer: any = null;
let isCheckingNotificationPermission = false;
let backgroundTaskRegistered = false;
let backgroundFetchRegistered = false;

// ─── Types ───────────────────────────────────────────────────
export type StepEvent = {
  event_id: string;
  delta: number;
  mode: "walking" | "treadmill";
  created_at: number;
};

// ─── Queue helpers ───────────────────────────────────────────
const readQueue = async (): Promise<StepEvent[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: StepEvent[]) => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

const makeEventId = (): string => {
  const rand = Math.random().toString(36).slice(2, 11);
  const rand2 = Math.random().toString(36).slice(2, 11);
  return `${Date.now()}-${rand}-${rand2}`;
};

const getTodayKey = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const readActiveMode = async (): Promise<"walking" | "treadmill"> => {
  try {
    const raw = await AsyncStorage.getItem(TREADMILL_MODE_KEY);
    if (raw === null) return "walking";
    return JSON.parse(raw) === true ? "treadmill" : "walking";
  } catch {
    return "walking";
  }
};

// ─── Enqueue steps ───────────────────────────────────────────
// ✅ 1. Add this variable at the top of stepTracker.ts
let lastEnqueuedDelta = 0;
let lastEnqueuedTime = 0;

// ✅ 2. Update enqueueSteps to prevent double-queueing
export const enqueueSteps = async (
  delta: number,
  mode: "walking" | "treadmill",
) => {
  if (!delta || delta <= 0) return;

  // Prevent duplicate enqueueing within 2 seconds
  const now = Date.now();
  if (delta === lastEnqueuedDelta && now - lastEnqueuedTime < 2000) {
    console.log(`[stepTracker] Blocked duplicate enqueue of ${delta} steps`);
    return;
  }
  lastEnqueuedDelta = delta;
  lastEnqueuedTime = now;

  const queue = await readQueue();
  queue.push({
    event_id: makeEventId(),
    delta: Math.floor(delta),
    mode,
    created_at: Date.now(),
  });
  await writeQueue(queue);
  flushQueue();
};

// ─── Flush queue ─────────────────────────────────────────────
export const flushQueue = async () => {
  if (isFlushing) return;
  isFlushing = true;

  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected || net.isInternetReachable === false) {
      return;
    }

    const queue = await readQueue();
    if (queue.length === 0) return;

    const batch = queue.slice(0, MAX_BATCH_SIZE);
    const remaining: StepEvent[] = [];

    for (let i = 0; i < batch.length; i++) {
      const evt = batch[i];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          FETCH_TIMEOUT_MS,
        );

        const res = await fetch(`${API_BASE}/steps/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            delta: evt.delta,
            mode: evt.mode,
            event_id: evt.event_id,
          }),
        });

        clearTimeout(timeoutId);

        if (res.ok) continue;

        if (res.status === 401) {
          remaining.push(
            evt,
            ...batch.slice(i + 1),
            ...queue.slice(MAX_BATCH_SIZE),
          );
          break;
        }

        if (res.status >= 400 && res.status < 500) {
          console.warn("[stepTracker] Dropping bad event", res.status, evt);
          continue;
        }

        remaining.push(
          evt,
          ...batch.slice(i + 1),
          ...queue.slice(MAX_BATCH_SIZE),
        );
        break;
      } catch (err) {
        remaining.push(
          evt,
          ...batch.slice(i + 1),
          ...queue.slice(MAX_BATCH_SIZE),
        );
        break;
      }
    }

    await writeQueue(remaining);

    if (remaining.length === 0) {
      await AsyncStorage.setItem(LAST_TIMESTAMP_KEY, Date.now().toString());
      DeviceEventEmitter.emit("SYNC_COMPLETED");
      stopRetryTimer();
    } else {
      startRetryTimer();
    }
  } finally {
    isFlushing = false;
  }
};

const startRetryTimer = () => {
  if (retryTimer) return;
  retryTimer = setInterval(() => {
    flushQueue().catch(() => {});
  }, RETRY_INTERVAL_MS);
};

const stopRetryTimer = () => {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
};

export const scheduleFlush = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    flushQueue();
  }, SYNC_DEBOUNCE_MS);
};

// ─── Core: read pedometer and compute a delta ────────────────
const readPedometerDelta = async (): Promise<{
  delta: number;
  current: number;
} | null> => {
  try {
    const available = await isAvailableAsync();
    if (!available) return null;

    const todayKey = getTodayKey();
    const storedBaselineDate = await AsyncStorage.getItem(BASELINE_DATE_KEY);
    const isNewDay = storedBaselineDate !== todayKey;

    const todaySteps = await getTodayStepCountAsync();

    if (isNewDay) {
      await AsyncStorage.setItem(BASELINE_DATE_KEY, todayKey);
      await AsyncStorage.setItem(BASELINE_COUNT_KEY, todaySteps.toString());
      await AsyncStorage.setItem(LAST_SYNCED_DATE_KEY, todayKey);
      await AsyncStorage.setItem(LAST_SYNCED_COUNT_KEY, todaySteps.toString());
      console.log(
        `[stepTracker] New day ${todayKey} — baseline anchored at ${todaySteps}`,
      );
      return { delta: 0, current: todaySteps };
    }

    const lastSyncedRaw = await AsyncStorage.getItem(LAST_SYNCED_COUNT_KEY);
    const lastSynced = lastSyncedRaw ? parseInt(lastSyncedRaw, 10) : 0;
    const delta = todaySteps - lastSynced;

    if (delta > 0) {
      await AsyncStorage.setItem(LAST_SYNCED_COUNT_KEY, todaySteps.toString());
    }

    return { delta: Math.max(0, delta), current: todaySteps };
  } catch (e) {
    console.log("[stepTracker] readPedometerDelta error:", e);
    return null;
  }
};

// ─── Recover missed steps ────────────────────────────────────
// ✅ 3. Update recoverMissedSteps to update Last Synced Count BEFORE enqueueing
export const recoverMissedSteps = async () => {
  if (isRecovering) return;
  isRecovering = true;

  try {
    const result = await readPedometerDelta();
    if (!result || result.delta <= 0) return;

    // Note: readPedometerDelta already updates LAST_SYNCED_COUNT_KEY
    // But we need to make sure the lock prevents this from running twice.

    const mode = await readActiveMode();
    await enqueueSteps(result.delta, mode);

    DeviceEventEmitter.emit("REALTIME_STEP_TAKEN", {
      delta: result.delta,
      mode,
    });

    try {
      const userTargetRaw = await AsyncStorage.getItem(
        "@taskcare360_cached_target",
      );
      const userTarget = userTargetRaw ? parseInt(userTargetRaw, 10) : 5000;
      //await checkMilestones(result.current, userTarget, mode === "treadmill");
    } catch (e) {
      console.log("[stepTracker] milestone check error:", e);
    }

    scheduleFlush();
  } finally {
    isRecovering = false;
  }
};

// ─── Notification permission ─────────────────────────────────
const handleNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== "android" || Platform.Version < 33) return true;
  if (isCheckingNotificationPermission) return false;
  isCheckingNotificationPermission = true;

  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === "granted") {
      isCheckingNotificationPermission = false;
      return true;
    }

    if (existing.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      if (requested.status === "granted") {
        isCheckingNotificationPermission = false;
        return true;
      }
      const updated = await Notifications.getPermissionsAsync();
      if (!updated.canAskAgain) {
        // fall through
      } else {
        isCheckingNotificationPermission = false;
        return false;
      }
    }

    Alert.alert(
      "Notification Permission Required",
      "TaskCare 360 needs notification permission to keep step tracking running in the background.\n\n" +
        "How to enable:\n1. Tap 'Open Settings' below.\n2. Select 'Notifications'.\n3. Choose 'Allow'.",
      [
        {
          text: "Open Settings",
          onPress: async () => {
            isCheckingNotificationPermission = false;
            await Linking.openSettings();
          },
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            isCheckingNotificationPermission = false;
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          isCheckingNotificationPermission = false;
        },
      },
    );
    return false;
  } catch (e) {
    console.log("[stepTracker] Notification permission error:", e);
    isCheckingNotificationPermission = false;
    return false;
  }
};

// ─── Background task (pedometer) ─────────────────────────────
try {
  TaskManager.defineTask<StepCountTaskData>(
    STEP_COUNT_TASK,
    async ({ error }) => {
      if (error) {
        console.error("[stepTracker] Step count task error:", error);
        return;
      }
      try {
        await recoverMissedSteps();
        await flushQueue();
      } catch (e) {
        console.log("[stepTracker] Background task error:", e);
      }
    },
  );
} catch (e) {
  console.log("[stepTracker] defineTask failed:", e);
}

// ─── Background fetch task ───────────────────────────────────
try {
  TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
    try {
      await recoverMissedSteps();
      await flushQueue();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (e) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch (e) {
  console.log("[stepTracker] background-fetch defineTask failed:", e);
}

// ─── Register background fetch task ─────────────────────────
const ensureBackgroundFetch = async () => {
  if (backgroundFetchRegistered) return;

  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }

    const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_FETCH_TASK,
    );
    if (!alreadyRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 20 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
    backgroundFetchRegistered = true;
  } catch (e) {
    console.log("[stepTracker] ensureBackgroundFetch failed:", e);
  }
};

// ─── Foreground poll ─────────────────────────────────────────
const startForegroundPoll = () => {
  if (foregroundPollTimer) clearInterval(foregroundPollTimer);
  foregroundPollTimer = setInterval(async () => {
    await recoverMissedSteps();
  }, FOREGROUND_POLL_MS);
};

const stopForegroundPoll = () => {
  if (foregroundPollTimer) {
    clearInterval(foregroundPollTimer);
    foregroundPollTimer = null;
  }
};

// ─── Listeners ───────────────────────────────────────────────
const attachNetworkListener = () => {
  if (netListenerAttached) return;
  netListenerAttached = true;

  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      flushQueue();
      recoverMissedSteps().catch(() => {});
    }
  });
};

const attachAppStateListener = () => {
  if (appStateListenerAttached) return;
  appStateListenerAttached = true;

  AppState.addEventListener("change", async (next) => {
    if (next === "active") {
      await recoverMissedSteps();
      await flushQueue();
      startForegroundPoll();
    } else if (next === "background" || next === "inactive") {
      stopForegroundPoll();
      //await recoverMissedSteps().catch(() => {});
      await flushQueue().catch(() => {});
    }
  });
};

// 2. Update this function to include the physical activity check
const ensureBackgroundStepTracking = async () => {
  if (backgroundTaskRegistered) return;

  try {
    const bgAvailable = await isBackgroundAvailableAsync();
    if (!bgAvailable) return;

    // ✅ Request Background Health Connect Permission
    await requestBackgroundPermissionsAsync();

    // ✅ Request Foreground Physical Activity Permission (if not already granted)
    const existing = await getPermissionsAsync();
    if (existing.status !== PermissionStatus.GRANTED) {
      await requestPermissionsAsync();
    }

    const alreadyRegistered =
      await TaskManager.isTaskRegisteredAsync(STEP_COUNT_TASK);
    if (!alreadyRegistered) {
      await startStepCountUpdatesAsync(STEP_COUNT_TASK);
    }
    backgroundTaskRegistered = true;
  } catch (e) {
    console.log("[stepTracker] ensureBackgroundStepTracking failed:", e);
  }
};

// 3. Update initStepTracker to include notification permission
export const initStepTracker = async () => {
  if (initialized) return;
  initialized = true;

  if (!Device.isDevice) {
    return;
  }

  // ✅ Request Notification Permission First
  await handleNotificationPermission();

  attachNetworkListener();
  attachAppStateListener();

  // ✅ This now triggers BOTH Physical Activity and Health Connect prompts
  await ensureBackgroundStepTracking();

  await ensureBackgroundFetch();

  await recoverMissedSteps();
  await flushQueue();

  startForegroundPoll();
};

// ✅ ADD THIS NEW EXPORT at the bottom of the file
export const requestNotificationPermission = async () => {
  await handleNotificationPermission();
};

// ─── Logout hook ─────────────────────────────────────────────
export const stopStepTracker = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  stopRetryTimer();
  stopForegroundPoll();
  initialized = false;
};

// ─── Public getters ──────────────────────────────────────────
export const getPendingQueue = readQueue;
export const getQueueSize = async (): Promise<number> =>
  (await readQueue()).length;
