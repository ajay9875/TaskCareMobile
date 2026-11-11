// utils/stepTracker.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as BackgroundFetch from "expo-background-fetch";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import {
  PermissionStatus,
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

import StepTracker from "react-native-step-tracker-pro";

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
const FOREGROUND_POLL_MS = 30000;
const FETCH_TIMEOUT_MS = 20000;
const MAX_BATCH_SIZE = 50;
const RETRY_INTERVAL_MS = 30000;
const RECONCILE_MIN_INTERVAL_MS = 60_000;

// ─── Module state ────────────────────────────────────────────
let isFlushing = false;
let isRecovering = false;
let debounceTimer: any = null;
let retryTimer: any = null;
let netListenerAttached = false;
let appStateListenerAttached = false;
let initialized = false;
let foregroundPollTimer: any = null;
let isCheckingNotificationPermission = false;
let backgroundTaskRegistered = false;
let backgroundFetchRegistered = false;
let lastReconcileTime = 0;

// ─── Types ───────────────────────────────────────────────────
export type StepEvent = {
  event_id: string;
  delta: number;
  mode: "walking" | "treadmill";
  created_at: number;
};

// ─── Token helper (exported for login.tsx) ──────────────────
export const getNativeSyncToken = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${API_BASE}/steps/native-token`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token || null;
  } catch (e) {
    console.log("[stepTracker] getNativeSyncToken failed:", e);
    return null;
  }
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
let lastEnqueuedDelta = 0;
let lastEnqueuedTime = 0;

export const enqueueSteps = async (
  delta: number,
  mode: "walking" | "treadmill",
) => {
  if (!delta || delta <= 0) return;

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

// ─── Flush queue (JS foreground → /api/steps/sync) ─────────
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

// ─── Read pedometer delta (THE SOURCE OF TRUTH) ────────────
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
      return { delta: 0, current: todaySteps };
    }

    const lastSyncedRaw = await AsyncStorage.getItem(LAST_SYNCED_COUNT_KEY);
    const lastSynced = lastSyncedRaw ? parseInt(lastSyncedRaw, 10) : 0;
    const delta = todaySteps - lastSynced;

    if (delta < 0) {
      await AsyncStorage.setItem(LAST_SYNCED_COUNT_KEY, todaySteps.toString());
      return { delta: 0, current: todaySteps };
    }

    if (delta > 0) {
      await AsyncStorage.setItem(LAST_SYNCED_COUNT_KEY, todaySteps.toString());
    }

    return { delta, current: todaySteps };
  } catch (e) {
    return null;
  }
};

// ─── Reconcile (ONLY pulls server if it's AHEAD of pedometer) ──
const reconcileBaselineFromServer = async (): Promise<void> => {
  const now = Date.now();
  if (now - lastReconcileTime < RECONCILE_MIN_INTERVAL_MS) {
    return;
  }
  lastReconcileTime = now;

  try {
    const res = await fetch(`${API_BASE}/steps/data?mode=walking`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) return;

    const data = await res.json();
    const serverTotal = (data.walking_steps || 0) + (data.treadmill_steps || 0);

    const todaySteps = await getTodayStepCountAsync();
    const lastSyncedRaw = await AsyncStorage.getItem(LAST_SYNCED_COUNT_KEY);
    const lastSyncedLocal = lastSyncedRaw ? parseInt(lastSyncedRaw, 10) : 0;

    // ✅ Reconcile when the server has already recorded these steps.
    //    Use Math.max to also catch the case where server == pedometer
    //    (native tracker reported the same physical steps).
    const targetBaseline = Math.max(serverTotal, todaySteps);
    if (targetBaseline > lastSyncedLocal) {
      await AsyncStorage.setItem(LAST_SYNCED_COUNT_KEY, targetBaseline.toString());
      console.log(
        `[stepTracker] Reconciled baseline upward: ${lastSyncedLocal} → ${targetBaseline} (server=${serverTotal}, pedometer=${todaySteps})`,
      );
    }
    // Do NOTHING otherwise — let readPedometerDelta compute real deltas
  } catch (e) {
    console.log("[stepTracker] reconcileBaselineFromServer failed:", e);
  }
};

// ─── Recover missed steps (THE KEY FUNCTION) ────────────────
export const recoverMissedSteps = async () => {
  if (isRecovering) return;
  isRecovering = true;

  try {
    // Step 1: Check if the server is AHEAD of the pedometer (native sync ran)
    await reconcileBaselineFromServer();

    // Step 2: Read pedometer delta from the (possibly updated) baseline
    const result = await readPedometerDelta();
    if (!result || result.delta <= 0) return;

    // Step 3: Enqueue the delta
    const mode = await readActiveMode();
    await enqueueSteps(result.delta, mode);

    // Step 4: Update notification title
    try {
      await StepTracker.updateConfig({
        notificationTitle: "👑 Hit: {steps} of {goal} steps!",
      });
    } catch (e) {}

    // Step 5: Emit event so steps.tsx updates the UI INSTANTLY
    DeviceEventEmitter.emit("REALTIME_STEP_TAKEN", {
      delta: result.delta,
      mode,
    });

    // Step 6: Flush queue (JS-side sync)
    await flushQueue();
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
      "FitWisely needs notification permission to keep step tracking running in the background.\n\n" +
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

// ─── Background tasks ────────────────────────────────────────
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
      // Reset throttle so a fresh reconcile runs on every resume
      lastReconcileTime = 0;
      await recoverMissedSteps();
      await flushQueue();
      startForegroundPoll();
    } else if (next === "background" || next === "inactive") {
      stopForegroundPoll();
      await flushQueue().catch(() => {});
      // Trigger native sync immediately instead of waiting 1h
      try {
        await StepTracker.syncNow();
      } catch (e) {
        console.log("[stepTracker] syncNow failed:", e);
      }
    }
  });
};

const ensureBackgroundStepTracking = async () => {
  if (backgroundTaskRegistered) return;

  try {
    const bgAvailable = await isBackgroundAvailableAsync();
    if (!bgAvailable) return;

    const existing = await getPermissionsAsync();
    if (existing.status !== PermissionStatus.GRANTED) {
      await requestPermissionsAsync();
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    await requestBackgroundPermissionsAsync();

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

// ─── Init live notification tracker (WITH REMOTE SYNC) ─────
const initLiveNotificationTracker = async () => {
  try {
    const cachedTarget = await AsyncStorage.getItem(
      "@taskcare360_cached_target",
    );
    const target = cachedTarget ? parseInt(cachedTarget, 10) : 5000;

    // Fetch native sync token BEFORE init
    const nativeToken = await getNativeSyncToken();

    await StepTracker.initialize({
      height: 175,
      weight: 75,
      dailyGoal: target,
      historyRetentionDays: 31,
      notificationTitle: "👑 Hit: {steps} of {goal} steps!",

      // Remote sync configuration
      remoteSyncUrl: `${API_BASE}/steps/sync/native`,
      remoteSyncHeaders: nativeToken
        ? { Authorization: `Bearer ${nativeToken}` }
        : {},
      remoteSyncAuth: "headers",
      remoteSyncPayload: "totals",

      healthConnectEnabled: false,
    });

    const permissions = await StepTracker.requestPermissions();
    if (permissions && permissions.allGranted) {
      await StepTracker.startTracking();

      await StepTracker.updateConfig({
        notificationTitle: "👑 Hit: {steps} of {goal} steps!",
      });

      // Auto-recover from auth failures
      try {
        StepTracker.addListener("syncAuthFailed", async () => {
          console.log("[stepTracker] syncAuthFailed, refreshing token");
          const freshToken = await getNativeSyncToken();
          if (freshToken) {
            await StepTracker.updateConfig({
              remoteSyncHeaders: { Authorization: `Bearer ${freshToken}` },
            });
            await StepTracker.syncNow();
          }
        });
      } catch (e) {
        console.log("[stepTracker] Could not attach syncAuthFailed:", e);
      }
    }
  } catch (e) {
    console.log("Live Notification Tracker Init Error:", e);
  }
};

// ─── Public helpers ─────────────────────────────────────────
export const updateNativeTarget = async (newTarget: number) => {
  try {
    await StepTracker.updateConfig({
      dailyGoal: newTarget,
      notificationTitle: "👑 Hit: {steps} of {goal} steps!",
    });
  } catch (e) {
    console.log("Failed to update native target:", e);
  }
};

export const forceUpdateNotificationTarget = async () => {
  const cachedTarget = await AsyncStorage.getItem("@taskcare360_cached_target");
  const target = cachedTarget ? parseInt(cachedTarget, 10) : 5000;
  await updateNativeTarget(target);
};

export const initStepTracker = async () => {
  if (initialized) return;
  initialized = true;

  if (!Device.isDevice) {
    return;
  }

  await handleNotificationPermission();
  attachNetworkListener();
  attachAppStateListener();

  await ensureBackgroundStepTracking();
  await ensureBackgroundFetch();

  await initLiveNotificationTracker();

  await recoverMissedSteps();
  await flushQueue();

  startForegroundPoll();
};

export const requestNotificationPermission = async () => {
  await handleNotificationPermission();
};

export const stopStepTracker = async () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  stopRetryTimer();
  stopForegroundPoll();

  try {
    await StepTracker.stopTracking();
  } catch (e) {}

  initialized = false;
};

export const getPendingQueue = readQueue;
export const getQueueSize = async (): Promise<number> =>
  (await readQueue()).length;
   