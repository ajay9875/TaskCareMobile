// app/admin.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  getAdminColors,
  getAdminStyles,
  statusColorFor,
  type AdminColors,
} from "../utils/adminTheme";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
const ONLINE_WINDOW_MS = 15 * 1000;
const MAX_TEAMS = 10;

const AVATAR_COLORS = [
  "#4F46E5",
  "#0284C7",
  "#DC2626",
  "#D97706",
  "#7C3AED",
  "#16A34A",
  "#DB2777",
  "#EA580C",
];

function colorForUser(id: number): string {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

// ── ROLE HELPERS (Strictly Super Admin / Admin only) ──
function isSuperAdminUser(u: AdminUser): boolean {
  const role = (u.role ?? "").toLowerCase();
  return (
    !!u.is_superadmin ||
    !!u.is_super_admin ||
    role === "superadmin" ||
    role === "super_admin"
  );
}

function isAdminUser(u: AdminUser): boolean {
  const role = (u.role ?? "").toLowerCase();
  return !!u.is_admin || isSuperAdminUser(u) || role === "admin";
}

// ── Presence helpers ──
function isOnlineMember(m: any): boolean {
  if (!m?.last_seen) return false;
  const raw: string = m.last_seen;
  const withTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}+05:30`;
  const t = Date.parse(withTz);
  if (isNaN(t)) return false;
  return Date.now() - t <= ONLINE_WINDOW_MS;
}

function teamOnlineCount(team: any): number {
  return (team?.members ?? []).filter(isOnlineMember).length;
}

function teamSignedInCount(team: any): number {
  return (team?.members ?? []).filter((m: any) => !!m.is_signed_in).length;
}

type AdminUser = {
  id: number;
  name: string;
  email: string;
  target_steps: number;
  steps_today?: number;
  state: "online" | "offline" | "never" | "signed_out";
  last_seen: string | null;
  label: string;
  is_signed_in?: boolean;
  last_status_change?: string | null;
  created_at_label?: string;

  is_superadmin?: boolean;
  is_super_admin?: boolean;
  is_admin?: boolean;
  role?: string;
};

type AdminTeam = {
  id: number;
  name: string;
  join_code: string;
  created_by: string;
  created_at_label: string;
  member_count: number;
  online_member_count?: number;
  signed_in_member_count?: number;
  is_admin?: boolean;
  members?: any[];
};

/* ------------------------------------------------------------------ */
/* Screen-specific styles (shared ones live in utils/adminTheme.ts)    */
/* ------------------------------------------------------------------ */
function createStyles(c: AdminColors, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 5 },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: c.text,
      marginTop: 8,
    },
    pinSubtitle: { textAlign: "center", color: c.muted, marginBottom: 20 },
    pinInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingRight: 10,
    },
    pinInput: {
      flex: 1,
      padding: 15,
      fontSize: 20,
      textAlign: "center",
      letterSpacing: 5,
      color: c.text,
    },
    eyeIcon: { padding: 5 },
    unlockBtn: {
      backgroundColor: c.purpleBtn,
      padding: 15,
      borderRadius: 10,
      marginTop: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    unlockBtnDisabled: { backgroundColor: c.disabledBtn },
    unlockBtnText: {
      color: "#fff",
      textAlign: "center",
      fontWeight: "bold",
      fontSize: 16,
    },

    // Tabs
    tabTrack: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginTop: 10,
      backgroundColor: c.tabTrack,
      borderRadius: 10,
      padding: 4,
    },
    tab: { flex: 1, padding: 10, alignItems: "center", borderRadius: 8 },
    tabActive: { backgroundColor: c.tabActive },
    tabText: { fontWeight: "bold", color: c.muted },
    tabTextActive: { color: c.text },

    // Stats
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 12,
      paddingHorizontal: 8,
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 4,
    },
    statItem: { flex: 1, alignItems: "center", gap: 2 },
    statValue: { fontSize: 16, fontWeight: "800", color: c.text },
    statLabel: { fontSize: 10, fontWeight: "600", color: c.muted },
    statDivider: { width: 1, height: 30, backgroundColor: c.border },

    // Team switcher
    switcherContainer: { marginBottom: 10, marginTop: 6 },
    switcherScroll: { gap: 10, paddingVertical: 10, paddingHorizontal: 4 },
    teamPill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.pillBg,
    },
    teamPillActive: { backgroundColor: c.primary },
    teamPillText: { fontSize: 14, fontWeight: "600", color: c.pillText },
    teamPillTextActive: { color: "#fff" },
    addTeamPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.addPillBg,
      borderWidth: 1,
      borderColor: c.addPillBorder,
    },
    addTeamPillActive: { backgroundColor: c.primary, borderColor: c.primary },
    addTeamPillText: {
      fontSize: 14,
      fontWeight: "600",
      color: c.primaryIcon,
      marginLeft: 4,
    },

    teamStatsCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 10,
      paddingHorizontal: 6,
      marginBottom: 10,
      gap: 8,
      marginHorizontal: 16,
    },
    teamStatsRowInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    teamStatItem: { flex: 1, alignItems: "center", gap: 2 },
    teamStatValue: { fontSize: 15, fontWeight: "800", color: c.text },
    teamStatLabel: { fontSize: 10, fontWeight: "600", color: c.muted },
    teamStatDivider: { width: 1, height: 28, backgroundColor: c.border },

    // Rows
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingVertical: 10,
      paddingLeft: 14,
      paddingRight: 8,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
      elevation: isDark ? 0 : 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.05,
      shadowRadius: 3,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    rowText: { flex: 1, minWidth: 0 },
    rowName: { fontSize: 16, fontWeight: "700", color: c.text },
    rowEmail: { fontSize: 13, color: c.textSoft, marginTop: 1 },
    rowMeta: {
      fontSize: 11,
      color: c.faint,
      marginTop: 4,
      fontWeight: "600",
    },
    userNameRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },
    userRankRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 6,
      marginBottom: 2,
      flexWrap: "wrap",
    },
    userStepsText: { fontSize: 11, fontWeight: "600", color: c.muted },
    actionsWrap: {
      alignItems: "center",
      gap: 10,
      paddingLeft: 6,
      paddingRight: 6,
    },
    actionWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 10,
      paddingLeft: 6,
      paddingRight: 6,
    },

    // Add-to-team list
    teamSelectRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
      marginBottom: 8,
    },
    teamSelectRowActive: {
      borderColor: c.info,
      backgroundColor: c.selectActiveBg,
    },
    teamSelectName: { fontSize: 14, fontWeight: "700", color: c.text },
    teamSelectMeta: { fontSize: 11, color: c.muted, marginTop: 2 },
    noTeamsText: {
      textAlign: "center",
      color: c.faint,
      paddingVertical: 20,
    },

    emptyBlock: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      gap: 8,
    },
    emptyText: { color: c.faint, fontSize: 14, fontWeight: "600" },
  });
}

const lightScreenStyles = createStyles(getAdminColors(false), false);
const darkScreenStyles = createStyles(getAdminColors(true), true);

function StatusPill({
  state,
  label,
  isSignedIn,
}: {
  state?: string;
  label?: string;
  isSignedIn?: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const c = getAdminColors(isDark);
  const shared = getAdminStyles(isDark);

  const color = statusColorFor(c, state);
  const signedInColor = isSignedIn ? c.success : c.danger;

  return (
    <View style={shared.pillRow}>
      <View style={shared.statusPill}>
        <View style={[shared.statusDot, { backgroundColor: color }]} />
        <Text style={[shared.statusPillText, { color }]} numberOfLines={1}>
          {label ?? "Not active yet"}
        </Text>
      </View>
      <View style={shared.statusPill}>
        <View style={[shared.statusDot, { backgroundColor: signedInColor }]} />
        <Text
          style={[shared.statusPillText, { color: signedInColor }]}
          numberOfLines={1}
        >
          {isSignedIn ? "Signed In" : "Signed Out"}
        </Text>
      </View>
    </View>
  );
}

export default function AdminPanel() {
  const router = useRouter();
  const { user, isAdmin, isLoggedIn } = useAuth();

  // Theme
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const c = getAdminColors(isDark);
  const shared = getAdminStyles(isDark);
  const styles = isDark ? darkScreenStyles : lightScreenStyles;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-to-team modal
  const [addToTeamVisible, setAddToTeamVisible] = useState(false);
  const [addToTeamUser, setAddToTeamUser] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [addToTeamSelected, setAddToTeamSelected] = useState<number | null>(
    null,
  );
  const [isAddingToTeam, setIsAddingToTeam] = useState(false);

  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<number | null>(null);

  // Super Admin State
  const [isVerified, setIsVerified] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "teams">("users");

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  // Delete Confirmation Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "user" | "team";
    id: number;
    name: string;
    extraInfo: string;
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // 60s ticker — re-evaluates online pills
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) || null,
    [teams, selectedTeamId],
  );

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      if (a.is_admin && !b.is_admin) return -1;
      if (!a.is_admin && b.is_admin) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [teams]);

  // SORTED USERS: you first, other super admins next, then alphabetical
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aIsYou = Number(user?.id) === Number(a.id);
      const bIsYou = Number(user?.id) === Number(b.id);

      if (aIsYou && !bIsYou) return -1;
      if (!aIsYou && bIsYou) return 1;

      const aIsSuperAdmin = isSuperAdminUser(a);
      const bIsSuperAdmin = isSuperAdminUser(b);

      if (aIsSuperAdmin && !bIsSuperAdmin) return -1;
      if (!aIsSuperAdmin && bIsSuperAdmin) return 1;

      return (a.name || "").localeCompare(b.name || "", undefined, {
        sensitivity: "base",
      });
    });
  }, [users, user?.id]);

  // ── Global rollups ──
  function allTeamsOnlineCount(): number {
    const uniqueUsers = new Set();
    teams.forEach((t) => {
      (t.members ?? []).forEach((m: any) => {
        if (isOnlineMember(m)) uniqueUsers.add(m.user_id);
      });
    });
    return uniqueUsers.size;
  }

  function allTeamsMemberCount(): number {
    return teams.reduce(
      (sum, t) => sum + (t.members?.length ?? t.member_count ?? 0),
      0,
    );
  }

  function allTeamsSignedInCount(): number {
    const uniqueUsers = new Set();
    teams.forEach((t) => {
      (t.members ?? []).forEach((m: any) => {
        if (m.is_signed_in) uniqueUsers.add(m.user_id);
      });
    });
    return uniqueUsers.size;
  }

  const teamCount = teams.length;
  const adminTeamCount = teams.filter((t) => t.is_admin).length;

  const userStats = useMemo(() => {
    const totalUsers = users.length;
    const onlineUsers = users.filter((u) => u.state === "online").length;
    const signedInUsers = users.filter((u) => !!u.is_signed_in).length;
    return { totalUsers, onlineUsers, signedInUsers };
  }, [users]);

  const openDeleteModal = (
    type: "user" | "team",
    item: AdminUser | AdminTeam,
  ) => {
    setDeleteConfirmText("");
    if (type === "user") {
      const u = item as AdminUser;
      setDeleteTarget({
        type: "user",
        id: u.id,
        name: u.name,
        extraInfo: u.email,
      });
    } else {
      const t = item as AdminTeam;
      setDeleteTarget({
        type: "team",
        id: t.id,
        name: t.name,
        extraInfo: `${t.member_count} members`,
      });
    }
    setDeleteModalVisible(true);
  };

  const executeDelete = async () => {
    if (!deleteTarget || deleteConfirmText !== "DELETE") return;

    setDeleteModalVisible(false);

    if (deleteTarget.type === "user") {
      setDeletingUserId(deleteTarget.id);
      try {
        const res = await fetch(`${API_BASE}/admin/users/${deleteTarget.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.status === 401) {
          router.replace("/login?sessionExpired=true");
          return;
        }
        if (res.status === 403) {
          Alert.alert("Access Denied", "You do not have admin privileges.");
          router.replace("/");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          Alert.alert(
            "Delete failed",
            data?.error || data?.message || "Unknown error",
          );
          return;
        }
        setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      } catch {
        Alert.alert("Error", "Network error while deleting user.");
      } finally {
        setDeletingUserId(null);
      }
    } else {
      setDeletingTeamId(deleteTarget.id);
      try {
        const res = await fetch(
          `${API_BASE}/superadmin/teams/${deleteTarget.id}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );
        if (res.status === 401) {
          router.replace("/login?sessionExpired=true");
          return;
        }
        if (res.status === 403) {
          Alert.alert("Access Denied", "Super Admin access required.");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          Alert.alert(
            "Delete failed",
            data?.error || data?.message || "Unknown error",
          );
          return;
        }
        setTeams((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      } catch {
        Alert.alert("Error", "Network error while deleting team.");
      } finally {
        setDeletingTeamId(null);
      }
    }
  };

  const openAddToTeam = (userId: number, userName: string) => {
    setAddToTeamUser({ id: userId, name: userName });
    setAddToTeamSelected(null);
    setAddToTeamVisible(true);
  };

  const executeAddToTeam = async () => {
    if (!addToTeamUser || !addToTeamSelected) return;
    setIsAddingToTeam(true);
    try {
      const res = await fetch(
        `${API_BASE}/superadmin/teams/${addToTeamSelected}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ user_id: addToTeamUser.id }),
        },
      );
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        Alert.alert(
          "Added",
          `${addToTeamUser.name} added to the selected team.`,
        );
        setAddToTeamVisible(false);
        fetchData(); // refresh both lists
      } else {
        Alert.alert(
          "Error",
          data.error || data.message || "Failed to add user to team",
        );
      }
    } catch {
      Alert.alert("Error", "Network error");
    } finally {
      setIsAddingToTeam(false);
    }
  };

  const verifyPin = async () => {
    if (pin.length !== 6) return;
    setIsVerifying(true);

    try {
      const res = await fetch(`${API_BASE}/admin/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        setIsVerified(true);
        fetchData();
      } else {
        Alert.alert("Error", "Invalid Super Admin PIN");
        setPin("");
      }
    } catch {
      Alert.alert("Error", "Network error");
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const uRes = await fetch(`${API_BASE}/admin/users`, {
        credentials: "include",
      });
      const uData = await uRes.json().catch(() => ({}));
      if (uData.status === "success") setUsers(uData.users);

      const tRes = await fetch(`${API_BASE}/superadmin/teams`, {
        credentials: "include",
      });
      if (tRes.ok) {
        const tData = await tRes.json().catch(() => ({}));
        setTeams(tData.teams ?? []);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isLoggedIn]);

  const refreshControl = (
    <RefreshControl
      refreshing={loading}
      onRefresh={fetchData}
      tintColor={c.primaryIcon}
      colors={[c.primary]}
      progressBackgroundColor={c.surface}
    />
  );

  // ─── PIN SCREEN ───
  if (!isVerified) {
    const isPinComplete = pin.length === 6;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={refreshControl}
        >
          <View style={{ padding: 20, marginTop: 50 }}>
            <MaterialCommunityIcons
              name="shield-lock"
              size={60}
              color={c.purple}
              style={{ alignSelf: "center" }}
            />
            <Text style={[styles.headerTitle, { textAlign: "center" }]}>
              Super Admin Access
            </Text>
            <Text style={styles.pinSubtitle}>
              Enter 6-digit PIN to unlock Teams and User Management
            </Text>

            <View style={styles.pinInputWrapper}>
              <TextInput
                style={styles.pinInput}
                placeholder="••••••"
                placeholderTextColor={c.faint}
                keyboardType="number-pad"
                keyboardAppearance={isDark ? "dark" : "light"}
                secureTextEntry={!showPin}
                maxLength={6}
                value={pin}
                onChangeText={setPin}
                editable={!isVerifying}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPin(!showPin)}
              >
                <Ionicons
                  name={showPin ? "eye-off-outline" : "eye-outline"}
                  size={24}
                  color={c.muted}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={verifyPin}
              disabled={!isPinComplete || isVerifying}
              style={[
                styles.unlockBtn,
                (!isPinComplete || isVerifying) && styles.unlockBtnDisabled,
              ]}
            >
              {isVerifying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.unlockBtnText}>Unlock</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (loading && users.length === 0 && teams.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={c.primaryIcon} />
      </View>
    );
  }

  // ─── MAIN ADMIN DASHBOARD ───
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={refreshControl}
      >
        {/* Tab Selector */}
        <View style={styles.tabTrack}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "users" && styles.tabActive]}
            onPress={() => {
              setActiveTab("users");
              setSelectedTeamId(null);
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "users" && styles.tabTextActive,
              ]}
            >
              Users ({users.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "teams" && styles.tabActive]}
            onPress={() => setActiveTab("teams")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "teams" && styles.tabTextActive,
              ]}
            >
              Teams ({teams.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── USERS TAB ── */}
        {activeTab === "users" && (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons
                  name="account-group"
                  size={20}
                  color={c.primaryIcon}
                />
                <Text style={styles.statValue}>{userStats.totalUsers}</Text>
                <Text style={styles.statLabel}>Users</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color={c.success}
                />
                <Text style={styles.statValue}>{userStats.onlineUsers}</Text>
                <Text style={styles.statLabel}>Online</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="login" size={20} color={c.info} />
                <Text style={styles.statValue}>{userStats.signedInUsers}</Text>
                <Text style={styles.statLabel}>Signed In</Text>
              </View>
            </View>

            <View style={{ padding: 16 }}>
              {users.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <MaterialCommunityIcons
                    name="account-off-outline"
                    size={42}
                    color={c.emptyIcon}
                  />
                  <Text style={styles.emptyText}>No users yet</Text>
                </View>
              ) : (
                sortedUsers.map((item) => {
                  const isDeleting = deletingUserId === item.id;
                  const isSelf = Number(user?.id) === Number(item.id);

                  return (
                    <View key={String(item.id)} style={styles.row}>
                      <TouchableOpacity
                        style={shared.rowBody}
                        activeOpacity={0.7}
                        disabled={isDeleting}
                        onPress={() => router.push(`/admin/user/${item.id}`)}
                      >
                        <View
                          style={[
                            styles.avatar,
                            { backgroundColor: colorForUser(item.id) },
                          ]}
                        >
                          <Text style={shared.avatarText}>
                            {item.name?.charAt(0)?.toUpperCase() ?? "?"}
                          </Text>
                        </View>

                        <View style={styles.rowText}>
                          <View style={styles.userNameRow}>
                            <Text style={styles.rowName} numberOfLines={1}>
                              {item.name}
                            </Text>

                            {isAdminUser(item) && (
                              <View style={shared.adminLabel}>
                                <MaterialCommunityIcons
                                  name="crown"
                                  size={13}
                                  color={c.adminIcon}
                                />
                                <Text style={shared.adminLabelText}>
                                  {isSuperAdminUser(item)
                                    ? "Super Admin"
                                    : "Admin"}
                                </Text>
                              </View>
                            )}

                            {isSelf && (
                              <View style={shared.youLabel}>
                                <Text style={shared.youLabelText}>You</Text>
                              </View>
                            )}
                          </View>

                          <Text style={styles.rowEmail} numberOfLines={1}>
                            {item.email}
                          </Text>

                          <View style={styles.userRankRow}>
                            <Text style={styles.userStepsText}>
                              {(item.steps_today ?? 0).toLocaleString()} steps
                              today
                            </Text>
                          </View>

                          <Text style={styles.rowMeta} numberOfLines={1}>
                            Created {item.created_at_label ?? "—"} • ID #
                            {item.id}
                          </Text>

                          <StatusPill
                            state={item.state}
                            label={item.label}
                            isSignedIn={item.is_signed_in}
                          />
                        </View>
                      </TouchableOpacity>

                      <View style={styles.actionsWrap}>
                        {!isSelf && (
                          <>
                            <TouchableOpacity
                              style={shared.infoBtn}
                              disabled={isDeleting}
                              onPress={() => openAddToTeam(item.id, item.name)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons
                                name="add-circle-outline"
                                size={20}
                                color={c.info}
                              />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={shared.trashBtn}
                              disabled={isDeleting}
                              onPress={() => openDeleteModal("user", item)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              {isDeleting ? (
                                <ActivityIndicator
                                  size="small"
                                  color={c.danger}
                                />
                              ) : (
                                <Ionicons
                                  name="trash-outline"
                                  size={20}
                                  color={c.danger}
                                />
                              )}
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* ── TEAMS TAB ── */}
        {activeTab === "teams" && (
          <>
            <View style={styles.switcherContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.switcherScroll}
              >
                {sortedTeams.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.teamPill,
                      selectedTeamId === t.id && styles.teamPillActive,
                    ]}
                    onPress={() => setSelectedTeamId(t.id)}
                  >
                    <Text
                      style={[
                        styles.teamPillText,
                        selectedTeamId === t.id && styles.teamPillTextActive,
                      ]}
                    >
                      {t.is_admin ? "👑 " : ""}
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.addTeamPill,
                    selectedTeamId === null && styles.addTeamPillActive,
                  ]}
                  onPress={() => setSelectedTeamId(null)}
                >
                  <Ionicons
                    name="apps"
                    size={18}
                    color={selectedTeamId === null ? "#fff" : c.primaryIcon}
                  />
                  <Text
                    style={[
                      styles.addTeamPillText,
                      selectedTeamId === null && { color: "#fff" },
                    ]}
                  >
                    All Teams
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            <View style={styles.teamStatsCard}>
              <View style={styles.teamStatsRowInner}>
                <View style={styles.teamStatItem}>
                  <MaterialCommunityIcons
                    name="account-group"
                    size={18}
                    color={c.primaryIcon}
                  />
                  <Text style={styles.teamStatValue}>{teamCount}</Text>
                  <Text style={styles.teamStatLabel}>Teams</Text>
                </View>
                <View style={styles.teamStatDivider} />
                <View style={styles.teamStatItem}>
                  <MaterialCommunityIcons
                    name="crown"
                    size={18}
                    color={c.adminIcon}
                  />
                  <Text style={styles.teamStatValue}>{adminTeamCount}</Text>
                  <Text style={styles.teamStatLabel}>Leading</Text>
                </View>
                <View style={styles.teamStatDivider} />
                <View style={styles.teamStatItem}>
                  <MaterialCommunityIcons
                    name="account-multiple"
                    size={18}
                    color={c.info}
                  />
                  <Text style={styles.teamStatValue}>
                    {activeTeam
                      ? (activeTeam.members?.length ??
                        activeTeam.member_count ??
                        0)
                      : allTeamsMemberCount()}
                  </Text>
                  <Text style={styles.teamStatLabel}>
                    {activeTeam ? "Members" : "Total Members"}
                  </Text>
                </View>
              </View>

              <View style={styles.teamStatsRowInner}>
                <View style={styles.teamStatItem}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={18}
                    color={c.success}
                  />
                  <Text style={styles.teamStatValue}>
                    {activeTeam
                      ? typeof activeTeam.online_member_count === "number"
                        ? activeTeam.online_member_count
                        : teamOnlineCount(activeTeam)
                      : allTeamsOnlineCount()}
                  </Text>
                  <Text style={styles.teamStatLabel}>
                    {activeTeam ? "Online" : "Total Online"}
                  </Text>
                </View>
                <View style={styles.teamStatDivider} />
                <View style={styles.teamStatItem}>
                  <MaterialCommunityIcons
                    name="login"
                    size={18}
                    color={c.info}
                  />
                  <Text style={styles.teamStatValue}>
                    {activeTeam
                      ? typeof activeTeam.signed_in_member_count === "number"
                        ? activeTeam.signed_in_member_count
                        : teamSignedInCount(activeTeam)
                      : allTeamsSignedInCount()}
                  </Text>
                  <Text style={styles.teamStatLabel}>
                    {activeTeam ? "Signed In" : "Total Signed In"}
                  </Text>
                </View>
                <View style={styles.teamStatDivider} />
                <View style={styles.teamStatItem}>
                  <MaterialCommunityIcons
                    name="format-list-numbered"
                    size={18}
                    color={c.slate}
                  />
                  <Text style={styles.teamStatValue}>
                    {teamCount}/{MAX_TEAMS}
                  </Text>
                  <Text style={styles.teamStatLabel}>Slots</Text>
                </View>
              </View>
            </View>

            <View style={{ padding: 16 }}>
              {teams.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <MaterialCommunityIcons
                    name="account-group-outline"
                    size={42}
                    color={c.emptyIcon}
                  />
                  <Text style={styles.emptyText}>No teams yet</Text>
                </View>
              ) : (
                (activeTeam ? [activeTeam] : sortedTeams).map((item) => {
                  const isDeleting = deletingTeamId === item.id;
                  const onlineCount =
                    typeof item.online_member_count === "number"
                      ? item.online_member_count
                      : teamOnlineCount(item);
                  const signedInCount =
                    typeof item.signed_in_member_count === "number"
                      ? item.signed_in_member_count
                      : teamSignedInCount(item);

                  return (
                    <View key={String(item.id)} style={styles.row}>
                      <TouchableOpacity
                        style={shared.rowBody}
                        activeOpacity={0.7}
                        disabled={isDeleting}
                        onPress={() =>
                          router.push({
                            pathname: "/admin/team/[id]",
                            params: { id: item.id },
                          })
                        }
                      >
                        <View
                          style={[
                            styles.avatar,
                            { backgroundColor: c.primary },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="account-group"
                            size={24}
                            color="#fff"
                          />
                        </View>
                        <View style={styles.rowText}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.rowEmail} numberOfLines={1}>
                            Code: {item.join_code}
                          </Text>
                          <Text style={styles.rowMeta} numberOfLines={1}>
                            Created {item.created_at_label} •{" "}
                            {item.member_count} members
                          </Text>
                          <View style={shared.pillRow}>
                            <View style={shared.statusPill}>
                              <View
                                style={[
                                  shared.statusDot,
                                  { backgroundColor: c.success },
                                ]}
                              />
                              <Text
                                style={[
                                  shared.statusPillText,
                                  { color: c.success },
                                ]}
                              >
                                {onlineCount} online
                              </Text>
                            </View>
                            <View style={shared.statusPill}>
                              <View
                                style={[
                                  shared.statusDot,
                                  { backgroundColor: c.info },
                                ]}
                              />
                              <Text
                                style={[
                                  shared.statusPillText,
                                  { color: c.info },
                                ]}
                              >
                                {signedInCount} signed in
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.actionWrap}>
                        <TouchableOpacity
                          style={shared.trashBtn}
                          disabled={isDeleting}
                          onPress={() => openDeleteModal("team", item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {isDeleting ? (
                            <ActivityIndicator size="small" color={c.danger} />
                          ) : (
                            <Ionicons
                              name="trash-outline"
                              size={20}
                              color={c.danger}
                            />
                          )}
                        </TouchableOpacity>
                        <Ionicons
                          name="chevron-forward"
                          size={22}
                          color={c.faint}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ─── ADD TO TEAM MODAL ─── */}
      <Modal
        visible={addToTeamVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAddToTeamVisible(false)}
      >
        <View style={shared.modalOverlay}>
          <View style={shared.modalContent}>
            <View style={shared.modalHeader}>
              <MaterialCommunityIcons
                name="account-plus"
                size={36}
                color={c.info}
              />
              <Text style={shared.modalTitle}>Add to Team</Text>
            </View>
            <Text style={shared.modalBody}>
              Add{" "}
              <Text style={shared.modalBodyStrong}>{addToTeamUser?.name}</Text>{" "}
              to a team:
            </Text>

            <ScrollView
              style={{ maxHeight: 260, marginVertical: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {sortedTeams.length === 0 ? (
                <Text style={styles.noTeamsText}>No teams available</Text>
              ) : (
                sortedTeams.map((t) => {
                  const selected = addToTeamSelected === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setAddToTeamSelected(t.id)}
                      activeOpacity={0.75}
                      style={[
                        styles.teamSelectRow,
                        selected && styles.teamSelectRowActive,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.teamSelectName} numberOfLines={1}>
                          {t.name}
                        </Text>
                        <Text style={styles.teamSelectMeta}>
                          {t.member_count} member
                          {t.member_count === 1 ? "" : "s"} • Code:{" "}
                          {t.join_code}
                        </Text>
                      </View>
                      {selected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={c.info}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={shared.modalActions}>
              <TouchableOpacity
                style={shared.modalBtnCancel}
                onPress={() => setAddToTeamVisible(false)}
              >
                <Text style={shared.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  shared.modalBtnSave,
                  (!addToTeamSelected || isAddingToTeam) && {
                    backgroundColor: c.infoDisabled,
                  },
                ]}
                disabled={!addToTeamSelected || isAddingToTeam}
                onPress={executeAddToTeam}
              >
                {isAddingToTeam ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={shared.modalBtnSaveText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── DELETE CONFIRMATION MODAL ─── */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={shared.modalOverlay}>
          <View style={shared.modalContent}>
            <View style={shared.modalHeader}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={36}
                color={c.dangerSolid}
              />
              <Text style={shared.modalTitle}>
                Delete {deleteTarget?.type === "user" ? "User" : "Team"}?
              </Text>
            </View>
            <Text style={shared.modalBody}>
              You are about to permanently delete{" "}
              <Text style={shared.modalBodyStrong}>{deleteTarget?.name}</Text> (
              {deleteTarget?.extraInfo}).
            </Text>
            {deleteTarget?.type === "user" && (
              <Text style={shared.modalSubBody}>
                This will erase all their data (steps, tasks, tokens).
              </Text>
            )}
            {deleteTarget?.type === "team" && (
              <Text style={shared.modalSubBody}>
                Users themselves will not be deleted, but all memberships will
                be removed.
              </Text>
            )}
            <Text style={shared.modalInstruction}>
              Please type{" "}
              <Text
                style={{
                  fontWeight: "bold",
                  color: c.dangerSolid,
                  letterSpacing: 1,
                }}
              >
                DELETE
              </Text>{" "}
              to confirm.
            </Text>
            <TextInput
              style={shared.deleteInput}
              placeholder="DELETE"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholderTextColor={c.faint}
              keyboardAppearance={isDark ? "dark" : "light"}
            />
            <View style={shared.modalActions}>
              <TouchableOpacity
                style={shared.modalBtnCancel}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={shared.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  shared.modalBtnDelete,
                  deleteConfirmText !== "DELETE" && {
                    backgroundColor: c.dangerDisabled,
                  },
                ]}
                disabled={deleteConfirmText !== "DELETE"}
                onPress={executeDelete}
              >
                <Text style={shared.modalBtnDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
