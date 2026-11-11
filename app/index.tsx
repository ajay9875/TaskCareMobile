// app/index.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AuthDialog from "../components/AuthDialog";
import { useAuth } from "../context/AuthContext";

export default function LandingScreen() {
  const router = useRouter();
  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

  const { user, isLoggedIn, checkSession } = useAuth();

  const [loading, setLoading] = useState(true);
  const [hasNetError, setHasNetError] = useState(false);
  const [isGuestDialogVisible, setGuestDialogVisible] = useState(false);

  // AFTER
  const [publicStats, setPublicStats] = useState<{
    total_users: number;
    total_steps: number;
    tasks_handled: number;
    display: {
      total_users: string;
      total_steps: string;
      tasks_handled: string;
    };
  } | null>(null);

  const fetchPublicStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/public/stats`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "success") {
        // AFTER
        setPublicStats({
          total_users: Number(data.total_users) || 0,
          total_steps: Number(data.total_steps) || 0,
          tasks_handled: Number(data.tasks_handled) || 0,
          display: {
            total_users:
              data.display?.total_users ?? String(data.total_users ?? 0),
            total_steps:
              data.display?.total_steps ?? String(data.total_steps ?? 0),
            tasks_handled:
              data.display?.tasks_handled ?? String(data.tasks_handled ?? 0),
          },
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

        {/* ⭐ TRUST METRICS */}
        <View style={styles.statsGrid}>
          {/* Only render if value > 0 */}
          {publicStats?.tasks_handled > 0 && (
            <View
              style={[
                styles.statCard,
                publicStats?.total_steps === 0 &&
                  publicStats?.total_users === 0 &&
                  styles.statCardFullWidth,
              ]}
            >
              <View
                style={[styles.statAccent, { backgroundColor: "#e67e22" }]}
              />
              <View
                style={[
                  styles.statIconCircle,
                  { backgroundColor: "#e67e22" + "18" },
                ]}
              >
                <Ionicons name="briefcase-outline" size={22} color="#e67e22" />
              </View>
              <Text style={styles.statValue}>
                {publicStats.display.tasks_handled}
              </Text>
              <Text style={styles.statLabel}>Tasks Managed</Text>
              <Text style={styles.statCaption}>Lifetime</Text>
            </View>
          )}

          {publicStats?.total_steps > 0 && (
            <View
              style={[
                styles.statCard,
                !publicStats?.tasks_handled &&
                  publicStats?.total_users === 0 &&
                  styles.statCardFullWidth,
              ]}
            >
              <View
                style={[styles.statAccent, { backgroundColor: "#4ecca3" }]}
              />
              <View
                style={[
                  styles.statIconCircle,
                  { backgroundColor: "#4ecca3" + "18" },
                ]}
              >
                <Ionicons name="footsteps-outline" size={22} color="#4ecca3" />
              </View>
              <Text style={styles.statValue}>
                {publicStats.display.total_steps}
              </Text>
              <Text style={styles.statLabel}>Steps</Text>
              <Text style={styles.statCaption}>Tracked</Text>
            </View>
          )}

          {publicStats?.total_users > 0 && (
            <View
              style={[
                styles.statCard,
                !publicStats?.tasks_handled &&
                  !publicStats?.total_steps &&
                  styles.statCardFullWidth,
              ]}
            >
              <View
                style={[styles.statAccent, { backgroundColor: "#0300a8" }]}
              />
              <View
                style={[
                  styles.statIconCircle,
                  { backgroundColor: "#0300a8" + "18" },
                ]}
              >
                <Ionicons name="people-outline" size={22} color="#0300a8" />
              </View>
              <Text style={styles.statValue}>
                {publicStats.display.total_users}
              </Text>
              <Text style={styles.statLabel}>Users</Text>
              <Text style={styles.statCaption}>Registered</Text>
            </View>
          )}

          {/* ✅ Safe & Secure is always visible */}
          <View
            style={[
              styles.statCard,
              !publicStats?.tasks_handled &&
                !publicStats?.total_steps &&
                !publicStats?.total_users &&
                styles.statCardFullWidth,
            ]}
          >
            <View style={[styles.statAccent, { backgroundColor: "#2ecc71" }]} />
            <View
              style={[
                styles.statIconCircle,
                { backgroundColor: "#2ecc71" + "18" },
              ]}
            >
              <Ionicons name="shield-checkmark" size={22} color="#2ecc71" />
            </View>
            <Text style={styles.statValue}>100%</Text>
            <Text style={styles.statLabel}>Safe & Secure</Text>
            <Text style={styles.statCaption}>Encrypted</Text>
          </View>
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
              2. Head to the tracking screen and select your mode (Walking or
              Treadmill).
            </Text>
          </View>
          <View style={styles.stepRow}>
            <Ionicons name="phone-portrait-outline" size={20} color="#4ecca3" />
            <Text style={styles.stepText}>
              3. Keep the app running in the background; steps sync
              automatically.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="battery-charging"
              size={20}
              color="#4ecca3"
            />
            <Text style={styles.stepText}>
              4. On Android, set battery to "Unrestricted" for accurate tracking
              in the background.
            </Text>
          </View>

          {/* ⚠️ Warning box — do not log out */}
          <View style={styles.warningBox}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={20} color="#B45309" />
              <Text style={styles.warningTitle}>Important</Text>
            </View>
            <Text style={styles.warningText}>
              <Text style={{ fontWeight: "800" }}>Do NOT log out</Text> during
              the day. Logging out stops the native step tracker and clears your
              local queue — any unsynced steps and today's progress will be lost
              and cannot be recovered.
            </Text>
            <Text style={styles.warningText}>
              If you must sign out, first open the Fitness Tracker screen and
              wait for the sync indicator to show all steps are saved.
            </Text>
          </View>
        </View>

        {/* ✅ NEW: Teams feature card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="people"
              size={24}
              color="#4ecca3"
              style={styles.cardIcon}
            />
            <Text style={styles.cardTitle}>Teams & Leaderboards</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="add-circle" size={18} color="#555" />
            <Text style={styles.featureText}>
              Create Teams – Build your own step challenge groups.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="link" size={18} color="#555" />
            <Text style={styles.featureText}>
              Join with Code – Invite friends using a simple join code.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="trophy" size={18} color="#555" />
            <Text style={styles.featureText}>
              Live Leaderboard – Compete on daily step counts in real time.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons name="share-social" size={18} color="#555" />
            <Text style={styles.featureText}>
              Share Invites – Send one-tap join links via any messenger.
            </Text>
          </View>
        </View>

        {/* ✅ NEW: Teams how-to block */}
        <View style={styles.stepsBox}>
          <Text style={styles.stepsTitle}>How to create a Team:</Text>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="account-group"
              size={20}
              color="#4ecca3"
            />
            <Text style={styles.stepText}>
              1. Log in and open the "Teams" tab from the bottom menu.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <Ionicons name="add-circle-outline" size={20} color="#4ecca3" />
            <Text style={styles.stepText}>
              2. Tap the "+ Add / Join" pill at the top.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="pencil-outline"
              size={20}
              color="#4ecca3"
            />
            <Text style={styles.stepText}>
              3. Enter a team name under "Create a Team" and tap Create.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons name="crown" size={20} color="#4ecca3" />
            <Text style={styles.stepText}>
              4. You become the admin and receive a unique join code.
            </Text>
          </View>
        </View>

        <View style={styles.stepsBox}>
          <Text style={styles.stepsTitle}>How to use a Team:</Text>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="share-variant"
              size={20}
              color="#4ecca3"
            />
            <Text style={styles.stepText}>
              1. Tap "Invite" to share the join code or link with friends.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <Ionicons name="enter-outline" size={20} color="#4ecca3" />
            <Text style={styles.stepText}>
              2. Friends open Teams → "+ Add / Join" → enter the code → Join.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <Ionicons name="podium-outline" size={20} color="#4ecca3" />
            <Text style={styles.stepText}>
              3. Daily steps rank automatically — tap any member for history.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="shield-account"
              size={20}
              color="#4ecca3"
            />
            <Text style={styles.stepText}>
              4. Admins can rename, remove members, or delete the team.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="swap-horizontal"
              size={20}
              color="#4ecca3"
            />
            <Text style={styles.stepText}>
              5. Join up to 10 teams — tap any pill to switch between them.
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
              2. Click on "+Add" to insert new tasks.
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
          <TouchableOpacity
            style={styles.dashboardBtn}
            onPress={() => router.push("/dashboard")}
          >
            <Ionicons name="speedometer-outline" size={20} color="#fff" />
            <Text style={styles.btnText}>Go to Dashboard</Text>
          </TouchableOpacity>
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

      {/* ✅ REPLACED MODAL WITH REUSABLE COMPONENT */}
      <AuthDialog
        visible={isGuestDialogVisible}
        onClose={() => setGuestDialogVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  warningBox: {
    width: "100%",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#B45309",
  },
  warningText: {
    fontSize: 13,
    color: "#78350F",
    lineHeight: 19,
    marginBottom: 4,
  },
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
  statCardFullWidth: {
    width: "100%", // ✅ Takes up the entire row
    paddingVertical: 30, // Extra padding to look nice and big
    alignItems: "center",
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
  dashboardBtn: {
    width: "100%", // ✅ Change flex: 1 to width: 100%
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0300a8",
    padding: 14,
    borderRadius: 10,
    gap: 6,
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
