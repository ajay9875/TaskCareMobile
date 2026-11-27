// app/index.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";

import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AuthDialog from "../components/AuthDialog";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

type TimeGreeting = {
  label: "Good morning" | "Good afternoon" | "Good evening" | "Good night";
  icon:
    | "sunny-outline"
    | "partly-sunny-outline"
    | "moon-outline"
    | "cloudy-night-outline";
  accentColor: string;
};

function getTimeGreeting(date: Date = new Date()): TimeGreeting {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      label: "Good morning",
      icon: "sunny-outline",
      accentColor: "#D97706",
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      label: "Good afternoon",
      icon: "partly-sunny-outline",
      accentColor: "#0284C7",
    };
  }
  if (hour >= 17 && hour < 21) {
    return {
      label: "Good evening",
      icon: "cloudy-night-outline",
      accentColor: "#7C3AED",
    };
  }
  return { label: "Good night", icon: "moon-outline", accentColor: "#1E293B" };
}

export default function LandingScreen() {
  const router = useRouter();
  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

  const hasLoadedSuccessfullyRef = useRef(false);
  const { user, isLoggedIn, checkSession } = useAuth();

  // ✅ Theming
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorType, setErrorType] = useState<"offline" | "server" | null>(null);
  const [hasLoadedSuccessfully, setHasLoadedSuccessfully] = useState(false);
  const [isGuestDialogVisible, setGuestDialogVisible] = useState(false);
  const [greeting, setGreeting] = useState<TimeGreeting>(() =>
    getTimeGreeting(),
  );

  const [publicStats, setPublicStats] = useState<{
    total_users: number;
    total_steps: number;
    tasks_handled: number;
    total_teams: number;
    total_api_calls: number;
    display: {
      total_users: string;
      total_steps: string;
      tasks_handled: string;
      total_teams: string;
      total_api_calls: string;
    };
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
    }, [loadHomeData]),
  );

  const loadHomeData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else if (!hasLoadedSuccessfullyRef.current) setLoading(true);

      setErrorType(null);
      setGreeting(getTimeGreeting());

      try {
        const networkState = await NetInfo.fetch();
        if (
          networkState.isConnected === false ||
          networkState.isInternetReachable === false
        ) {
          setErrorType("offline");
          return;
        }

        if (!API_BASE) throw new Error("API configuration unavailable");

        const res = await fetch(`${API_BASE}/public/stats`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Backend returned status ${res.status}`);

        const data = await res.json();
        if (data.status !== "success")
          throw new Error("Invalid backend response");

        setPublicStats({
          total_users: Number(data.total_users) || 0,
          total_steps: Number(data.total_steps) || 0,
          tasks_handled: Number(data.tasks_handled) || 0,
          total_teams: Number(data.total_teams) || 0,
          total_api_calls: Number(data.total_api_calls) || 0,
          display: {
            total_users:
              data.display?.total_users ?? String(data.total_users ?? 0),
            total_steps:
              data.display?.total_steps ?? String(data.total_steps ?? 0),
            tasks_handled:
              data.display?.tasks_handled ?? String(data.tasks_handled ?? 0),
            total_teams:
              data.display?.total_teams ?? String(data.total_teams ?? 0),
            total_api_calls:
              data.display?.total_api_calls ??
              String(data.total_api_calls ?? 0),
          },
        });

        await checkSession();
        hasLoadedSuccessfullyRef.current = true;
        setHasLoadedSuccessfully(true);
        setErrorType(null);
      } catch (error) {
        console.log("Landing screen loading error:", error);
        setErrorType("server");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [API_BASE, checkSession],
  );

  if (loading && !hasLoadedSuccessfully) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? "#0F172A" : "#1a1a2e",
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color="#4ecca3" />
        <Text style={{ color: "#fff", marginTop: 12 }}>
          Loading FitWisely...
        </Text>
      </View>
    );
  }

  if (errorType && !hasLoadedSuccessfully) {
    const isOffline = errorType === "offline";
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: isDark ? "#0F172A" : "#1a1a2e" }}
      >
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name={isOffline ? "wifi-off" : "cloud-alert-outline"}
            size={76}
            color={isOffline ? "#ff6b35" : "#fbbf24"}
            style={{ marginBottom: 20 }}
          />
          <Text style={styles.errorTitle}>
            {isOffline
              ? "No Internet Connection"
              : "Service Temporarily Unavailable"}
          </Text>
          <Text style={styles.errorSubtext}>
            {isOffline
              ? "Your device is currently offline. Please check your internet connection and try again."
              : "We are currently unable to connect to our servers. Your internet connection may be working, but our service is temporarily unavailable. Please try again later."}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => loadHomeData()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#1a1a2e" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="refresh"
                  size={20}
                  color="#1a1a2e"
                />
                <Text style={styles.retryBtnText}>Try Again</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? "#0F172A" : "#f8f9fa" }}
    >
      {isLoggedIn && (
        <View
          style={[
            styles.signedInBanner,
            isDark && { backgroundColor: "#064E3B", borderColor: "#059669" },
          ]}
        >
          <Ionicons
            name="person-circle"
            size={26}
            color={isDark ? "#6EE7B7" : "#2e7d32"}
          />
          <Text style={[styles.signedInText, isDark && { color: "#D1FAE5" }]}>
            Signed in as{" "}
            <Text style={{ fontWeight: "bold" }}>{user?.name}</Text>
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHomeData(true)}
            tintColor="#4ecca3"
            colors={["#4ecca3"]}
            progressBackgroundColor={isDark ? "#1E293B" : "#ffffff"}
          />
        }
      >
        <View
          style={[
            styles.greetingCard,
            isDark && { backgroundColor: "#1E293B", borderColor: "#334155" },
          ]}
        >
          <View style={styles.greetingTopRow}>
            <Ionicons
              name={greeting.icon}
              size={20}
              color={isDark ? "#F59E0B" : greeting.accentColor}
            />
            <Text style={[styles.greetingText, isDark && { color: "#F8FAFC" }]}>
              {isLoggedIn && user?.name
                ? `${greeting.label}, ${user.name.trim().split(" ")[0]}`
                : greeting.label}
            </Text>
          </View>
          <Text
            style={[styles.greetingSubtext, isDark && { color: "#94A3B8" }]}
          >
            {isLoggedIn
              ? "Ready to check your steps, teams, and daily tasks?"
              : "Track daily steps, team challenges, and tasks effortlessly."}
          </Text>
        </View>

        {/* ⭐ TRUST METRICS */}
        <View style={styles.statsGrid}>
          {publicStats?.total_steps > 0 && (
            <View
              style={[
                styles.statCard,
                { order: 1 },
                isDark && {
                  backgroundColor: "#1E293B",
                  borderColor: "#334155",
                },
              ]}
            >
              <View
                style={[styles.statAccent, { backgroundColor: "#4ecca3" }]}
              />
              <View
                style={[
                  styles.statIconCircle,
                  {
                    backgroundColor: "#4ecca3" + "18",
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    marginBottom: 8,
                  },
                ]}
              >
                <Ionicons name="footsteps-outline" size={18} color="#4ecca3" />
              </View>
              <Text style={[styles.statValue, isDark && { color: "#F8FAFC" }]}>
                {publicStats.display.total_steps}
              </Text>
              <Text style={[styles.statLabel, isDark && { color: "#94A3B8" }]}>
                Steps
              </Text>
              <Text
                style={[styles.statCaption, isDark && { color: "#64748B" }]}
              >
                Tracked
              </Text>
            </View>
          )}

          {publicStats?.total_api_calls > 0 && (
            <View
              style={[
                styles.statCard,
                { order: 2 },
                isDark && {
                  backgroundColor: "#1E293B",
                  borderColor: "#334155",
                },
              ]}
            >
              <View
                style={[styles.statAccent, { backgroundColor: "#8B5CF6" }]}
              />
              <View
                style={[
                  styles.statIconCircle,
                  {
                    backgroundColor: "#8B5CF6" + "18",
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    marginBottom: 8,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="server-network"
                  size={18}
                  color="#8B5CF6"
                />
              </View>
              <Text style={[styles.statValue, isDark && { color: "#F8FAFC" }]}>
                {publicStats.display.total_api_calls}
              </Text>
              <Text style={[styles.statLabel, isDark && { color: "#94A3B8" }]}>
                API Calls
              </Text>
              <Text
                style={[styles.statCaption, isDark && { color: "#64748B" }]}
              >
                Handled
              </Text>
            </View>
          )}

          {publicStats?.total_users > 0 && (
            <View
              style={[
                styles.statCard,
                { order: 3 },
                isDark && {
                  backgroundColor: "#1E293B",
                  borderColor: "#334155",
                },
              ]}
            >
              <View
                style={[styles.statAccent, { backgroundColor: "#0300a8" }]}
              />
              <View
                style={[
                  styles.statIconCircle,
                  {
                    backgroundColor: "#0300a8" + "18",
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    marginBottom: 8,
                  },
                ]}
              >
                <Ionicons name="people-outline" size={18} color="#0300a8" />
              </View>
              <Text style={[styles.statValue, isDark && { color: "#F8FAFC" }]}>
                {publicStats.display.total_users}
              </Text>
              <Text style={[styles.statLabel, isDark && { color: "#94A3B8" }]}>
                Users
              </Text>
              <Text
                style={[styles.statCaption, isDark && { color: "#64748B" }]}
              >
                Registered
              </Text>
            </View>
          )}

          {publicStats?.total_teams > 0 && (
            <View
              style={[
                styles.statCard,
                { order: 4 },
                isDark && {
                  backgroundColor: "#1E293B",
                  borderColor: "#334155",
                },
              ]}
            >
              <View
                style={[styles.statAccent, { backgroundColor: "#0EA5E9" }]}
              />
              <View
                style={[
                  styles.statIconCircle,
                  {
                    backgroundColor: "#0EA5E9" + "18",
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    marginBottom: 8,
                  },
                ]}
              >
                <Ionicons name="people" size={18} color="#0EA5E9" />
              </View>
              <Text style={[styles.statValue, isDark && { color: "#F8FAFC" }]}>
                {publicStats.display.total_teams}
              </Text>
              <Text style={[styles.statLabel, isDark && { color: "#94A3B8" }]}>
                Teams
              </Text>
              <Text
                style={[styles.statCaption, isDark && { color: "#64748B" }]}
              >
                Active
              </Text>
            </View>
          )}

          {publicStats?.tasks_handled > 0 && (
            <View
              style={[
                styles.statCard,
                { order: 5 },
                isDark && {
                  backgroundColor: "#1E293B",
                  borderColor: "#334155",
                },
              ]}
            >
              <View
                style={[styles.statAccent, { backgroundColor: "#e67e22" }]}
              />
              <View
                style={[
                  styles.statIconCircle,
                  {
                    backgroundColor: "#e67e22" + "18",
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    marginBottom: 8,
                  },
                ]}
              >
                <Ionicons name="briefcase-outline" size={18} color="#e67e22" />
              </View>
              <Text style={[styles.statValue, isDark && { color: "#F8FAFC" }]}>
                {publicStats.display.tasks_handled}
              </Text>
              <Text style={[styles.statLabel, isDark && { color: "#94A3B8" }]}>
                Tasks
              </Text>
              <Text
                style={[styles.statCaption, isDark && { color: "#64748B" }]}
              >
                Managed
              </Text>
            </View>
          )}

          <View
            style={[
              styles.statCard,
              { order: 6 },
              isDark && { backgroundColor: "#1E293B", borderColor: "#334155" },
            ]}
          >
            <View style={[styles.statAccent, { backgroundColor: "#2ecc71" }]} />
            <View
              style={[
                styles.statIconCircle,
                {
                  backgroundColor: "#2ecc71" + "18",
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  marginBottom: 8,
                },
              ]}
            >
              <Ionicons name="shield-checkmark" size={18} color="#2ecc71" />
            </View>
            <Text style={[styles.statValue, isDark && { color: "#F8FAFC" }]}>
              100%
            </Text>
            <Text style={[styles.statLabel, isDark && { color: "#94A3B8" }]}>
              Safe
            </Text>
            <Text style={[styles.statCaption, isDark && { color: "#64748B" }]}>
              Encrypted
            </Text>
          </View>
        </View>

        {/* Fitness Tracker Card */}
        <View
          style={[
            styles.card,
            isDark && { backgroundColor: "#1E293B", borderColor: "#334155" },
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons
              name="fitness"
              size={24}
              color="#4ecca3"
              style={styles.cardIcon}
            />
            <Text style={[styles.cardTitle, isDark && { color: "#F8FAFC" }]}>
              Fitness Tracker
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons
              name="footsteps"
              size={18}
              color={isDark ? "#94A3B8" : "#555"}
            />
            <Text style={[styles.featureText, isDark && { color: "#CBD5E1" }]}>
              Real-time Step Counter – Track your steps dynamically on screen.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons
              name="speedometer"
              size={18}
              color={isDark ? "#94A3B8" : "#555"}
            />
            <Text style={[styles.featureText, isDark && { color: "#CBD5E1" }]}>
              Pace & Distance – Automatically calculates your walking speed and
              distance.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons
              name="sync-circle"
              size={18}
              color={isDark ? "#94A3B8" : "#555"}
            />
            <Text style={[styles.featureText, isDark && { color: "#CBD5E1" }]}>
              Auto-Sync Metrics – Saves records to the database seamlessly in
              the background.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons
              name="time"
              size={18}
              color={isDark ? "#94A3B8" : "#555"}
            />
            <Text style={[styles.featureText, isDark && { color: "#CBD5E1" }]}>
              Daily fitness summary via email.
            </Text>
          </View>
        </View>

        {/* How to use Fitness Tracker */}
        <View style={styles.stepsBox}>
          <Text style={[styles.stepsTitle, isDark && { color: "#F8FAFC" }]}>
            How to use the Fitness Tracker:
          </Text>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="shield-check"
              size={20}
              color="#4ecca3"
            />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              1. Grant physical activity permission when prompted.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons name="walk" size={20} color="#4ecca3" />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              2. Head to the tracking screen to start walking and tracking your
              steps.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <Ionicons name="phone-portrait-outline" size={20} color="#4ecca3" />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
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
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              4. On Android, set battery to "Unrestricted" for accurate tracking
              in the background.
            </Text>
          </View>

          <View
            style={[
              styles.warningBox,
              isDark && { backgroundColor: "#422006", borderColor: "#78350F" },
            ]}
          >
            <View style={styles.warningHeader}>
              <Ionicons
                name="warning"
                size={20}
                color={isDark ? "#FCD34D" : "#B45309"}
              />
              <Text
                style={[styles.warningTitle, isDark && { color: "#FCD34D" }]}
              >
                Important
              </Text>
            </View>
            <Text style={[styles.warningText, isDark && { color: "#FDE68A" }]}>
              <Text style={{ fontWeight: "800" }}>Do NOT log out</Text> during
              the day. Logging out stops the native step tracker and clears your
              local queue — any unsynced steps and today's progress will be lost
              and cannot be recovered.
            </Text>
            <Text style={[styles.warningText, isDark && { color: "#FDE68A" }]}>
              If you must sign out, first open the Fitness Tracker screen and
              wait for the 10secs to sync and save your current progress.
            </Text>
          </View>
        </View>

        {/* Teams & Leaderboards Card */}
        <View
          style={[
            styles.card,
            isDark && { backgroundColor: "#1E293B", borderColor: "#334155" },
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons
              name="people"
              size={24}
              color="#4ecca3"
              style={styles.cardIcon}
            />
            <Text style={[styles.cardTitle, isDark && { color: "#F8FAFC" }]}>
              Teams & Leaderboards
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons
              name="add-circle"
              size={18}
              color={isDark ? "#94A3B8" : "#555"}
            />
            <Text style={[styles.featureText, isDark && { color: "#CBD5E1" }]}>
              Create Teams – Build your own step challenge groups.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons
              name="link"
              size={18}
              color={isDark ? "#94A3B8" : "#555"}
            />
            <Text style={[styles.featureText, isDark && { color: "#CBD5E1" }]}>
              Join with Code – Invite friends using a simple join code.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons
              name="trophy"
              size={18}
              color={isDark ? "#94A3B8" : "#555"}
            />
            <Text style={[styles.featureText, isDark && { color: "#CBD5E1" }]}>
              Live Leaderboard – Compete on daily step counts in real time.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons
              name="share-social"
              size={18}
              color={isDark ? "#94A3B8" : "#555"}
            />
            <Text style={[styles.featureText, isDark && { color: "#CBD5E1" }]}>
              Share Invites – Send one-tap join links via any messenger.
            </Text>
          </View>
        </View>

        {/* How to use Teams */}
        <View style={styles.stepsBox}>
          <Text style={[styles.stepsTitle, isDark && { color: "#F8FAFC" }]}>
            How to create a Team:
          </Text>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="account-group"
              size={20}
              color="#4ecca3"
            />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              1. Log in and open the "Teams" tab from the bottom menu.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <Ionicons name="add-circle-outline" size={20} color="#4ecca3" />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              2. Tap the "+ Add / Join" pill at the top.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="pencil-outline"
              size={20}
              color="#4ecca3"
            />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              3. Enter a team name under "Create a Team" and tap Create.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons name="crown" size={20} color="#4ecca3" />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              4. You become the admin and receive a unique join code.
            </Text>
          </View>
        </View>

        <View style={styles.stepsBox}>
          <Text style={[styles.stepsTitle, isDark && { color: "#F8FAFC" }]}>
            How to use a Team:
          </Text>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="share-variant"
              size={20}
              color="#4ecca3"
            />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              1. Tap "Invite" to share the join code or link with friends.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <Ionicons name="enter-outline" size={20} color="#4ecca3" />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              2. Friends open Teams → "+ Add / Join" → enter the code → Join.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <Ionicons name="podium-outline" size={20} color="#4ecca3" />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              3. Daily steps rank automatically — tap any member for history.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="shield-account"
              size={20}
              color="#4ecca3"
            />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              4. Admins can rename, remove members, or delete the team.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="swap-horizontal"
              size={20}
              color="#4ecca3"
            />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              5. Join up to 10 teams — tap any pill to switch between them.
            </Text>
          </View>
        </View>

        {/* Task Manager Card */}
        <View
          style={[
            styles.card,
            isDark && { backgroundColor: "#1E293B", borderColor: "#334155" },
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons
              name="clipboard"
              size={24}
              color="#4ecca3"
              style={styles.cardIcon}
            />
            <Text style={[styles.cardTitle, isDark && { color: "#F8FAFC" }]}>
              Task Manager
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons
              name="create"
              size={18}
              color={isDark ? "#94A3B8" : "#555"}
            />
            <Text style={[styles.featureText, isDark && { color: "#CBD5E1" }]}>
              Easy Task Management – Add, edit, and delete items cleanly.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons
              name="mail"
              size={18}
              color={isDark ? "#94A3B8" : "#555"}
            />
            <Text style={[styles.featureText, isDark && { color: "#CBD5E1" }]}>
              Daily Email Reminders – Stay on track with pending obligations.
            </Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons
              name="cloud-upload"
              size={18}
              color={isDark ? "#94A3B8" : "#555"}
            />
            <Text style={[styles.featureText, isDark && { color: "#CBD5E1" }]}>
              Secure Cloud Backups – Never lose your data layout updates.
            </Text>
          </View>
        </View>

        {/* How to manage Tasks */}
        <View style={styles.stepsBox}>
          <Text style={[styles.stepsTitle, isDark && { color: "#F8FAFC" }]}>
            How to manage your Tasks:
          </Text>
          <View style={styles.stepRow}>
            <Ionicons name="log-in-outline" size={20} color="#4ecca3" />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              1. Tap "Get Started" or log into your account.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <Ionicons name="add-circle-outline" size={20} color="#4ecca3" />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              2. Click on "+Add" to insert new tasks.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="checkbox-marked-circle-outline"
              size={20}
              color="#4ecca3"
            />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              3. Check them off as completed.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="pencil-outline"
              size={20}
              color="#4ecca3"
            />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              4. Edit tasks anytime using the pencil icon.
            </Text>
          </View>
          <View style={styles.stepRow}>
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={20}
              color="#4ecca3"
            />
            <Text style={[styles.stepText, isDark && { color: "#CBD5E1" }]}>
              5. Delete tasks permanently using the trash icon.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomActionContainer,
          isDark && { backgroundColor: "#1E293B", borderTopColor: "#334155" },
        ]}
      >
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

      <AuthDialog
        visible={isGuestDialogVisible}
        onClose={() => setGuestDialogVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  greetingCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  greetingTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  greetingText: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1E293B",
    letterSpacing: -0.3,
  },
  greetingSubtext: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 18,
  },
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
  warningTitle: { fontSize: 14, fontWeight: "800", color: "#B45309" },
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
    alignSelf: "center",
    gap: 10,
  },
  signedInText: { fontSize: 15, color: "#1b5e20" },
  container: { flex: 1, paddingHorizontal: 15 },
  scrollContainer: { padding: 20, paddingBottom: 30, alignItems: "center" },
  statsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    width: "31.5%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e9ecef",
    elevation: 2,
    position: "relative",
    overflow: "hidden",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
  statCaption: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
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
    width: "100%",
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
