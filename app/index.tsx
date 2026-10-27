// app/index.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import AuthDialog from "../components/AuthDialog";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { stopStepTracker } from "../utils/stepTracker";

export default function LandingScreen() {
  const router = useRouter();
  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

  const { user, isLoggedIn, setUser, checkSession } = useAuth();

  const [loading, setLoading] = useState(true);
  const [hasNetError, setHasNetError] = useState(false);
  const [isGuestDialogVisible, setGuestDialogVisible] = useState(false);
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);

  const [publicStats, setPublicStats] = useState<{
    total_users: number;
    total_steps: number;
    tasks_handled: number;
  } | null>(null);

  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchPublicStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/public/stats`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "success") {
        setPublicStats({
          total_users: Number(data.total_users) || 0,
          total_steps: Number(data.total_steps) || 0,
          tasks_handled: Number(data.tasks_handled) || 0,
        });
      }
    } catch (e) {}
  }, [API_BASE]);

  useFocusEffect(
    useCallback(() => {
      checkSession();
      fetchPublicStats();
      setLoading(false);
    }, [checkSession, fetchPublicStats]),
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
            setUser(null);
            setProfileModalVisible(false);
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
        setProfileModalVisible(false);
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

  const formatNumber = (n: number): string => {
    if (n >= 1_000_000)
      return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  };

  const StatCard = ({ icon, value, label, caption, accent }: any) => (
    <View style={styles.statCard}>
      <View style={[styles.statAccent, { backgroundColor: accent }]} />
      <View style={[styles.statIconCircle, { backgroundColor: accent + "18" }]}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {caption ? <Text style={styles.statCaption}>{caption}</Text> : null}
    </View>
  );

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
            Could not load data. Check your connection.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoading(true);
              checkSession();
              fetchPublicStats();
              setLoading(false);
            }}
          >
            <MaterialCommunityIcons name="refresh" size={20} color="#1a1a2e" />
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const avatarLetter = user ? user.name.trim().charAt(0).toUpperCase() : "A";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      {/* ✅ Signed in banner (Pill shape, centered, larger icon) */}
      {isLoggedIn && (
        <View style={styles.signedInBanner}>
          <Ionicons name="person-circle" size={26} color="#2e7d32" />
          <Text style={styles.signedInText}>
            Signed in as{" "}
            <Text style={{ fontWeight: "bold" }}>{user?.name}</Text>
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.shortSubtext}>
          Stay fit, productive, and organized! Track your daily physical health
          and manage your priorities seamlessly all in one place.
        </Text>

        <View style={styles.statsGrid}>
          <StatCard
            icon="briefcase-outline"
            value={formatNumber(publicStats?.tasks_handled || 0)}
            label="Tasks Managed"
            caption="Lifetime"
            accent="#e67e22"
          />
          <StatCard
            icon="footsteps-outline"
            value={formatNumber(publicStats?.total_steps || 0)}
            label="Steps"
            caption="Tracked"
            accent="#4ecca3"
          />
          <StatCard
            icon="people-outline"
            value={formatNumber(publicStats?.total_users || 0)}
            label="Users"
            caption="Registered"
            accent="#0300a8"
          />
          <StatCard
            icon="shield-checkmark"
            value="100%"
            label="Safe & Secure"
            caption="Encrypted"
            accent="#2ecc71"
          />
        </View>

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
              2. Head to the tracking screen and select your mode.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <Ionicons name="phone-portrait-outline" size={20} color="#4ecca3" />
            <Text style={styles.stepText}>
              3. Keep the app running in the background; steps sync
              automatically.
            </Text>
          </View>
        </View>

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

        <View style={styles.stepsBox}>
          <Text style={styles.stepsTitle}>How to manage your Tasks:</Text>
          <View style={styles.stepRow}>
            <Ionicons name="log-in-outline" size={20} color="#4ecca3" />
            <Text style={styles.stepText}>
              1. Tap "Get Started" or log into your account.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <Ionicons name="add-circle-outline" size={20} color="#4ecca3" />
            <Text style={styles.stepText}>
              2. Click on "+Add to TaskCare" to insert new tasks.
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

      <View style={styles.bottomActionContainer}>
        {isLoggedIn ? (
          <View style={styles.inlineRow}>
            <TouchableOpacity
              style={styles.dashboardBtn}
              onPress={() => router.push("/dashboard")}
            >
              <Ionicons name="speedometer-outline" size={20} color="#fff" />
              <Text style={styles.btnText}>Go to Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutBtnSmall}
              onPress={handleLogout}
            >
              <MaterialCommunityIcons name="logout" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.guestLoginBtn}
            onPress={() => setGuestDialogVisible(true)}
          >
            <Ionicons name="log-in-outline" size={20} color="#fff" />
            <Text style={styles.btnText}>Get Started / Login</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={isGuestDialogVisible} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setGuestDialogVisible(false)}
        >
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>Welcome to TaskCare360</Text>
            <Text style={styles.dialogSub}>
              Sign in to sync your steps and tasks.
            </Text>

            <TouchableOpacity
              style={styles.dialogPrimaryBtn}
              onPress={() => {
                setGuestDialogVisible(false);
                router.push("/signup");
              }}
            >
              <Ionicons name="person-add-outline" size={20} color="#fff" />
              <Text style={styles.btnText}>Create Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogSecondaryBtn}
              onPress={() => {
                setGuestDialogVisible(false);
                router.push("/login");
              }}
            >
              <Ionicons name="log-in-outline" size={20} color="#fff" />
              <Text style={styles.btnText}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogLinkBtn}
              onPress={() => {
                setGuestDialogVisible(false);
                router.push("/forgot-password");
              }}
            >
              <Ionicons name="key-outline" size={18} color="#e74c3c" />
              <Text style={styles.dialogLinkText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogLinkBtn}
              onPress={() => {
                setGuestDialogVisible(false);
                openSupportEmail();
              }}
            >
              <Ionicons name="help-circle-outline" size={18} color="#3498db" />
              <Text style={[styles.dialogLinkText, { color: "#3498db" }]}>
                Contact Support
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isProfileModalVisible} animationType="slide" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setProfileModalVisible(false)}
        >
          <View style={styles.profileDialog}>
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
                <View
                  style={[styles.iconWrapper, { backgroundColor: "#EEF2FF" }]}
                >
                  <MaterialCommunityIcons
                    name="account-edit-outline"
                    size={22}
                    color="#4F46E5"
                  />
                </View>
                <Text style={styles.menuText}>Edit Profile</Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color="#94A3B8"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setProfileModalVisible(false);
                  router.push("/forgot-password");
                }}
              >
                <View
                  style={[styles.iconWrapper, { backgroundColor: "#FEF3C7" }]}
                >
                  <MaterialCommunityIcons
                    name="lock-reset"
                    size={22}
                    color="#D97706"
                  />
                </View>
                <Text style={styles.menuText}>Reset Password</Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color="#94A3B8"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setProfileModalVisible(false);
                  openSupportEmail();
                }}
              >
                <View
                  style={[styles.iconWrapper, { backgroundColor: "#E0F2FE" }]}
                >
                  <MaterialCommunityIcons
                    name="headset"
                    size={22}
                    color="#0284C7"
                  />
                </View>
                <Text style={styles.menuText}>Contact Us / Support</Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color="#94A3B8"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItemLogout}
                onPress={handleLogout}
              >
                <View
                  style={[styles.iconWrapper, { backgroundColor: "#FEF2F2" }]}
                >
                  <MaterialCommunityIcons
                    name="logout"
                    size={22}
                    color="#DC2626"
                  />
                </View>
                <Text style={styles.menuTextLogout}>Sign Out</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setProfileModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
            {/* ✅ REPLACED MODAL WITH REUSABLE COMPONENT */}
      <AuthDialog 
        visible={isGuestDialogVisible} 
        onClose={() => setGuestDialogVisible(false)} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  signedInBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f5e9",
    borderColor: "#2e7d32",
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 30,
    marginTop: 15,
    marginBottom: 5,
    alignSelf: "center", // This centers the pill
    gap: 10, // Space between icon and text
  },
  signedInText: {
    fontSize: 15,
    color: "#1b5e20",
  },
  container: { flex: 1, paddingHorizontal: 15 },
  scrollContainer: { padding: 20, paddingBottom: 30, alignItems: "center" },
  shortSubtext: {
    textAlign: "center",
    color: "#666",
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  statsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 16, // Slightly rounder
    paddingVertical: 20, // More vertical breathing room
    paddingHorizontal: 10,
    alignItems: "center", // ✅ Center everything inside the card
    borderWidth: 1,
    borderColor: "#e9ecef",
    elevation: 2,
    position: "relative",
    overflow: "hidden",
  },
  statValue: {
    fontSize: 26, // Slightly bigger number
    fontWeight: "800",
    color: "#1E293B",
    letterSpacing: -0.5,
    textAlign: "center", // ✅ Center the text
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 4,
    textAlign: "center", // ✅ Center the text
  },
  statCaption: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center", // ✅ Center the text
  },
  card: {
    width: "100%",
    padding: 20,
    backgroundColor: "#ffffff",
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e9ecef",
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
  bottomActionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
  },
  inlineRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  dashboardBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0300a8",
    padding: 14,
    borderRadius: 10,
    gap: 6,
  },
  logoutBtnSmall: {
    width: 55,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc3545",
    padding: 14,
    borderRadius: 10,
  },
  guestLoginBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2ecc71",
    padding: 14,
    borderRadius: 10,
    gap: 6,
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2ecc71",
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  dialogSecondaryBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3498db",
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  dialogLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  dialogLinkText: { fontSize: 14, fontWeight: "600", color: "#e74c3c" },
  profileDialog: {
    width: "100%",
    backgroundColor: "#F4F7FE",
    borderRadius: 24,
    padding: 20,
  },
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
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
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
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  menuText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1E293B" },
  menuTextLogout: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#DC2626",
  },
  closeBtn: { marginTop: 16, alignItems: "center" },
  closeBtnText: { fontSize: 15, fontWeight: "600", color: "#64748B" },
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
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
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
