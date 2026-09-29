import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react"; // ✅ useRef added
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
import { registerForPushNotifications } from "../utils/pushNotifications";
import { initStepTracker } from "../utils/stepTracker";

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "`createAnimatedPropAdapter` is no longer necessary",
  "expo-notifications: Android Push notifications",
]);

const isExpoGo = Constants.appOwnership === "expo";

let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
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
  const routerRef = useRef(router); // ✅ NEW
  routerRef.current = router; // ✅ NEW

  // ✅ NEW: Handle notification tap when app cold-starts
  useEffect(() => {
    if (!Notifications) return;

    const handleInitialNotification = async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (!response) return;

        const screen = response.notification.request.content.data?.screen;
        console.log("[layout] cold-start notification screen:", screen);

        if (screen === "steps") {
          setTimeout(() => {
            routerRef.current.push("/steps");
          }, 300);
        }

        // Prevent firing again on next launch
        if (Notifications.clearLastNotificationResponseAsync) {
          await Notifications.clearLastNotificationResponseAsync();
        }
      } catch (e) {
        console.log("[layout] initial notification error:", e);
      }
    };

    handleInitialNotification();
  }, []);

  useEffect(() => {
    initStepTracker().catch((e) => console.log("[layout] init error", e));

    registerForPushNotifications().catch((e) =>
      console.log("[layout] initial push registration attempt:", e),
    );

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        initStepTracker().catch(() => {});
        registerForPushNotifications().catch((e) =>
          console.log("[layout] foreground push registration attempt:", e),
        );
      }
    });

    let notifSub: any = null;
    if (Notifications) {
      try {
        notifSub = Notifications.addNotificationResponseReceivedListener(
          (response: any) => {
            const screen = response.notification.request.content.data?.screen;
            console.log("[layout] notification tap screen:", screen); // ✅ NEW log

            if (screen === "steps") {
              routerRef.current.push("/steps"); // ✅ uses ref
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
