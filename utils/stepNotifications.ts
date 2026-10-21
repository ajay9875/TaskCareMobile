// utils/stepNotifications.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const HALF_GOAL_NOTIFIED_KEY = "@taskcare360_half_goal_notified";
const FULL_GOAL_NOTIFIED_KEY = "@taskcare360_full_goal_notified";
const NOTIFIED_DATE_KEY = "@taskcare360_notified_date";
const PERIODIC_ID_KEY = "@taskcare360_periodic_notif_id";

//const PERIODIC_INTERVAL_SECONDS = 2 * 60 * 60; // 2 hours
const PERIODIC_INTERVAL_SECONDS = 60; // 1 minute — TEMPORARY

// Quiet hours: no notifications between 00:00 and 06:00 (local time)
const QUIET_HOUR_START = 0; // 12 AM
const QUIET_HOUR_END = 6; // 6 AM

// ─── Configure how notifications appear when the app is foregrounded ───
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Today key ───────────────────────────────────────────────
const getTodayKey = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// ─── Quiet hours check ───────────────────────────────────────
// Returns true if the current local hour is between 12 AM and 6 AM.
const isQuietHour = (): boolean => {
  const hour = new Date().getHours();
  return hour >= QUIET_HOUR_START && hour < QUIET_HOUR_END;
};

// ─── Compute the next 6 AM timestamp for delayed notifications ───
// If we're currently inside quiet hours, this returns the epoch ms
// of today's 6 AM (or tomorrow's if 6 AM has passed).
const nextAllowedTime = (): Date => {
  const now = new Date();
  const target = new Date(now);
  target.setHours(QUIET_HOUR_END, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
};

// ─── Pick a message based on progress ────────────────────────
// utils/stepNotifications.ts
// Update ONLY the pickMessage function. Leave the rest of the file untouched.

const pickMessage = (
  current: number,
  target: number,
  isTreadmill: boolean,
): { title: string; body: string } => {
  if (target <= 0) {
    return {
      title: "🎯 Daily Step Target",
      body: "Target step goal is not set.",
    };
  }

  const safeCurrent = Math.max(0, current);
  const remaining = Math.max(0, target - safeCurrent);
  const percent = Math.min(100, Math.floor((safeCurrent / target) * 100));

  // ✅ Generate a clean visual progress bar (10 blocks)
  const filledBlocks = Math.floor(percent / 10);
  const bar = "▰".repeat(filledBlocks) + "▱".repeat(10 - filledBlocks);
  const progressLine = `[${bar}] ${percent}%`;

  // 1. Starting / Zero steps
  if (safeCurrent === 0 || percent < 1) {
    return {
      title: "🚦 Time to move",
      body: `${progressLine}\nZero steps logged so far. Start your journey to a ${target.toLocaleString()} target!`,
    };
  }

  // 2. Early Progress (1% - 24%)
  if (percent < 25) {
    return {
      title: "🎯 On the board",
      body: `${progressLine}\n${safeCurrent.toLocaleString()} steps secured. Only ${remaining.toLocaleString()} left to hit your ${target.toLocaleString()} target.`,
    };
  }

  // 3. Quarter Mark (25% - 49%)
  if (percent < 50) {
    return {
      title: "📈 Picking up speed",
      body: `${progressLine}\n${safeCurrent.toLocaleString()} steps conquered. Just ${remaining.toLocaleString()} more to reach the ${target.toLocaleString()} target.`,
    };
  }

  // 4. Halfway Mark (50% - 74%)
  if (percent < 75) {
    return {
      title: "🏅 Over the hump",
      body: `${progressLine}\nYou've crossed the halfway line at ${safeCurrent.toLocaleString()} steps. ${remaining.toLocaleString()} steps to go for ${target.toLocaleString()}.`,
    };
  }

  // 5. Almost There (75% - 99%)
  if (percent < 100) {
    return {
      title: "⚡ Home stretch",
      body: `${progressLine}\n${safeCurrent.toLocaleString()} steps locked in. Only ${remaining.toLocaleString()} steps away from your ${target.toLocaleString()} target!`,
    };
  }

  // 6. Goal Achieved / Exceeded (100%+)
  const extra = safeCurrent - target;
  const exceededText = extra > 0 ? ` (+${extra.toLocaleString()} extra)` : "";

  return {
    title: "🏆 Target conquered!",
    body: `${progressLine}\nTotal victory! You logged ${safeCurrent.toLocaleString()} steps today${exceededText}, beating your ${target.toLocaleString()} target.`,
  };
};

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "TaskCare 360",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: "default",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    enableVibrate: true,
    enableLights: true,
  });
}

// ─── Send a progress notification, respecting quiet hours ────
export const sendProgressNotification = async (
  current: number,
  target: number,
  isTreadmill: boolean,
) => {
  try {
    const { title, body } = pickMessage(current, target, isTreadmill);

    if (isQuietHour()) {
      // Defer to 6 AM
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, data: { screen: "steps" } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nextAllowedTime(),
        },
      });
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, data: { screen: "steps" } },
      trigger: null, // immediate
    });
  } catch (e) {
    console.log("[stepNotifications] sendProgressNotification error:", e);
  }
};

// ─── Milestone check: 50% and 100% ───────────────────────────
export const checkMilestones = async (
  current: number,
  target: number,
  isTreadmill: boolean,
) => {
  try {
    const todayKey = getTodayKey();
    const storedDate = await AsyncStorage.getItem(NOTIFIED_DATE_KEY);
    if (storedDate !== todayKey) {
      await AsyncStorage.setItem(NOTIFIED_DATE_KEY, todayKey);
      await AsyncStorage.removeItem(HALF_GOAL_NOTIFIED_KEY);
      await AsyncStorage.removeItem(FULL_GOAL_NOTIFIED_KEY);
    }

    const percent = target > 0 ? (current / target) * 100 : 0;

    const halfNotified =
      (await AsyncStorage.getItem(HALF_GOAL_NOTIFIED_KEY)) === "true";
    const fullNotified =
      (await AsyncStorage.getItem(FULL_GOAL_NOTIFIED_KEY)) === "true";

    const schedule = async (title: string, body: string) => {
      if (isQuietHour()) {
        await Notifications.scheduleNotificationAsync({
          content: { title, body, sound: true, data: { screen: "steps" } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: nextAllowedTime(),
          },
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: { title, body, sound: true, data: { screen: "steps" } },
          trigger: null,
        });
      }
    };

    if (percent >= 50 && !halfNotified) {
      await AsyncStorage.setItem(HALF_GOAL_NOTIFIED_KEY, "true");
      const remaining = Math.max(0, target - current);
      await schedule(
        "🏃 Halfway there!",
        `${current.toLocaleString()} / ${target.toLocaleString()} steps. Only ${remaining.toLocaleString()} left — finish strong!`,
      );
    }

    if (percent >= 100 && !fullNotified) {
      await AsyncStorage.setItem(FULL_GOAL_NOTIFIED_KEY, "true");
      await schedule(
        "🎉 Daily goal complete!",
        `${current.toLocaleString()} steps today. You crushed your ${target.toLocaleString()} step goal!`,
      );
    }
  } catch (e) {
    console.log("[stepNotifications] checkMilestones error:", e);
  }
};

// ─── Schedule repeating 2-hour reminders ─────────────────────
// Android's TIME_INTERVAL trigger does not understand a quiet-hours
// window, so we schedule 8 individual daily repeats — one at each
// even hour from 6 AM to 12 AM (6, 8, 10, 12, 14, 16, 18, 20, 22).
export const schedulePeriodicReminder = async () => {
  try {
    // 🛑 DISABLE LOCAL APP-SIDE SCHEDULING
    return;
    // Cancel previously scheduled reminders
    const existingRaw = await AsyncStorage.getItem(PERIODIC_ID_KEY);
    if (existingRaw) {
      const ids: string[] = JSON.parse(existingRaw);
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    }

    const scheduledIds: string[] = [];

    // Fires every 2 hours between 6 AM and 12 AM (inclusive of 10 PM,
    // then quiet until 6 AM).
    const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22];

    for (const hour of hours) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "🚶 Quick step check",
          body: "Open TaskCare 360 to see where you stand today.",
          data: { screen: "steps" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
        },
      });
      scheduledIds.push(id);
    }

    await AsyncStorage.setItem(PERIODIC_ID_KEY, JSON.stringify(scheduledIds));
    console.log(
      "[stepNotifications] Periodic reminders scheduled at:",
      hours.join(", "),
    );
  } catch (e) {
    console.log("[stepNotifications] schedulePeriodicReminder error:", e);
  }
};

// ─── Cancel all periodic reminders ───────────────────────────
export const cancelPeriodicReminder = async () => {
  try {
    const existingRaw = await AsyncStorage.getItem(PERIODIC_ID_KEY);
    if (existingRaw) {
      const ids: string[] = JSON.parse(existingRaw);
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
      await AsyncStorage.removeItem(PERIODIC_ID_KEY);
    }
  } catch (e) {
    console.log("[stepNotifications] cancelPeriodicReminder error:", e);
  }
};
