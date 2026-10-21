import NetInfo from "@react-native-community/netinfo"; // ✅ Import NetInfo
import * as Clipboard from "expo-clipboard";
import * as LinkingExpo from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { stopStepTracker } from "../utils/stepTracker";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function LandingScreen() {
  const router = useRouter();
  const url = LinkingExpo.useURL();
  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // ✅ Network state
  const [isConnected, setIsConnected] = useState<boolean | null>(true);

  // Check login state on component mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(`${API_BASE}/dashboard`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.status === "success") {
            setIsLoggedIn(true);
            setUser(data.username || "User");
          }
        }
      } catch (error) {
        // Not logged in or backend network unreachable
      } finally {
        setCheckingAuth(false);
      }
    };
    checkSession();
  }, []);

  // ✅ Listen for network changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected && state.isInternetReachable !== false);
    });
    return () => unsubscribe();
  }, []);

  const handleRetryConnection = async () => {
    const state = await NetInfo.fetch();
    if (state.isConnected && state.isInternetReachable !== false) {
      setIsConnected(true);
      setCheckingAuth(true);
      try {
        const response = await fetch(`${API_BASE}/dashboard`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.status === "success") {
            setIsLoggedIn(true);
            setUser(data.username || "User");
          }
        }
      } catch (e) {
        // Ignore
      } finally {
        setCheckingAuth(false);
      }
    } else {
      Alert.alert(
        "Still Offline",
        "Please check your internet connection and try again.",
      );
    }
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
            // Silently continue
          } finally {
            setIsLoggedIn(false);
            setUser(null);
          }
        },
      },
    ]);
  };

  const openSupportEmail = async () => {
    const email = "taskcare360@gmail.com";
    const subject = "Support Request - TaskCare360";
    const body = "Hello Support Team,";
    const mailUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(mailUrl);
    } catch (error) {
      Alert.alert(
        "Support Unavailable",
        "No email client found. Copy our support email?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Copy Email",
            onPress: async () => {
              await Clipboard.setStringAsync(email);
              Alert.alert("Success", "Email address copied to clipboard!");
            },
          },
        ],
      );
    }
  };

  // ✅ Show Network Error Block if offline
  if (isConnected === false) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#1a1a2e" }}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="cloud-off-outline"
            size={80}
            color="#ff6b35"
            style={{ marginBottom: 20 }}
          />
          <Text style={styles.errorTitle}>No Internet Connection</Text>
          <Text style={styles.errorSubtext}>
            TaskCare360 requires an active internet connection to load your
            tasks and fitness data. Please check your Wi-Fi or mobile data.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={handleRetryConnection}
          >
            <MaterialCommunityIcons name="refresh" size={20} color="#1a1a2e" />
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* BRAND LOGO SECTION */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="checkmark-done-circle" size={100} color="#0300a8" />
          </View>
          <Text style={styles.header}>TaskCare360</Text>
        </View>

        {/* LOGGED-IN STATUS BANNER */}
        {!checkingAuth && isLoggedIn && (
          <View style={styles.loggedInBanner}>
            <Ionicons name="person-circle" size={24} color="#2e7d32" />
            <Text style={styles.loggedInText}>
              Signed in as <Text style={{ fontWeight: "bold" }}>{user}</Text>
            </Text>
          </View>
        )}

        <Text style={styles.subtext}>
          Stay fit, productive, and organized! Track your daily physical health
          and manage your priorities seamlessly all in one place.
        </Text>

        {/* FITNESS SECTION */}
        <View style={styles.featureBox}>
          <Text style={styles.featureTitle}>🏃‍♂️ About Fitness Tracker</Text>
          <Text style={styles.featureItem}>
            👟 Real-time Step Counter – Track your steps dynamically on screen.
          </Text>
          <Text style={styles.featureItem}>
            🔥 Treadmill Calibration – Swap algorithms to match physical
            machines.
          </Text>
          <Text style={styles.featureItem}>
            📊 Auto-Sync Metrics – Saves records to the database every 5 steps
            or 5 seconds.
          </Text>
          <Text style={styles.featureItem}>
            ⏳ Daily fitness summary via email.
          </Text>
        </View>

        <View style={styles.stepsOutsideBox}>
          <Text style={styles.stepsTitle}>How to use the Fitness Tracker:</Text>
          <Text style={styles.stepsItem}>
            1. Grant physical activity permission or sensor permissions when
            prompted by your phone.
          </Text>
          <Text style={styles.stepsItem}>
            2. Head to the tracking screen and select your mode (Regular or
            Treadmill).
          </Text>
          <Text style={styles.stepsItem}>
            3. Keep the app running in the foreground or background while
            moving; steps synchronize smoothly without locking the page.
          </Text>
        </View>

        {/* TASK MANAGEMENT SECTION */}
        <View style={styles.featureBox}>
          <Text style={styles.featureTitle}>📋 About Task Manager</Text>
          <Text style={styles.featureItem}>
            📌 Easy Task Management – Add, edit, and delete items cleanly.
          </Text>
          <Text style={styles.featureItem}>
            ⏳ Daily Email Reminders – Stay on track with pending obligations.
          </Text>
          <Text style={styles.featureItem}>
            🔄 Secure Cloud Backups – Never lose your data layout updates.
          </Text>
        </View>

        <View style={styles.stepsOutsideBox}>
          <Text style={styles.stepsTitle}>How to manage your Tasks:</Text>
          <Text style={styles.stepsItem}>
            1. Tap "Get Started" or log into your account dashboard profile.
          </Text>
          <Text style={styles.stepsItem}>
            2. Click on "+Add to TaskCare" button to insert new tasks after
            providing title & description
          </Text>
          <Text style={styles.stepsItem}>
            3. After adding tasks, check them off as completed, edit via pencil
            icon, or delete via trash icon.
          </Text>
          <Text style={styles.stepsItem}>
            4. Tap logout icon to sign out of your account at the top right of
            the screen.
          </Text>
        </View>
      </ScrollView>

      {/* BUTTON GROUP */}
      <View style={styles.buttonContainer}>
        {checkingAuth ? (
          <ActivityIndicator size="small" color="#0300a8" />
        ) : isLoggedIn ? (
          /* LOGGED IN BUTTON LAYOUT */
          <View style={styles.loggedInGroup}>
            <TouchableOpacity
              style={styles.dashboardBtn}
              onPress={() => router.push("/dashboard")}
            >
              <Ionicons name="speedometer-outline" size={20} color="#fff" />
              <Text style={styles.btnText}>Go to Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <MaterialCommunityIcons name="logout" size={20} color="#fff" />
              <Text style={styles.btnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* GUEST USER BUTTON LAYOUT (2 Buttons In Single Row + 1 Full Width) */
          <View style={styles.guestGroup}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.btn, styles.signupBtn]}
                onPress={() => router.push("/signup")}
              >
                <Ionicons name="person-add-outline" size={18} color="#fff" />
                <Text style={styles.btnText}>Get Started</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.loginBtn]}
                onPress={() => router.push("/login")}
              >
                <Ionicons name="log-in-outline" size={18} color="#fff" />
                <Text style={styles.btnText}>Login</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => router.push("/forgot-password")}
            >
              <Ionicons name="key-outline" size={18} color="#fff" />
              <Text style={styles.btnText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          onPress={openSupportEmail}
          style={{ marginTop: 15, marginBottom: 10 }}
        >
          <Text style={styles.supportLink}>Need help? Contact Support</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: "center" },
  heroSection: { alignItems: "center", marginTop: 20, marginBottom: 10 },
  logoContainer: { marginBottom: 10 },
  header: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    color: "#2c3e50",
  },
  loggedInBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    borderColor: "#a5d6a7",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 15,
    gap: 8,
  },
  loggedInText: { fontSize: 14, color: "#1b5e20" },
  subtext: {
    textAlign: "center",
    color: "#666",
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  featureBox: {
    width: "100%",
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  featureTitle: {
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 15,
    color: "#2c3e50",
  },
  featureItem: { marginBottom: 10, lineHeight: 20, color: "#444" },
  stepsOutsideBox: {
    width: "100%",
    paddingHorizontal: 10,
    marginBottom: 25,
    alignItems: "flex-start",
  },
  stepsTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: "#2c3e50",
    marginBottom: 10,
  },
  stepsItem: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 8 },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingVertical: 15,
    width: "100%",
  },
  guestGroup: { width: "100%", gap: 10 },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 10,
    gap: 6,
  },
  signupBtn: { backgroundColor: "#2ecc71" },
  loginBtn: { backgroundColor: "#3498db" },
  forgotBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e74c3c",
    padding: 14,
    borderRadius: 10,
    gap: 6,
  },
  loggedInGroup: { width: "100%", gap: 10 },
  dashboardBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0300a8",
    padding: 14,
    borderRadius: 10,
    gap: 6,
  },
  logoutBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc3545",
    padding: 14,
    borderRadius: 10,
    gap: 6,
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  supportLink: {
    color: "#3498db",
    textDecorationLine: "underline",
    textAlign: "center",
  },
  // ✅ NEW STYLES FOR OFFLINE SCREEN
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  errorSubtext: {
    color: "#a4b0be",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
  },
  retryBtn: {
    backgroundColor: "#4ecca3",
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  retryBtnText: {
    color: "#1a1a2e",
    fontWeight: "bold",
    fontSize: 15,
  },
});
