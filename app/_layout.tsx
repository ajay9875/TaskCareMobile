// app/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import * as ExpoSplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  LogBox,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomSplashScreen from "../components/SplashScreen";
import { registerForPushNotifications } from "../utils/pushNotifications";
import { initStepTracker, recoverMissedSteps } from "../utils/stepTracker"; // ✅ Import recoverMissedSteps

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "`createAnimatedPropAdapter` is no longer necessary",
  "expo-notifications: Android Push notifications",
]);

// ✅ Prevent the native static image from hiding instantly
ExpoSplashScreen.preventAutoHideAsync();

const isExpoGo = Constants.appOwnership === "expo";

let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true, // Sound is important for fitness reminders
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.log("[layout] expo-notifications not available:", e);
    Notifications = null;
  }
}

export default function Layout() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const [isAppReady, setIsAppReady] = useState(false);

  // 1. Handle Cold Start (App was dead/swiped away)
  useEffect(() => {
    if (!Notifications) return;

    const handleInitialNotification = async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (!response) return;

        const screen = response.notification.request.content.data?.screen;
        console.log("[layout] cold-start notification screen:", screen);

        if (screen === "steps") {
          // Short delay lets the Stack navigator mount before pushing
          setTimeout(() => {
            routerRef.current.push("/steps");
          }, 500);
        }

        if (Notifications.clearLastNotificationResponseAsync) {
          await Notifications.clearLastNotificationResponseAsync();
        }
      } catch (e) {
        console.log("[layout] initial notification error:", e);
      }
    };

    handleInitialNotification();
  }, []);

  // 2. Handle Warm Start (App was minimized)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        // ✅ Using the imported recoverMissedSteps here
        recoverMissedSteps().catch(() => {});
      }
    });

    let notifSub: any = null;
    if (Notifications) {
      try {
        notifSub = Notifications.addNotificationResponseReceivedListener(
          (response: any) => {
            const screen = response.notification.request.content.data?.screen;
            console.log("[layout] notification tap screen:", screen);

            if (screen === "steps") {
              routerRef.current.push("/steps");
            }
          },
        );
      } catch (e) {
        console.log("[layout] notification listener error:", e);
      }
    }

    return () => {
      sub.remove();
      if (notifSub) notifSub.remove();
    };
  }, []);

  // ✅ THE ONLY PLACE INITIALIZATION HAPPENS (AFTER SPLASH)
  const handleSplashFinish = async () => {
    setIsAppReady(true);

    // Wait 3 seconds to ensure the session is fully loaded before registering
    setTimeout(async () => {
      try {
        // Start the step tracker
        await initStepTracker();

        // ✅ THIS IS THE MISSING PIECE.
        // We MUST register the push token after the app is ready.
        await registerForPushNotifications();
      } catch (e) {
        console.log("Permission/Init error:", e);
      }
    }, 4000); // Changed to 4000ms
  };

  // ✅ SHOW SPLASH SCREEN IF NOT READY
  if (!isAppReady) {
    return (
      <View
        style={{ flex: 1, backgroundColor: "#ffffff" }}
        onLayout={async () => {
          await ExpoSplashScreen.hideAsync();
        }}
      >
        <CustomSplashScreen onFinish={handleSplashFinish} />
      </View>
    );
  }

  const NavItem = ({
    icon,
    label,
    path,
    onPress,
  }: {
    icon: any;
    label: string;
    path?: string;
    onPress?: () => void;
  }) => (
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
          <Stack.Screen
            name="index"
            options={{
              title: "Welcome to TaskCare360",
              headerLeft: () => null,
              headerBackVisible: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="login"
            options={{ title: "SignIn", headerLeft: () => null }}
          />
          <Stack.Screen
            name="steps"
            options={{
              title: "Fitness Tracker",
              headerLeft: () => null,
              headerBackVisible: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen name="about" options={{ title: "About Us" }} />
          <Stack.Screen name="signup" options={{ title: "Create Account" }} />
          <Stack.Screen
            name="forgot-password"
            options={{ title: "Recover Account" }}
          />
          <Stack.Screen
            name="verify_otp"
            options={{ title: "Security Verification" }}
          />
          <Stack.Screen
            name="history"
            options={{
              title: "History Logs",
              headerLeft: () => null,
              headerBackVisible: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="reset_password"
            options={{ title: "Secure Your Account" }}
          />
          <Stack.Screen name="profilepage" options={{ title: "Profile" }} />
          <Stack.Screen
            name="dashboard"
            options={{
              title: "TaskCare360 Dashboard",
              headerLeft: () => null,
              headerBackVisible: false,
              gestureEnabled: false,
            }}
          />
        </Stack>

        <View style={styles.footer}>
          <NavItem icon="home" label="Home" path="/" />
          <NavItem icon="list" label="Tasks" path="/dashboard" />
          <NavItem icon="walk" label="Steps" path="/steps" />
          <NavItem
            icon="cash"
            label="Budget Wisely"
            onPress={() =>
              Linking.openURL("https://budgetwisely.pythonanywhere.com/")
            }
          />
          <NavItem icon="person" label="Profile" path="/profilepage" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    height: 70,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 5,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  navLabel: {
    fontSize: 11,
    color: "#555",
    marginTop: 0,
  },
});
