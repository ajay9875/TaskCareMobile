// utils/stepNotifications.ts
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const HALF_GOAL_NOTIFIED_KEY = '@taskcare360_half_goal_notified';
const FULL_GOAL_NOTIFIED_KEY = '@taskcare360_full_goal_notified';
const NOTIFIED_DATE_KEY = '@taskcare360_notified_date';
const PERIODIC_ID_KEY = '@taskcare360_periodic_notif_id';

//const PERIODIC_INTERVAL_SECONDS = 2 * 60 * 60; // 2 hours
const PERIODIC_INTERVAL_SECONDS = 60; // 1 minute — TEMPORARY

// Quiet hours: no notifications between 00:00 and 06:00 (local time)
const QUIET_HOUR_START = 0;   // 12 AM
const QUIET_HOUR_END = 6;     // 6 AM

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
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
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
const pickMessage = (
  current: number,
  target: number,
  isTreadmill: boolean
): { title: string; body: string } => {
  const remaining = Math.max(0, target - current);
  const percent = target > 0 ? Math.round((current / target) * 100) : 0;
  const mode = isTreadmill ? 'Treadmill' : 'Walking';

  if (current === 0) {
    return {
      title: '🚶 Start moving!',
      body: `${mode} mode: 0 / ${target.toLocaleString()} steps. Every step counts.`,
    };
  }
  if (current < target * 0.25) {
    return {
      title: `🚶 ${percent}% of your goal`,
      body: `${current.toLocaleString()} steps done. Only ${remaining.toLocaleString()} to go!`,
    };
  }
  if (current < target * 0.5) {
    return {
      title: `🏃 ${percent}% of your goal`,
      body: `${remaining.toLocaleString()} steps left. Halfway there soon!`,
    };
  }
  if (current < target * 0.75) {
    return {
      title: `🔥 ${percent}% of your goal`,
      body: `${remaining.toLocaleString()} steps left. You're crushing it!`,
    };
  }
  if (current < target) {
    return {
      title: `💪 Almost there — ${percent}%`,
      body: `Only ${remaining.toLocaleString()} steps to hit ${target.toLocaleString()}. Finish strong!`,
    };
  }
  return {
    title: '🎉 Goal smashed!',
    body: `You hit ${target.toLocaleString()} steps today. Amazing work!`,
  };
};

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'TaskCare 360',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
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
  isTreadmill: boolean
) => {
  try {
    const { title, body } = pickMessage(current, target, isTreadmill);

    if (isQuietHour()) {
      // Defer to 6 AM
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, data: { screen: 'steps' } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nextAllowedTime(),
        },
      });
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, data: { screen: 'steps' } },
      trigger: null, // immediate
    });
  } catch (e) {
    console.log('[stepNotifications] sendProgressNotification error:', e);
  }
};

// ─── Milestone check: 50% and 100% ───────────────────────────
export const checkMilestones = async (
  current: number,
  target: number,
  isTreadmill: boolean
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
      (await AsyncStorage.getItem(HALF_GOAL_NOTIFIED_KEY)) === 'true';
    const fullNotified =
      (await AsyncStorage.getItem(FULL_GOAL_NOTIFIED_KEY)) === 'true';

    const schedule = async (title: string, body: string) => {
      if (isQuietHour()) {
        await Notifications.scheduleNotificationAsync({
          content: { title, body, sound: true, data: { screen: 'steps' } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: nextAllowedTime(),
          },
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: { title, body, sound: true, data: { screen: 'steps' } },
          trigger: null,
        });
      }
    };

    if (percent >= 50 && !halfNotified) {
      await AsyncStorage.setItem(HALF_GOAL_NOTIFIED_KEY, 'true');
      const remaining = Math.max(0, target - current);
      await schedule(
        '🏃 Halfway there!',
        `${current.toLocaleString()} / ${target.toLocaleString()} steps. Only ${remaining.toLocaleString()} left — finish strong!`
      );
    }

    if (percent >= 100 && !fullNotified) {
      await AsyncStorage.setItem(FULL_GOAL_NOTIFIED_KEY, 'true');
      await schedule(
        '🎉 Daily goal complete!',
        `${current.toLocaleString()} steps today. You crushed your ${target.toLocaleString()} step goal!`
      );
    }
  } catch (e) {
    console.log('[stepNotifications] checkMilestones error:', e);
  }
};

// ─── Schedule repeating 2-hour reminders ─────────────────────
// Android's TIME_INTERVAL trigger does not understand a quiet-hours
// window, so we schedule 8 individual daily repeats — one at each
// even hour from 6 AM to 12 AM (6, 8, 10, 12, 14, 16, 18, 20, 22).
export const schedulePeriodicReminder = async () => {
  try {
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
          title: '🚶 Quick step check',
          body: 'Open TaskCare 360 to see where you stand today.',
          data: { screen: 'steps' },
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
      '[stepNotifications] Periodic reminders scheduled at:',
      hours.join(', ')
    );
  } catch (e) {
    console.log('[stepNotifications] schedulePeriodicReminder error:', e);
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
    console.log('[stepNotifications] cancelPeriodicReminder error:', e);
  }
};