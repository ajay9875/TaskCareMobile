// app/_layout.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import * as ExpoSplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { useEffect, useRef, useState } from "react";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { getActiveChatTeam } from "../utils/chatPresence";

import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  LogBox,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthDialog from "../components/AuthDialog";
import LoadingOverlay from "../components/LoadingOverlay";
import CustomSplashScreen from "../components/SplashScreen";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { registerForPushNotifications } from "../utils/pushNotifications";
import {
  initStepTracker,
  recoverMissedSteps,
  stopStepTracker,
} from "../utils/stepTracker";

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "`createAnimatedPropAdapter` is no longer necessary",
]);

ExpoSplashScreen.preventAutoHideAsync();
const isExpoGo = Constants.appOwnership === "expo";
const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async (notification: any) => {
        const data = notification?.request?.content?.data ?? {};
        const viewingThisChat =
          data.screen === "team-chat" &&
          Number(data.team_id) === getActiveChatTeam();
        return {
          shouldShowBanner: !viewingThisChat,
          shouldShowList: !viewingThisChat,
          shouldPlaySound: !viewingThisChat,
          shouldSetBadge: false,
        };
      },
    });
  } catch (e) {
    Notifications = null;
  }
}

function MainLayout() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const isReadyRef = useRef(false);

  const { user, isLoggedIn, isAdmin, setUser, checkSession, clearSession } =
    useAuth();

  // ✅ Theming
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [isAppReady, setIsAppReady] = useState(false);
  const [isHeaderModalVisible, setHeaderModalVisible] = useState(false);
  const [isGuestDialogVisible, setGuestDialogVisible] = useState(false);

  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [updating, setUpdating] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showBudgetPromo, setShowBudgetPromo] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  isReadyRef.current = isAppReady;

  const lastHandledNotifIdRef = useRef<string | null>(null);

  const openFromNotification = (data: any, notificationId?: string) => {
    if (!data) return;

    if (notificationId && lastHandledNotifIdRef.current === notificationId) {
      return;
    }
    if (notificationId) {
      lastHandledNotifIdRef.current = notificationId;
    }

    if (data.screen === "steps") {
      routerRef.current.push("/steps");
    } else if (data.screen === "team-chat" && data.team_id) {
      const teamIdNum = Number(data.team_id);
      if (!Number.isSafeInteger(teamIdNum) || teamIdNum <= 0) return;

      routerRef.current.push({
        pathname: "/teams/chat/[id]",
        params: {
          idx: String(teamIdNum),
          id: String(teamIdNum),
          ...(data.name ? { name: String(data.name) } : {}),
        },
      });
    }
  };

  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      const parsed = Linking.parse(url);
      if (parsed.path === "teams/join" && parsed.queryParams?.code) {
        router.push({
          pathname: "/teams",
          params: { prefill: parsed.queryParams.code },
        });
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!Notifications || !isAppReady) return;
    (async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) return;
      openFromNotification(
        response.notification.request.content.data,
        response.notification.request.identifier,
      );
      await Notifications.clearLastNotificationResponseAsync?.();
    })().catch(() => {});
  }, [isAppReady]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") recoverMissedSteps().catch(() => {});
    });
    let notifSub: any = null;
    if (Notifications) {
      try {
        notifSub = Notifications.addNotificationResponseReceivedListener(
          (response: any) => {
            if (!isReadyRef.current) return;
            openFromNotification(
              response.notification.request.content.data,
              response.notification.request.identifier,
            );
          },
        );
      } catch (e) {}
    }
    return () => {
      sub.remove();
      if (notifSub) notifSub.remove();
    };
  }, []);

  const handleSplashFinish = async () => {
    try {
      const justReloaded = await AsyncStorage.getItem(
        "@taskcare360_just_reloaded",
      );
      if (justReloaded === "true") {
        await AsyncStorage.removeItem("@taskcare360_just_reloaded");
      } else {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await AsyncStorage.setItem("@taskcare360_just_reloaded", "true");
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
            return;
          }
        } catch (e) {
          console.log("OTA Update check failed:", e);
        }
      }
    } catch (e) {
      console.log("AsyncStorage OTA guard failed:", e);
    }

    setIsAppReady(true);

    setTimeout(async () => {
      try {
        await initStepTracker();
        await registerForPushNotifications();
      } catch (e) {}
    }, 4000);
  };

  const handleLogout = () => {
    setHeaderModalVisible(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    setLoggingOut(true);

    const startTime = Date.now();

    try {
      try {
        await stopStepTracker();
      } catch (e) {}

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        await fetch(`${API_BASE}/logout`, {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (e) {}

      try {
        await AsyncStorage.multiRemove([
          "@taskcare360_cached_target",
          "@taskcare360_treadmill_mode",
          "@taskcare360_battery_prompt_shown",
          "@taskcare360_just_reloaded",
        ]);
      } catch (e) {}

      clearSession();
      await checkSession();
    } finally {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 2000 - elapsedTime);

      setTimeout(() => {
        setLoggingOut(false);
        router.replace("/login?loggedOut=true");
      }, remainingTime);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !editEmail.trim()) {
      Alert.alert("Validation Error", "Name and Email cannot be empty.");
      return;
    }
    setUpdating(true);
    try {
      const response = await fetch(`${API_BASE}/profile/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
        }),
      });
      if (response.status === 401) {
        setEditModalVisible(false);
        checkSession();
        return;
      }
      const data = await response.json();
      if (data.status === "success") {
        setUser({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          is_admin: !!data.user.is_admin,
        });
        setEditModalVisible(false);
        Alert.alert("Success", "Profile updated successfully.");
      } else {
        Alert.alert("Error", data.message || "Failed to update profile.");
      }
    } catch (error) {
      Alert.alert("Error", "Unable to reach the server.");
    } finally {
      setUpdating(false);
    }
  };

  if (!isAppReady) {
    return (
      <View
        style={{ flex: 1, backgroundColor: isDark ? "#0F172A" : "#ffffff" }}
        onLayout={async () => {
          await ExpoSplashScreen.hideAsync();
        }}
      >
        <CustomSplashScreen onFinish={handleSplashFinish} />
      </View>
    );
  }

  const avatarLetter = user ? user.name.trim().charAt(0).toUpperCase() : "A";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? "#0F172A" : "lavender" }}
    >
      <View style={{ flex: 1, backgroundColor: isDark ? "#1E293B" : "#fff" }}>
        <Stack
          initialRouteName="index"
          screenOptions={{
// Inside app/_layout.tsx -> <Stack screenOptions={{ header: () => ( ... ) }}>
            header: () => (
              <View
                style={[
                  styles.headerContainer,
                  isDark && {
                    backgroundColor: "#1E293B",
                    borderBottomColor: "#334155",
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.headerLeft}
                  onPress={() => router.replace("/")}
                >
                  <Image
                    source={require("../assets/images/icon.png")}
                    style={{ width: 32, height: 32, borderRadius: 8 }}
                    resizeMode="contain"
                  />
                  <Text
                    style={[styles.headerLogo, isDark && { color: "#fff" }]}
                  >
                    Fit<Text style={{ color: "#4ecca3" }}>Wisely</Text>
                  </Text>
                </TouchableOpacity>

                {/* ✅ RIGHT SIDE: Theme Toggle + Profile */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  
                  {/* ✅ Theme Toggle Button */}
                  <TouchableOpacity onPress={toggleTheme} style={{ padding: 4 }}>
                    <MaterialCommunityIcons
                      name={isDark ? "weather-night" : "white-balance-sunny"}
                      size={24}
                      color={isDark ? "#F59E0B" : "#D97706"}
                    />
                  </TouchableOpacity>

                  {/* Profile Avatar */}
                  <TouchableOpacity
                    style={styles.headerRight}
                    onPress={() => {
                      if (isLoggedIn) setHeaderModalVisible(true);
                      else setGuestDialogVisible(true);
                    }}
                  >
                    {isLoggedIn ? (
                      <View style={styles.headerAvatar}>
                        <Text style={styles.headerAvatarText}>
                          {avatarLetter}
                        </Text>
                      </View>
                    ) : (
                      <Ionicons
                        name="person-circle-outline"
                        size={32}
                        color={isDark ? "#E2E8F0" : "#2c3e50"}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ),
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="steps" />
          <Stack.Screen name="about" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="verify_otp" />
          <Stack.Screen name="history" />
          <Stack.Screen name="reset_password" />
          <Stack.Screen name="profilepage" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="admin/user/[id]" />
          <Stack.Screen name="admin/team/[id]" />
          <Stack.Screen name="teams/index" />
          <Stack.Screen name="teams/member/[id]" />
          <Stack.Screen
            name="teams/chat/[idx]"
            options={{ headerShown: false }}
          />
        </Stack>

        <View
          style={[
            styles.footer,
            isDark && { backgroundColor: "#1E293B", borderTopColor: "#334155" },
          ]}
        >
          <NavItem icon="home" label="Home" path="/" isDark={isDark} />
          <NavItem icon="people" label="Teams" path="/teams" isDark={isDark} />
          <NavItem icon="walk" label="Steps" path="/steps" isDark={isDark} />
          <NavItem
            icon="bar-chart"
            label="History"
            path="/history"
            isDark={isDark}
          />
          <NavItem
            icon="list"
            label="Tasks"
            path="/dashboard"
            isDark={isDark}
          />
        </View>
      </View>

      {/* ✅ GLOBAL PROFILE / GUEST DIALOG MODAL */}
      <Modal visible={isHeaderModalVisible} animationType="slide" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setHeaderModalVisible(false)}
        >
          <View
            style={[styles.dialogBox, isDark && { backgroundColor: "#1E293B" }]}
          >
            {isLoggedIn ? (
              <>
                <View style={styles.profileHeader}>
                  <View style={styles.profileAvatarLarge}>
                    <Text style={styles.avatarTextLarge}>{avatarLetter}</Text>
                  </View>
                  <Text
                    style={[styles.profileName, isDark && { color: "#fff" }]}
                  >
                    {user?.name}
                  </Text>
                  <Text
                    style={[
                      styles.profileSubtitle,
                      isDark && { color: "#94A3B8" },
                    ]}
                  >
                    {user?.email}
                  </Text>
                </View>
                <View
                  style={[
                    styles.menuContainer,
                    isDark && { backgroundColor: "#0F172A" },
                  ]}
                >
                  {/* ✅ DARK MODE TOGGLE */}
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={toggleTheme}
                  >
                    <MaterialCommunityIcons
                      name={isDark ? "weather-night" : "white-balance-sunny"}
                      size={22}
                      color="#F59E0B"
                      style={{ marginRight: 14 }}
                    />
                    <Text
                      style={[styles.menuText, isDark && { color: "#E2E8F0" }]}
                    >
                      {isDark ? "Dark Mode" : "Light Mode"}
                    </Text>
                    <MaterialCommunityIcons
                      name={
                        isDark ? "toggle-switch" : "toggle-switch-off-outline"
                      }
                      size={32}
                      color={isDark ? "#4ecca3" : "#94A3B8"}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setEditName(user?.name || "");
                      setEditEmail(user?.email || "");
                      setEditModalVisible(true);
                    }}
                  >
                    <MaterialCommunityIcons
                      name="account-edit-outline"
                      size={22}
                      color="#4F46E5"
                      style={{ marginRight: 14 }}
                    />
                    <Text
                      style={[styles.menuText, isDark && { color: "#E2E8F0" }]}
                    >
                      Edit Profile
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setHeaderModalVisible(false);
                      router.push("/teams");
                    }}
                  >
                    <MaterialCommunityIcons
                      name="account-group"
                      size={22}
                      color="#0284C7"
                      style={{ marginRight: 14 }}
                    />
                    <Text
                      style={[styles.menuText, isDark && { color: "#E2E8F0" }]}
                    >
                      My Team
                    </Text>
                  </TouchableOpacity>

                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        setHeaderModalVisible(false);
                        router.push("/admin");
                      }}
                    >
                      <MaterialCommunityIcons
                        name="shield-crown-outline"
                        size={22}
                        color="#7C3AED"
                        style={{ marginRight: 14 }}
                      />
                      <Text
                        style={[
                          styles.menuText,
                          isDark && { color: "#E2E8F0" },
                        ]}
                      >
                        Admin Panel
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setHeaderModalVisible(false);
                      router.push("/forgot-password");
                    }}
                  >
                    <MaterialCommunityIcons
                      name="lock-reset"
                      size={22}
                      color="#D97706"
                      style={{ marginRight: 14 }}
                    />
                    <Text
                      style={[styles.menuText, isDark && { color: "#E2E8F0" }]}
                    >
                      Reset Password
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setHeaderModalVisible(false);
                      Linking.openURL(
                        "mailto:info.fitwisely@gmail.com?subject=Support%20Request&body=Hi%20FitWisely%20Team,%0A%0AI%20need%20help%20with...",
                      );
                    }}
                  >
                    <MaterialCommunityIcons
                      name="headset"
                      size={22}
                      color="#0284C7"
                      style={{ marginRight: 14 }}
                    />
                    <Text
                      style={[styles.menuText, isDark && { color: "#E2E8F0" }]}
                    >
                      Contact Support
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setHeaderModalVisible(false);
                      setShowBudgetPromo(true);
                    }}
                  >
                    <MaterialCommunityIcons
                      name="wallet-outline"
                      size={22}
                      color="#16A34A"
                      style={{ marginRight: 14 }}
                    />
                    <Text
                      style={[styles.menuText, isDark && { color: "#E2E8F0" }]}
                    >
                      Budget Wisely
                    </Text>
                    <Ionicons name="open-outline" size={16} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItemLogout}
                    onPress={handleLogout}
                  >
                    <MaterialCommunityIcons
                      name="logout"
                      size={22}
                      color="#DC2626"
                      style={{ marginRight: 14 }}
                    />
                    <Text style={styles.menuTextLogout}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.dialogTitle, isDark && { color: "#fff" }]}>
                  Welcome to FitWisely
                </Text>
                <Text
                  style={[styles.dialogSub, isDark && { color: "#94A3B8" }]}
                >
                  Sign in to sync your steps and tasks.
                </Text>
                <TouchableOpacity
                  style={styles.dialogPrimaryBtn}
                  onPress={() => {
                    setHeaderModalVisible(false);
                    router.push("/signup");
                  }}
                >
                  <Text style={styles.btnText}>Create Account</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dialogSecondaryBtn}
                  onPress={() => {
                    setHeaderModalVisible(false);
                    router.push("/login");
                  }}
                >
                  <Text style={styles.btnText}>Login</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dialogLinkBtn}
                  onPress={() => {
                    setHeaderModalVisible(false);
                    router.push("/forgot-password");
                  }}
                >
                  <Text style={styles.dialogLinkText}>Forgot Password?</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom step-by-step sign-out confirmation */}
      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.logoutModalOverlay}>
          <View
            style={[
              styles.logoutDialog,
              isDark && { backgroundColor: "#1E293B" },
            ]}
          >
            <View
              style={[
                styles.logoutIconCircle,
                isDark && { backgroundColor: "#422006" },
              ]}
            >
              <MaterialCommunityIcons
                name="walk"
                size={30}
                color={isDark ? "#FCD34D" : "#D97706"}
              />
            </View>

            <Text style={[styles.logoutTitle, isDark && { color: "#fff" }]}>
              Before You Sign Out
            </Text>

            <Text
              style={[styles.logoutSubtitle, isDark && { color: "#94A3B8" }]}
            >
              Please review these important steps to protect your fitness
              progress.
            </Text>

            {/* Step 1 */}
            <View
              style={[
                styles.logoutStepRow,
                isDark && { borderBottomColor: "#334155" },
              ]}
            >
              <View
                style={[
                  styles.logoutStepNumber,
                  isDark && { backgroundColor: "#0C4A6E" },
                ]}
              >
                <Text
                  style={[
                    styles.logoutStepNumberText,
                    isDark && { color: "#38BDF8" },
                  ]}
                >
                  1
                </Text>
              </View>

              <View style={styles.logoutStepContent}>
                <Text
                  style={[
                    styles.logoutStepTitle,
                    isDark && { color: "#E2E8F0" },
                  ]}
                >
                  Sync your steps
                </Text>
                <Text
                  style={[
                    styles.logoutStepDescription,
                    isDark && { color: "#94A3B8" },
                  ]}
                >
                  Open the Fitness Tracker screen and wait at least 10 seconds
                  to allow your latest steps to sync to the cloud before signing
                  out.
                </Text>
              </View>
            </View>

            {/* Step 2 */}
            <View
              style={[
                styles.logoutStepRow,
                isDark && { borderBottomColor: "#334155" },
              ]}
            >
              <View
                style={[
                  styles.logoutStepNumber,
                  isDark && { backgroundColor: "#0C4A6E" },
                ]}
              >
                <Text
                  style={[
                    styles.logoutStepNumberText,
                    isDark && { color: "#38BDF8" },
                  ]}
                >
                  2
                </Text>
              </View>

              <View style={styles.logoutStepContent}>
                <Text
                  style={[
                    styles.logoutStepTitle,
                    isDark && { color: "#E2E8F0" },
                  ]}
                >
                  Tracking will stop
                </Text>
                <Text
                  style={[
                    styles.logoutStepDescription,
                    isDark && { color: "#94A3B8" },
                  ]}
                >
                  FitWisely will stop tracking steps when you sign out.
                </Text>
              </View>
            </View>

            {/* Step 3 */}
            <View
              style={[
                styles.logoutStepRow,
                styles.logoutLastStep,
                isDark && { borderBottomColor: "transparent" },
              ]}
            >
              <View
                style={[
                  styles.logoutStepNumber,
                  isDark && { backgroundColor: "#0C4A6E" },
                ]}
              >
                <Text
                  style={[
                    styles.logoutStepNumberText,
                    isDark && { color: "#38BDF8" },
                  ]}
                >
                  3
                </Text>
              </View>

              <View style={styles.logoutStepContent}>
                <Text
                  style={[
                    styles.logoutStepTitle,
                    isDark && { color: "#E2E8F0" },
                  ]}
                >
                  Steps won't sync while signed out
                </Text>
                <Text
                  style={[
                    styles.logoutStepDescription,
                    isDark && { color: "#94A3B8" },
                  ]}
                >
                  Steps taken while you are logged out will not be saved to your
                  account automatically.
                </Text>
              </View>
            </View>

            {/* Warning */}
            <View
              style={[
                styles.logoutWarning,
                isDark && {
                  backgroundColor: "#422006",
                  borderColor: "#78350F",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={19}
                color={isDark ? "#FCD34D" : "#B45309"}
              />

              <Text
                style={[
                  styles.logoutWarningText,
                  isDark && { color: "#FCD34D" },
                ]}
              >
                Make sure your steps are synced before continuing.
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.logoutActions}>
              <TouchableOpacity
                style={[
                  styles.logoutCancelButton,
                  isDark && { backgroundColor: "#334155" },
                ]}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text
                  style={[
                    styles.logoutCancelText,
                    isDark && { color: "#E2E8F0" },
                  ]}
                >
                  Stay Logged In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoutConfirmButton}
                onPress={confirmLogout}
              >
                <MaterialCommunityIcons
                  name="logout"
                  size={17}
                  color="#FFFFFF"
                  style={{ marginRight: 7 }}
                />

                <Text style={styles.logoutConfirmText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ EDIT PROFILE MODAL */}
      <Modal visible={isEditModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.editDialogBox,
              isDark && { backgroundColor: "#1E293B" },
            ]}
          >
            <Text style={[styles.dialogTitle, isDark && { color: "#fff" }]}>
              Edit Profile
            </Text>
            <Text style={[styles.inputLabel, isDark && { color: "#94A3B8" }]}>
              Full Name
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                isDark && {
                  backgroundColor: "#0F172A",
                  borderColor: "#334155",
                  color: "#fff",
                },
              ]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            />
            <Text style={[styles.inputLabel, isDark && { color: "#94A3B8" }]}>
              Email Address
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                isDark && {
                  backgroundColor: "#0F172A",
                  borderColor: "#334155",
                  color: "#fff",
                },
              ]}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Enter your email"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  isDark && { backgroundColor: "#334155" },
                ]}
                onPress={() => setEditModalVisible(false)}
                disabled={updating}
              >
                <Text
                  style={[styles.cancelBtnText, isDark && { color: "#E2E8F0" }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveProfile}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ BUDGET WISELY PROMO MODAL */}
      <Modal
        visible={showBudgetPromo}
        animationType="fade"
        transparent
        onRequestClose={() => setShowBudgetPromo(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.promoDialogBox,
              isDark && { backgroundColor: "#1E293B" },
            ]}
          >
            {/* Header */}
            <View style={styles.promoHeader}>
              <View
                style={[
                  styles.promoIconCircle,
                  isDark && { backgroundColor: "#064E3B" },
                ]}
              >
                <MaterialCommunityIcons
                  name="wallet"
                  size={32}
                  color="#16A34A"
                />
              </View>
              <Text style={[styles.promoTitle, isDark && { color: "#fff" }]}>
                Budget Wisely
              </Text>
              <Text
                style={[styles.promoSubtitle, isDark && { color: "#94A3B8" }]}
              >
                Master your money with effortless precision
              </Text>
            </View>

            {/* Feature list */}
            <View
              style={[
                styles.promoFeatures,
                isDark && { backgroundColor: "#0F172A" },
              ]}
            >
              <View style={styles.promoFeatureRow}>
                <MaterialCommunityIcons
                  name="chart-line"
                  size={20}
                  color="#16A34A"
                />
                <View style={styles.promoFeatureText}>
                  <Text
                    style={[
                      styles.promoFeatureTitle,
                      isDark && { color: "#E2E8F0" },
                    ]}
                  >
                    Real-Time Insights
                  </Text>
                  <Text
                    style={[
                      styles.promoFeatureDesc,
                      isDark && { color: "#94A3B8" },
                    ]}
                  >
                    Live charts for monthly & yearly spending trends
                  </Text>
                </View>
              </View>

              <View style={styles.promoFeatureRow}>
                <MaterialCommunityIcons
                  name="target"
                  size={20}
                  color="#16A34A"
                />
                <View style={styles.promoFeatureText}>
                  <Text
                    style={[
                      styles.promoFeatureTitle,
                      isDark && { color: "#E2E8F0" },
                    ]}
                  >
                    Effortless Budgeting
                  </Text>
                  <Text
                    style={[
                      styles.promoFeatureDesc,
                      isDark && { color: "#94A3B8" },
                    ]}
                  >
                    Monthly limits per category with visual progress
                  </Text>
                </View>
              </View>

              <View style={styles.promoFeatureRow}>
                <MaterialCommunityIcons
                  name="credit-card-outline"
                  size={20}
                  color="#16A34A"
                />
                <View style={styles.promoFeatureText}>
                  <Text
                    style={[
                      styles.promoFeatureTitle,
                      isDark && { color: "#E2E8F0" },
                    ]}
                  >
                    Smart Tracking
                  </Text>
                  <Text
                    style={[
                      styles.promoFeatureDesc,
                      isDark && { color: "#94A3B8" },
                    ]}
                  >
                    Log cash, card & digital spends in seconds
                  </Text>
                </View>
              </View>

              <View style={styles.promoFeatureRow}>
                <MaterialCommunityIcons
                  name="file-chart-outline"
                  size={20}
                  color="#16A34A"
                />
                <View style={styles.promoFeatureText}>
                  <Text
                    style={[
                      styles.promoFeatureTitle,
                      isDark && { color: "#E2E8F0" },
                    ]}
                  >
                    Reports
                  </Text>
                  <Text
                    style={[
                      styles.promoFeatureDesc,
                      isDark && { color: "#94A3B8" },
                    ]}
                  >
                    Net savings, monthly comparisons & exportable summaries
                  </Text>
                </View>
              </View>

              <View style={styles.promoFeatureRow}>
                <MaterialCommunityIcons
                  name="shield-lock-outline"
                  size={20}
                  color="#16A34A"
                />
                <View style={styles.promoFeatureText}>
                  <Text
                    style={[
                      styles.promoFeatureTitle,
                      isDark && { color: "#E2E8F0" },
                    ]}
                  >
                    Secure Vault
                  </Text>
                  <Text
                    style={[
                      styles.promoFeatureDesc,
                      isDark && { color: "#94A3B8" },
                    ]}
                  >
                    PIN-protected storage for sensitive financial notes
                  </Text>
                </View>
              </View>
            </View>

            {/* Notice */}
            <View style={styles.promoNotice}>
              <MaterialCommunityIcons
                name="information-outline"
                size={16}
                color={isDark ? "#64748B" : "#64748B"}
              />
              <Text
                style={[styles.promoNoticeText, isDark && { color: "#64748B" }]}
              >
                Opens Budget Wisely in your browser
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.promoActions}>
              <TouchableOpacity
                style={[
                  styles.promoCancelBtn,
                  isDark && { backgroundColor: "#334155" },
                ]}
                onPress={() => setShowBudgetPromo(false)}
              >
                <Text
                  style={[
                    styles.promoCancelText,
                    isDark && { color: "#E2E8F0" },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.promoOpenBtn}
                onPress={() => {
                  setShowBudgetPromo(false);
                  Linking.openURL("https://budgetwisely.pythonanywhere.com/");
                }}
              >
                <Ionicons
                  name="open-outline"
                  size={18}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.promoOpenText}>Open Budget Wisely</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ REUSABLE GUEST DIALOG */}
      <AuthDialog
        visible={isGuestDialogVisible}
        onClose={() => setGuestDialogVisible(false)}
      />
      <LoadingOverlay visible={loggingOut} />
    </SafeAreaView>
  );
}

// ✅ Added isDark to NavItem
const NavItem = ({ icon, label, path, onPress, isDark }: any) => {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.navItem}
      onPress={onPress || (() => path && router.push(path as any))}
    >
      <Ionicons name={icon} size={22} color={isDark ? "#94A3B8" : "#555"} />
      <Text style={[styles.navLabel, isDark && { color: "#94A3B8" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.68)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  logoutDialog: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    elevation: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  logoutIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  logoutTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 7,
  },
  logoutSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
  },
  logoutStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  logoutLastStep: {
    borderBottomWidth: 0,
    paddingBottom: 8,
  },
  logoutStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logoutStepNumberText: {
    color: "#0369A1",
    fontSize: 13,
    fontWeight: "800",
  },
  logoutStepContent: {
    flex: 1,
    paddingTop: 1,
  },
  logoutStepTitle: {
    color: "#1E293B",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  logoutStepDescription: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
  },
  logoutWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: 12,
    padding: 11,
    marginTop: 12,
    marginBottom: 18,
  },
  logoutWarningText: {
    flex: 1,
    color: "#92400E",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginLeft: 8,
  },
  logoutActions: {
    flexDirection: "row",
    gap: 10,
  },
  logoutCancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutCancelText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  logoutConfirmButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutConfirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerLogo: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1a1a2e",
    letterSpacing: -0.5,
    marginLeft: 8,
  },
  HeaderRight: { padding: 4 },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  headerAvatarText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
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
  navItem: { alignItems: "center", justifyContent: "center", flex: 1 },
  navLabel: { fontSize: 11, color: "#555", marginTop: 0 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialogBox: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  dialogSub: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 24,
    textAlign: "center",
  },
  dialogPrimaryBtn: {
    width: "100%",
    backgroundColor: "#2ecc71",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  dialogSecondaryBtn: {
    width: "100%",
    backgroundColor: "#3498db",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  dialogLinkBtn: { marginTop: 12 },
  dialogLinkText: { fontSize: 14, fontWeight: "600", color: "#e74c3c" },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  profileHeader: { alignItems: "center", marginBottom: 20 },
  profileAvatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#6200EE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarTextLarge: { color: "#FFFFFF", fontSize: 26, fontWeight: "700" },
  profileName: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  profileSubtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  menuContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  menuItemLogout: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  menuText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1E293B" },
  menuTextLogout: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#DC2626",
  },
  editDialogBox: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    elevation: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 4,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0F172A",
    marginBottom: 10,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  cancelBtnText: { color: "#64748B", fontWeight: "600" },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: "#6200EE",
  },
  saveBtnText: { color: "#FFFFFF", fontWeight: "600" },
  promoDialogBox: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    elevation: 10,
  },
  promoHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  promoIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  promoTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
  promoFeatures: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  promoFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    gap: 12,
  },
  promoFeatureText: {
    flex: 1,
  },
  promoFeatureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  promoFeatureDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
  },
  promoNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 16,
  },
  promoNoticeText: {
    fontSize: 12,
    color: "#64748B",
    fontStyle: "italic",
  },
  promoActions: {
    flexDirection: "row",
    gap: 10,
  },
  promoCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  promoCancelText: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 14,
  },
  promoOpenBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  promoOpenText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
