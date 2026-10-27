// app/_layout.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import * as ExpoSplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  LogBox,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"; // ✅ FIX: Added missing import
import AuthDialog from "../components/AuthDialog";
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
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    Notifications = null;
  }
}

function MainLayout() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const { user, isLoggedIn, setUser, checkSession } = useAuth();
  const [isAppReady, setIsAppReady] = useState(false);
  const [isHeaderModalVisible, setHeaderModalVisible] = useState(false);
  const [isGuestDialogVisible, setGuestDialogVisible] = useState(false); // ✅ Add this

  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!Notifications) return;
    const handleInitialNotification = async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (!response) return;
        const screen = response.notification.request.content.data?.screen;
        if (screen === "steps")
          setTimeout(() => routerRef.current.push("/steps"), 500);
        if (Notifications.clearLastNotificationResponseAsync)
          await Notifications.clearLastNotificationResponseAsync();
      } catch (e) {}
    };
    handleInitialNotification();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") recoverMissedSteps().catch(() => {});
    });
    let notifSub: any = null;
    if (Notifications) {
      try {
        notifSub = Notifications.addNotificationResponseReceivedListener(
          (response: any) => {
            const screen = response.notification.request.content.data?.screen;
            if (screen === "steps") routerRef.current.push("/steps");
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
    setIsAppReady(true);
    setTimeout(async () => {
      try {
        await initStepTracker();
        await registerForPushNotifications();
      } catch (e) {}
    }, 4000);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await stopStepTracker();
            await fetch(`${API_BASE}/logout`, { credentials: "include" });
          } catch (e) {
          } finally {
            setUser(null);
            await checkSession(); // ✅ ADD THIS LINE
            setHeaderModalVisible(false);
          }
        },
      },
    ]);
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
        setUser({ name: editName.trim(), email: editEmail.trim() });
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
        style={{ flex: 1, backgroundColor: "#ffffff" }}
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "lavender" }}>
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <Stack
          initialRouteName="index"
          screenOptions={{
            header: () => (
              <View style={styles.headerContainer}>
                {/* ✅ Clickable Logo */}
                <TouchableOpacity
                  style={styles.headerLeft}
                  onPress={() => router.replace("/")}
                >
                  <Ionicons
                    name="checkmark-done-circle"
                    size={32} // ✅ Increased to match the profile icon
                    color="#0300a8"
                  />
                  <Text style={styles.headerLogo}>TaskCare360</Text>
                </TouchableOpacity>

                {/* ✅ Circular profile icon with border and distinct color */}
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
                      color="#2c3e50"
                    />
                  )}
                </TouchableOpacity>
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
        </Stack>

        <View style={styles.footer}>
          <NavItem icon="home" label="Home" path="/" />
          <NavItem icon="list" label="Tasks" path="/dashboard" />
          <NavItem icon="walk" label="Steps" path="/steps" />
          <NavItem icon="bar-chart" label="History" path="/history" />
          <NavItem
            icon="cash"
            label="Budget Wisely"
            onPress={() =>
              Linking.openURL("https://budgetwisely.pythonanywhere.com/")
            }
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
          <View style={styles.dialogBox}>
            {isLoggedIn ? (
              <>
                <View style={styles.profileHeader}>
                  <View style={styles.profileAvatarLarge}>
                    <Text style={styles.avatarTextLarge}>{avatarLetter}</Text>
                  </View>
                  <Text style={styles.profileName}>{user?.name}</Text>
                  <Text style={styles.profileSubtitle}>{user?.email}</Text>
                </View>
                <View style={styles.menuContainer}>
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
                    <Text style={styles.menuText}>Edit Profile</Text>
                  </TouchableOpacity>
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
                    <Text style={styles.menuText}>Reset Password</Text>
                  </TouchableOpacity>
                  {/* ✅ ADD THIS CONTACT SUPPORT BUTTON */}
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setHeaderModalVisible(false);
                      Linking.openURL(
                        "mailto:taskcare360@gmail.com?subject=Support%20Request",
                      );
                    }}
                  >
                    <MaterialCommunityIcons
                      name="headset"
                      size={22}
                      color="#0284C7"
                      style={{ marginRight: 14 }}
                    />
                    <Text style={styles.menuText}>Contact Support</Text>
                  </TouchableOpacity>

                  {/* ✅ SIGN OUT BUTTON */}
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
                <Text style={styles.dialogTitle}>Welcome to TaskCare360</Text>
                <Text style={styles.dialogSub}>
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

      {/* ✅ EDIT PROFILE MODAL */}
      <Modal visible={isEditModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.editDialogBox}>
            <Text style={styles.dialogTitle}>Edit Profile</Text>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
            />
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.modalInput}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={updating}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
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
      {/* ✅ REUSABLE GUEST DIALOG */}
      <AuthDialog
        visible={isGuestDialogVisible}
        onClose={() => setGuestDialogVisible(false)}
      />
    </SafeAreaView>
  );
}

// ✅ Moved NavItem ABOVE the default export to fix hoisting crash
const NavItem = ({ icon, label, path, onPress }: any) => {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.navItem}
      onPress={onPress || (() => path && router.push(path as any))}
    >
      <Ionicons name={icon} size={22} color="#555" />
      <Text style={styles.navLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

export default function Layout() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 20, // ✅ Slightly larger text
    fontWeight: "bold",
    color: "#2c3e50",
    marginLeft: 8,
  },
  headerRight: { padding: 4 },
  headerAvatar: {
    width: 32, // ✅ Matched to the logo icon size
    height: 32,
    borderRadius: 16, // ✅ Makes it a perfect circle
    backgroundColor: "#0300a8", // ✅ Distinct color (matching the logo)
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2, // ✅ Added circular border
    borderColor: "#E2E8F0", // ✅ Light gray border for a professional look
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
});
