import React, { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, StyleSheet, TouchableOpacity, Text, DeviceEventEmitter, AppState, LogBox } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { openSupportEmail } from "../utils/support";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from "expo-sensors";
import { Linking } from 'react-native';

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "`createAnimatedPropAdapter` is no longer necessary",
]);

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
const LAST_SYNCED_TIMESTAMP_KEY = "@taskcare360_last_sync_time";
const UNSYNCED_BUFFER_KEY = "unsynced_steps_buffer";

export default function Layout() {
  const router = useRouter();
  
  const lastSensorSteps = useRef(0);
  const stepBuffer = useRef(0);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncing = useRef(false);

  // Helper to trigger server sync cleanly without race conditions
  const triggerServerSync = async () => {
    if (isSyncing.current) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      const stepsToSyncNow = stepBuffer.current;
      if (stepsToSyncNow <= 0) return;

      isSyncing.current = true;
      try {
        const savedMode = await AsyncStorage.getItem("@taskcare360_treadmill_mode");
        const activeMode = savedMode && JSON.parse(savedMode) === true ? 'treadmill' : 'walking';

        const syncResponse = await fetch(`${API_BASE}/steps/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            delta: stepsToSyncNow, 
            mode: activeMode 
          })
        });

        if (syncResponse.ok) {
          // Atomically subtract synced steps from local buffer
          stepBuffer.current = Math.max(0, stepBuffer.current - stepsToSyncNow);
          await AsyncStorage.setItem(UNSYNCED_BUFFER_KEY, stepBuffer.current.toString());
          await AsyncStorage.setItem(LAST_SYNCED_TIMESTAMP_KEY, Date.now().toString());

          DeviceEventEmitter.emit('SYNC_COMPLETED');
        }
      } catch (e) {
        console.log("Database background synchronization deferred:", e);
      } finally {
        isSyncing.current = false;
      }
    }, 3000);
  };

  // Pull steps taken while the app was swiped away / closed
  const recoverMissedSteps = async () => {
    try {
      const isAvailable = await Pedometer.isAvailableAsync();
      if (!isAvailable) return;

      const lastSyncTimeStr = await AsyncStorage.getItem(LAST_SYNCED_TIMESTAMP_KEY);
      const now = new Date();
      // Default to last 24 hours if last sync time is missing
      const start = lastSyncTimeStr 
        ? new Date(parseInt(lastSyncTimeStr, 10)) 
        : new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const pResult = await Pedometer.getStepCountAsync(start, now);
      if (pResult && pResult.steps > 0) {
        stepBuffer.current += pResult.steps;
        await AsyncStorage.setItem(UNSYNCED_BUFFER_KEY, stepBuffer.current.toString());
        
        DeviceEventEmitter.emit('REALTIME_STEP_TAKEN', { delta: pResult.steps });
        await triggerServerSync();
      }
      await AsyncStorage.setItem(LAST_SYNCED_TIMESTAMP_KEY, now.getTime().toString());
    } catch (e) {
      console.log("Historical recovery error:", e);
    }
  };

  useEffect(() => {
    let subscription: any = null;

    const initializeAndTrack = async () => {
      // 1. Re-hydrate local step buffer from storage
      const savedBuffer = await AsyncStorage.getItem(UNSYNCED_BUFFER_KEY);
      if (savedBuffer) {
        stepBuffer.current = parseInt(savedBuffer, 10) || 0;
      }

      // 2. Recover steps missed while closed
      await recoverMissedSteps();

      // 3. Start realtime sensor watcher
      const isAvailable = await Pedometer.isAvailableAsync();
      if (!isAvailable) return;

      subscription = Pedometer.watchStepCount((result) => {
        if (lastSensorSteps.current === 0) {
          lastSensorSteps.current = result.steps;
          return;
        }

        const delta = result.steps - lastSensorSteps.current;
        lastSensorSteps.current = result.steps;

        if (delta > 0) {
          stepBuffer.current += delta;
          AsyncStorage.setItem(UNSYNCED_BUFFER_KEY, stepBuffer.current.toString());

          DeviceEventEmitter.emit('REALTIME_STEP_TAKEN', { delta });
          triggerServerSync();
        }
      });
    };

    initializeAndTrack();

    // 4. Recover steps every time the app moves back from Background -> Active
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        recoverMissedSteps();
      }
    });

    return () => {
      subscription?.remove();
      appStateSub.remove();
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  const NavItem = ({ icon, label, path, onPress }: { icon: any, label: string, path?: string, onPress?: () => void }) => (
    <TouchableOpacity 
      style={styles.navItem} 
      onPress={onPress || (() => path && router.push(path as any))}
    >
      <Ionicons name={icon} size={22} color="#555" />
      <Text style={styles.navLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "lavender" }}>
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <Stack
          initialRouteName="index"
          screenOptions={{
            headerStyle: { backgroundColor: "lavender" },
            headerTintColor: "#000",
            headerTitleStyle: { fontWeight: "bold" },
            headerTitleAlign: "center",
          }}
        >
          
          <Stack.Screen name="index" 
              options={{ 
                title: "TaskCare360", 
                headerLeft: () => null, 
                headerBackVisible: false, 
                gestureEnabled: false 
              }} 
            />
          <Stack.Screen name="login" options={{ title: "SignIn", headerLeft: () => null }} />
          <Stack.Screen name="steps" options={{ title: "Fitness Tracker", headerLeft: () => null, 
                headerBackVisible: false, 
                gestureEnabled: false  }} />
          <Stack.Screen name="about" options={{ title: "About Us" }} />
          <Stack.Screen name="signup" options={{ title: "Create Account" }} />
          <Stack.Screen name="forgot-password" options={{ title: "Recover Account" }} />
          <Stack.Screen name="verify_otp" options={{ title: "Security Verification" }} />
          <Stack.Screen name="history" options={{ title: "History Logs", headerLeft: () => null, 
                headerBackVisible: false, 
                gestureEnabled: false  }} />
          <Stack.Screen name="reset_password" options={{ title: "Secure Your Account" }} />
          <Stack.Screen name="profilepage" options={{ title: "Profile" }} />

          <Stack.Screen 
            name="dashboard"
            options={{ 
              title: "TaskCare360 Dashboard", 
              headerLeft: () => null, 
              headerBackVisible: false, 
              gestureEnabled: false 
            }} 
          />
        </Stack>

        <View style={styles.footer}>
          <NavItem icon="home" label="Home" path="/" />
          <NavItem icon="list" label="Tasks" path="/dashboard" />
          <NavItem icon="walk" label="Steps" path="/steps" />
          <NavItem icon="cash" label="Budget Wisely" 
            onPress={() => Linking.openURL('https://budgetwisely.pythonanywhere.com/')} 
          />          
          <NavItem icon="person" label="Profile" path="/profilepage" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    height: 70,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 5,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navLabel: {
    fontSize: 11,
    color: '#555',
    marginTop: 0,
  },
});