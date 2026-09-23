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
  // Prevent concurrent calls
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

  if (!Device.isDevice) {
    console.log('[push] skipped: not a physical device');
    return null;
  }

  // ✅ DO NOT bail out on Expo Go. Instead, skip only the *remote* push
  // token part if running in Expo Go, but still try to register.
  // On a physical device with a dev build, this works fully.
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'TaskCare 360',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    } catch (e) {
      console.log('[push] channel setup error:', e);
    }
  }

  const existing = await Notifications.getPermissionsAsync();
  console.log('[push] permission status:', existing.status);
  let finalStatus = existing.status;

  if (existing.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    console.log('[push] requested, result:', requested.status);
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    console.log('[push] permission denied, aborting');
    return null;
  }

  // ✅ Only attempt remote token in a dev/prod build, not Expo Go.
  // In Expo Go, expo-notifications can't produce a token (SDK 53+).
  if (Constants.appOwnership === 'expo') {
    console.log('[push] Expo Go: skipping remote token (SDK 53+ removes push in Expo Go). Use a dev build.');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: PROJECT_ID,
    });
    const token = tokenData.data;
    console.log('[push] obtained token:', token);

    await AsyncStorage.setItem('@taskcare360_push_token', token);

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
  } catch (e) {
    console.log('[push] getExpoPushTokenAsync failed:', e);
    return null;
  }
};