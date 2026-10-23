// utils/stepTracker.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { DeviceEventEmitter } from "react-native";
import StepTracker from "react-native-step-tracker-pro";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
const QUEUE_KEY = "@taskcare360_step_queue_v1";
const TREADMILL_MODE_KEY = "@taskcare360_treadmill_mode";
const LAST_SYNCED_STEPS_KEY = "@taskcare360_last_synced_total";

let isInitialized = false;
let isFlushing = false;
let stepListener: any = null;

// ─── Queue Helpers ───────────────────────────────────────────
const readQueue = async (): Promise<any[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: any[]) => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

// ─── Flush Queue ─────────────────────────────────────────────
export const flushQueue = async () => {
  if (isFlushing) return;
  isFlushing = true;
  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return;
    const queue = await readQueue();
    if (queue.length === 0) return;
    const remaining = [];
    for (const evt of queue) {
      try {
        const res = await fetch(`${API_BASE}/steps/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(evt),
        });
        if (!res.ok && res.status !== 400) remaining.push(evt);
      } catch {
        remaining.push(evt);
      }
    }
    await writeQueue(remaining);
    if (remaining.length === 0) DeviceEventEmitter.emit("SYNC_COMPLETED");
  } finally {
    isFlushing = false;
  }
};

// ─── Process Steps (same logic as before, but totalToday comes from StepTracker) ───
const processNewSteps = async (totalToday: number) => {
  const lastSyncedRaw = await AsyncStorage.getItem(LAST_SYNCED_STEPS_KEY);
  if (lastSyncedRaw === null) {
    await AsyncStorage.setItem(LAST_SYNCED_STEPS_KEY, totalToday.toString());
    return;
  }
  const lastSynced = parseInt(lastSyncedRaw, 10);
  const delta = totalToday - lastSynced;
  if (delta <= 0) {
    if (delta < 0)
      await AsyncStorage.setItem(LAST_SYNCED_STEPS_KEY, totalToday.toString());
    return;
  }
  await AsyncStorage.setItem(LAST_SYNCED_STEPS_KEY, totalToday.toString());
  const isTreadmill = JSON.parse(
    (await AsyncStorage.getItem(TREADMILL_MODE_KEY)) || "false",
  );
  const mode = isTreadmill ? "treadmill" : "walking";
  const queue = await readQueue();
  queue.push({
    event_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    delta: delta,
    mode: mode,
  });
  await writeQueue(queue);
  DeviceEventEmitter.emit("REALTIME_STEP_TAKEN", { delta, mode });
  flushQueue();
};

// ─── Initialize Step Tracker (using react-native-step-tracker-pro) ───
export const initStepTracker = async () => {
  if (isInitialized) return;
  isInitialized = true;

  try {
    // 1. Initialize with user's body data (for distance/calorie calculation)
    // You can replace these with actual user data if available
    await StepTracker.initialize({
      height: 175,
      weight: 75,
      dailyGoal: 5000,
      historyRetentionDays: 31,
      notificationTitle: "{steps} steps today",
      healthConnectEnabled: false, // We don't use Health Connect as source
    });

    // 2. Request necessary permissions
    const permissions = await StepTracker.requestPermissions();
    if (!permissions) {
      console.log("❌ Step tracker permissions denied.");
      isInitialized = false;
      return;
    }

    // 3. Start tracking (foreground service starts)
    await StepTracker.startTracking();
    console.log("✅ StepTracker started.");

    // 4. Listen for step changes
    stepListener = StepTracker.addListener("stepsChanged", async (data) => {
      if (data.steps > 0) {
        await processNewSteps(data.steps);
      }
    });

    // 5. Initial read
    const todaySteps = await StepTracker.getTodaySteps();
    if (todaySteps > 0) {
      await processNewSteps(todaySteps);
    }

    // 6. Handle OEM battery optimization (critical for vivo)
    const batteryOptEnabled = await StepTracker.isBatteryOptimizationEnabled();
    if (batteryOptEnabled) {
      await StepTracker.requestDisableBatteryOptimization();
    }

    // 7. Flush any queued steps
    await flushQueue();
  } catch (e) {
    console.log("Init StepTracker Error:", e);
    isInitialized = false;
  }
};

// ─── Stop Tracker ────────────────────────────────────────────
export const stopStepTracker = async () => {
  if (stepListener) {
    stepListener.remove();
    stepListener = null;
  }
  isInitialized = false;
};

// ─── Public Getters (required by steps.tsx) ─────────────────
export const getPendingQueue = readQueue;
export const getQueueSize = async (): Promise<number> =>
  (await readQueue()).length;

// Recover missed steps by reading current total from StepTracker
export const recoverMissedSteps = async () => {
  try {
    const todaySteps = await StepTracker.getTodaySteps();
    if (todaySteps > 0) {
      await processNewSteps(todaySteps);
    }
  } catch (e) {
    console.log("recoverMissedSteps error:", e);
  }
};

export const requestNotificationPermission = async () => {
  // StepTracker.requestPermissions() already handles notification permission
  // This is a no-op placeholder
};
