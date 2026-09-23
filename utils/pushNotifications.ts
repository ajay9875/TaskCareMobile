// utils/pushNotifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
const PROJECT_ID = 'f10f38af-0647-45b5-9870-484ef77bd853';

let registrationInFlight: Promise<string | null> | null = null;

export const registerForPushNotifications = async (): Promise<string | null> => {
  if (registrationInFlight) return registrationInFlight;
  registrationInFlight = doRegister();
  try {
    return await registrationInFlight;
  } finally {
    registrationInFlight = null;
  }
};

const doRegister = async (): Promise<string | null> => {
  console.log('[push] starting registration');

  // ✅ Only iOS simulators truly cannot get push tokens.
  // Android emulators with Play Services CAN register — don't block them.
  if (Platform.OS === 'ios' && !Device.isDevice) {
    console.log('[push] skipped: iOS simulator has no push support');
    return null;
  }

  if (Platform.OS === 'android' && !Device.isDevice) {
    console.log('[push] Android emulator detected — attempting token anyway');
  }

  // Android channel setup (safe to call on both emulator and device)
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'TaskCare 360',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    } catch (e) {
      console.log('[push] channel setup error:', e);
    }
  }

  // Permission check
  const existing = await Notifications.getPermissionsAsync();
  console.log('[push] permission status:', existing.status);
  let finalStatus = existing.status;

  if (existing.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
    console.log('[push] requested, result:', requested.status);
  }

  if (finalStatus !== 'granted') {
    console.log('[push] permission denied, aborting');
    return null;
  }

  // Expo Go can't produce a remote token on SDK 53+
  if (Constants.appOwnership === 'expo') {
    console.log(
      '[push] Expo Go: cannot get remote token (SDK 53+). Use a dev build.'
    );
    return null;
  }

  // Get the token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: PROJECT_ID,
    });
    const token = tokenData.data;
    console.log('[push] obtained token:', token);

    await AsyncStorage.setItem('@taskcare360_push_token', token);

    // Send to backend
    const res = await fetch(`${API_BASE}/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, platform: Platform.OS }),
    });

    console.log('[push] backend response status:', res.status);

    if (!res.ok) {
      const text = await res.text();
      console.log('[push] backend rejected token:', text);
      return null;
    }

    console.log('[push] ✅ token registered on backend');
    return token;
  } catch (e: any) {
    console.log('[push] getExpoPushTokenAsync failed:', e?.message || e);

    // Specific help messages for common failures
    const msg = String(e?.message || e);
    if (msg.includes('FirebaseApp')) {
      console.log(
        '[push] Fix: add google-services.json to project root and rebuild'
      );
    } else if (msg.includes('FIS_AUTH_ERROR')) {
      console.log('[push] Fix: FCM auth failed — check google-services.json');
    } else if (msg.includes('projectId')) {
      console.log('[push] Fix: ensure PROJECT_ID is correct in this file');
    }

    return null;
  }
};