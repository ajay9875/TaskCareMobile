import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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
import { stopStepTracker } from "../utils/stepTracker";

export default function LandingScreen() {
  const router = useRouter();
  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasNetError, setHasNetError] = useState(false);

  // ✅ Network logic remains exactly the same
  const checkSession = useCallback(async () => {
    setLoading(true);
    setHasNetError(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${API_BASE}/dashboard`, {
        credentials: "include",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        setIsLoggedIn(false);
        setUser(null);
        return;
      }

      if (!response.ok) {
        throw new Error(`Server status: ${response.status}`);
      }

      const data = await response.json();
      if (data.status === "success") {
        setIsLoggedIn(true);
        setUser(data.username || "User");
      }
    } catch (e) {
      console.log("Session check failed due to network:", e);
      setHasNetError(true);
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useFocusEffect(
    useCallback(() => {
      checkSession();
    }, [checkSession]),
  );

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
            setIsLoggedIn(false);
            setUser(null);
          }
        },
      },
    ]);
  };

  const openSupportEmail = async () => {
    const email = "taskcare360@gmail.com";
    const mailUrl = `mailto:${email}?subject=${encodeURIComponent("Support Request")}&body=${encodeURIComponent("Hello Support Team,")}`;
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

  // ✅ 1. Loading Spinner
  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: "#1a1a2e", justifyContent: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#4ecca3" />
      </View>
    );
  }

  // ✅ 2. Network Error Block
  if (hasNetError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#1a1a2e" }}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="cloud-off-outline"
            size={80}
            color="#ff6b35"
            style={{ marginBottom: 20 }}
          />
          <Text style={styles.errorTitle}>Sync Connection Error</Text>
          <Text style={styles.errorSubtext}>
            Could not load the data. The server may be busy, offline, or taking
            too long to respond. Please check your internet connection or
            restart the app.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={checkSession}>
            <MaterialCommunityIcons name="refresh" size={20} color="#1a1a2e" />
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ 3. Main UI
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* HERO SECTION */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="checkmark-done-circle" size={90} color="#0300a8" />
          </View>
          <Text style={styles.header}>TaskCare360</Text>
        </View>

        {/* LOGGED IN BANNER */}
        {isLoggedIn && (
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
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="fitness"
              size={24}
              color="#4ecca3"
              style={styles.cardIcon}
            />
            <Text style={styles.cardTitle}>Fitness Tracker</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="footsteps" size={18} color="#555" />
            <Text style={styles.featureText}>
              Real-time Step Counter – Track your steps dynamically on screen.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="treadmill" size={18} color="#555" />
            <Text style={styles.featureText}>
              Treadmill Calibration – Swap algorithms to match physical
              machines.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="sync-circle" size={18} color="#555" />
            <Text style={styles.featureText}>
              Auto-Sync Metrics – Saves records to the database every 5 steps or
              5 seconds.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="time" size={18} color="#555" />
            <Text style={styles.featureText}>
              Daily fitness summary via email.
            </Text>
          </View>
        </View>

        {/* HOW TO USE FITNESS */}
        <View style={styles.stepsBox}>
          <Text style={styles.stepsTitle}>How to use the Fitness Tracker:</Text>

          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="shield-check"
              size={20}
              color="#4ecca3"
            />
            <Text style={styles.stepText}>
              1. Grant physical activity permission when prompted.
            </Text>
          </View>

          <View style={styles.stepRow}>
            <MaterialCommunityIcons name="run-fast" size={20} color="#4ecca3" />
            <Text style={styles.stepText}>
              2. Head to the tracking screen and select your mode (Regular or
              Treadmill).
            </Text>
          </View>

          <View style={styles.stepRow}>
            <Ionicons name="phone-portrait-outline" size={20} color="#4ecca3" />
            <Text style={styles.stepText}>
              3. Keep the app running in the foreground or background while
              moving; steps sync automatically.
            </Text>
          </View>
        </View>

        {/* TASK MANAGER SECTION */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="clipboard"
              size={24}
              color="#4ecca3"
              style={styles.cardIcon}
            />
            <Text style={styles.cardTitle}>Task Manager</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="create" size={18} color="#555" />
            <Text style={styles.featureText}>
              Easy Task Management – Add, edit, and delete items cleanly.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="mail" size={18} color="#555" />
            <Text style={styles.featureText}>
              Daily Email Reminders – Stay on track with pending obligations.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="cloud-upload" size={18} color="#555" />
            <Text style={styles.featureText}>
              Secure Cloud Backups – Never lose your data layout updates.
            </Text>
          </View>
        </View>

        {/* HOW TO USE TASKS - Updated to match dashboard steps & icons */}
        <View style={styles.stepsBox}>
          <Text style={styles.stepsTitle}>How to manage your Tasks:</Text>

          <View style={styles.stepRow}>
            <Ionicons name="log-in-outline" size={20} color="#4ecca3" />
            <Text style={styles.stepText}>
              1. Tap "Get Started" or log into your account dashboard profile.
            </Text>
          </View>

          <View style={styles.stepRow}>
            <Ionicons name="add-circle-outline" size={20} color="#4ecca3" />
            <Text style={styles.stepText}>
              2. Click on "+Add to TaskCare" button to insert new tasks.
            </Text>
          </View>

          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="checkbox-marked-circle-outline"
              size={20}
              color="#4ecca3"
            />
            <Text style={styles.stepText}>3. Check them off as completed.</Text>
          </View>

          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="pencil-outline"
              size={20}
              color="#4ecca3"
            />
            <Text style={styles.stepText}>
              4. Edit tasks anytime using the pencil icon.
            </Text>
          </View>

          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={20}
              color="#4ecca3"
            />
            <Text style={styles.stepText}>
              5. Delete tasks permanently using the trash icon.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* BUTTONS */}
      <View style={styles.buttonContainer}>
        {isLoggedIn ? (
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
  container: { flex: 1, paddingHorizontal: 15 },
  scrollContainer: { padding: 20, paddingBottom: 30, alignItems: "center" },
  heroSection: { alignItems: "center", marginTop: 20, marginBottom: 15 },
  logoContainer: { marginBottom: 10 },
  header: {
    fontSize: 28,
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
    marginBottom: 20,
    gap: 8,
  },
  loggedInText: { fontSize: 14, color: "#1b5e20" },
  subtext: {
    textAlign: "center",
    color: "#666",
    marginBottom: 25,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  card: {
    width: "100%",
    padding: 20,
    backgroundColor: "#ffffff",
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e9ecef",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  cardIcon: { marginRight: 10 },
  cardTitle: { fontWeight: "bold", fontSize: 18, color: "#2c3e50" },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  featureText: { flex: 1, marginLeft: 10, lineHeight: 20, color: "#444" },
  stepsBox: {
    width: "100%",
    paddingHorizontal: 10,
    marginBottom: 30,
    alignItems: "flex-start",
  },
  stepsTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: "#2c3e50",
    marginBottom: 15,
  },

  // ✅ New styles for the icon-based steps
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingRight: 10,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginLeft: 10,
  },

  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingVertical: 15,
    width: "100%",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
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
    fontSize: 14,
  },
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
  retryBtnText: { color: "#1a1a2e", fontWeight: "bold", fontSize: 15 },
});
