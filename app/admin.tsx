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

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
const ONLINE_WINDOW_MS = 15 * 60 * 1000;
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

function statusColorFor(state?: string): string {
  switch (state) {
    case "online":
      return "#16A34A";
    case "signed_out":
      return "#DC2626";
    case "offline":
      return "#94A3B8";
    case "never":
    default:
      return "#94A3B8";
  }
}

function StatusPill({
  state,
  label,
  isSignedIn,
}: {
  state?: string;
  label?: string;
  isSignedIn?: boolean;
}) {
  const color = statusColorFor(state);
  const signedInColor = isSignedIn ? "#16A34A" : "#DC2626";

  return (
    <View style={styles.pillRow}>
      <View style={styles.statusPill}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusPillText, { color }]} numberOfLines={1}>
          {label ?? "Not active yet"}
        </Text>
      </View>
      <View style={styles.statusPill}>
        <View style={[styles.statusDot, { backgroundColor: signedInColor }]} />
        <Text
          style={[styles.statusPillText, { color: signedInColor }]}
          numberOfLines={1}
        >
          {isSignedIn ? "Signed In" : "Signed Out"}
        </Text>
      </View>
    </View>
  );
}

// 🏅 Medal emoji helper (rank 1–3 get a medal, others just "#N")
function rankBadge(rank: number) {
  if (rank === 1) return { text: "🥇 #1", style: styles.firstRank };
  if (rank === 2) return { text: "🥈 #2", style: styles.secondRank };
  if (rank === 3) return { text: "🥉 #3", style: styles.thirdRank };
  return { text: `#${rank}`, style: styles.otherRank };
}

export default function AdminPanel() {
  const router = useRouter();
  const { user, isAdmin, isLoggedIn } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [loading, setLoading] = useState(true);

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

  // ─────────────────────────────────────────────────────────────
  // 🏅 RANK MAP — computed by steps DESC across ALL users.
  // ─────────────────────────────────────────────────────────────
  const rankMap = useMemo(() => {
    const map = new Map<number, number>();

    const bySteps = [...users].sort(
      (a, b) => (b.steps_today ?? 0) - (a.steps_today ?? 0),
    );

    let currentRank = 0;
    let previousSteps: number | null = null;

    bySteps.forEach((u, index) => {
      const steps = u.steps_today ?? 0;

      if (previousSteps === null || steps !== previousSteps) {
        currentRank = index + 1;
      }

      map.set(u.id, currentRank);
      previousSteps = steps;
    });

    return map;
  }, [users]);

  // ─────────────────────────────────────────────────────────────
  // 🅰️ SORTED USERS
  // 1. Logged-in User (You) at the very top
  // 2. Other Super Admins
  // 3. Remaining users alphabetically
  // ─────────────────────────────────────────────────────────────
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aIsYou = Number(user?.id) === Number(a.id);
      const bIsYou = Number(user?.id) === Number(b.id);

      // 1. Pin yourself (the logged-in admin) to the top
      if (aIsYou && !bIsYou) return -1;
      if (!aIsYou && bIsYou) return 1;

      // 2. Pin other Super Admins below you
      const aIsSuperAdmin = isSuperAdminUser(a);
      const bIsSuperAdmin = isSuperAdminUser(b);

      if (aIsSuperAdmin && !bIsSuperAdmin) return -1;
      if (!aIsSuperAdmin && bIsSuperAdmin) return 1;

      // 3. Alphabetical for everyone else
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

  // ─── PIN SCREEN ───
  if (!isVerified) {
    const isPinComplete = pin.length === 6;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchData}
              tintColor="#4F46E5"
              colors={["#4F46E5"]}
            />
          }
        >
          <View style={{ padding: 20, marginTop: 50 }}>
            <MaterialCommunityIcons
              name="shield-lock"
              size={60}
              color="#7C3AED"
              style={{ alignSelf: "center" }}
            />
            <Text style={[styles.headerTitle, { textAlign: "center" }]}>
              Super Admin Access
            </Text>
            <Text
              style={{
                textAlign: "center",
                color: "#64748B",
                marginBottom: 20,
              }}
            >
              Enter 6-digit PIN to unlock Teams and User Management
            </Text>

            <View style={styles.pinInputWrapper}>
              <TextInput
                style={styles.pinInput}
                placeholder="••••••"
                keyboardType="number-pad"
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
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={verifyPin}
              disabled={!isPinComplete || isVerifying}
              style={{
                backgroundColor:
                  !isPinComplete || isVerifying ? "#D1D5DB" : "#7C3AED",
                padding: 15,
                borderRadius: 10,
                marginTop: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isVerifying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  style={{
                    color: "#fff",
                    textAlign: "center",
                    fontWeight: "bold",
                    fontSize: 16,
                  }}
                >
                  Unlock
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (loading && users.length === 0 && teams.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F8FAFC",
        }}
      >
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  // ─── MAIN ADMIN DASHBOARD ───
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchData}
            tintColor="#4F46E5"
            colors={["#4F46E5"]}
          />
        }
      >
        {/* Tab Selector */}
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: 16,
            marginTop: 10,
            backgroundColor: "#E2E8F0",
            borderRadius: 10,
            padding: 4,
          }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              padding: 10,
              alignItems: "center",
              backgroundColor: activeTab === "users" ? "#fff" : "transparent",
              borderRadius: 8,
            }}
            onPress={() => {
              setActiveTab("users");
              setSelectedTeamId(null);
            }}
          >
            <Text
              style={{
                fontWeight: "bold",
                color: activeTab === "users" ? "#0F172A" : "#64748B",
              }}
            >
              Users ({users.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              padding: 10,
              alignItems: "center",
              backgroundColor: activeTab === "teams" ? "#fff" : "transparent",
              borderRadius: 8,
            }}
            onPress={() => setActiveTab("teams")}
          >
            <Text
              style={{
                fontWeight: "bold",
                color: activeTab === "teams" ? "#0F172A" : "#64748B",
              }}
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
                  color="#4F46E5"
                />
                <Text style={styles.statValue}>{userStats.totalUsers}</Text>
                <Text style={styles.statLabel}>Users</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color="#16A34A"
                />
                <Text style={styles.statValue}>{userStats.onlineUsers}</Text>
                <Text style={styles.statLabel}>Online</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons
                  name="login"
                  size={20}
                  color="#0284C7"
                />
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
                    color="#CBD5E1"
                  />
                  <Text style={styles.emptyText}>No users yet</Text>
                </View>
              ) : (
                sortedUsers.map((item) => {
                  const isDeleting = deletingUserId === item.id;
                  const isSelf = Number(user?.id) === Number(item.id);
                  const rank = rankMap.get(item.id) ?? 0;
                  const badge = rank > 0 ? rankBadge(rank) : null;

                  return (
                    <View key={String(item.id)} style={styles.row}>
                      <TouchableOpacity
                        style={styles.rowBody}
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
                          <Text style={styles.avatarText}>
                            {item.name?.charAt(0)?.toUpperCase() ?? "?"}
                          </Text>
                        </View>

                        <View style={styles.rowText}>
                          <View style={styles.userNameRow}>
                            <Text style={styles.rowName} numberOfLines={1}>
                              {item.name}
                            </Text>

                            {/* 👑 ADMIN BADGE — Only Super Admin / Admin */}
                            {isAdminUser(item) && (
                              <View style={styles.adminLabel}>
                                <MaterialCommunityIcons
                                  name="crown"
                                  size={13}
                                  color="#D97706"
                                />
                                <Text style={styles.adminLabelText}>
                                  {isSuperAdminUser(item)
                                    ? "Super Admin"
                                    : "Admin"}
                                </Text>
                              </View>
                            )}

                            {/* ✅ YOU BADGE — Shows only for logged in user */}
                            {isSelf && (
                              <View style={styles.youLabel}>
                                <Text style={styles.youLabelText}>You</Text>
                              </View>
                            )}
                          </View>

                          <Text style={styles.rowEmail} numberOfLines={1}>
                            {item.email}
                          </Text>

                          {/* 🏅 Rank + steps row */}
                          <View style={styles.userRankRow}>
                            {badge && (
                              <View style={[styles.userRankBadge, badge.style]}>
                                <Text style={styles.userRankText}>
                                  {badge.text}
                                </Text>
                              </View>
                            )}
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
                          <TouchableOpacity
                            style={styles.trashBtn}
                            disabled={isDeleting}
                            onPress={() => openDeleteModal("user", item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            {isDeleting ? (
                              <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                              <Ionicons
                                name="trash-outline"
                                size={20}
                                color="#DC2626"
                              />
                            )}
                          </TouchableOpacity>
                        )}
                        <Ionicons
                          name="chevron-forward"
                          size={22}
                          color="#94A3B8"
                        />
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
                    color={selectedTeamId === null ? "#fff" : "#4F46E5"}
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
                    color="#4F46E5"
                  />
                  <Text style={styles.teamStatValue}>
                    {activeTeam ? teamCount : teamCount}
                  </Text>
                  <Text style={styles.teamStatLabel}>Teams</Text>
                </View>
                <View style={styles.teamStatDivider} />
                <View style={styles.teamStatItem}>
                  <MaterialCommunityIcons
                    name="crown"
                    size={18}
                    color="#D97706"
                  />
                  <Text style={styles.teamStatValue}>{adminTeamCount}</Text>
                  <Text style={styles.teamStatLabel}>Leading</Text>
                </View>
                <View style={styles.teamStatDivider} />
                <View style={styles.teamStatItem}>
                  <MaterialCommunityIcons
                    name="account-multiple"
                    size={18}
                    color="#0284C7"
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
                    color="#16A34A"
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
                    color="#0284C7"
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
                    color="#475569"
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
                    color="#CBD5E1"
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
                        style={styles.rowBody}
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
                            { backgroundColor: "#4F46E5" },
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
                          <View style={styles.pillRow}>
                            <View style={styles.statusPill}>
                              <View
                                style={[
                                  styles.statusDot,
                                  { backgroundColor: "#16A34A" },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.statusPillText,
                                  { color: "#16A34A" },
                                ]}
                              >
                                {onlineCount} online
                              </Text>
                            </View>
                            <View style={styles.statusPill}>
                              <View
                                style={[
                                  styles.statusDot,
                                  { backgroundColor: "#0284C7" },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.statusPillText,
                                  { color: "#0284C7" },
                                ]}
                              >
                                {signedInCount} signed in
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.actionsWrap}>
                        <TouchableOpacity
                          style={styles.trashBtn}
                          disabled={isDeleting}
                          onPress={() => openDeleteModal("team", item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {isDeleting ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <Ionicons
                              name="trash-outline"
                              size={20}
                              color="#DC2626"
                            />
                          )}
                        </TouchableOpacity>
                        <Ionicons
                          name="chevron-forward"
                          size={22}
                          color="#94A3B8"
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

      {/* ─── DELETE CONFIRMATION MODAL ─── */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={36}
                color="#DC2626"
              />
              <Text style={styles.modalTitle}>
                Delete {deleteTarget?.type === "user" ? "User" : "Team"}?
              </Text>
            </View>
            <Text style={styles.modalBody}>
              You are about to permanently delete{" "}
              <Text style={{ fontWeight: "700", color: "#0F172A" }}>
                {deleteTarget?.name}
              </Text>{" "}
              ({deleteTarget?.extraInfo}).
            </Text>
            {deleteTarget?.type === "user" && (
              <Text style={styles.modalSubBody}>
                This will erase all their data (steps, tasks, tokens).
              </Text>
            )}
            {deleteTarget?.type === "team" && (
              <Text style={styles.modalSubBody}>
                Users themselves will not be deleted, but all memberships will
                be removed.
              </Text>
            )}
            <Text style={styles.modalInstruction}>
              Please type{" "}
              <Text
                style={{
                  fontWeight: "bold",
                  color: "#DC2626",
                  letterSpacing: 1,
                }}
              >
                DELETE
              </Text>{" "}
              to confirm.
            </Text>
            <TextInput
              style={styles.deleteInput}
              placeholder="DELETE"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtnDelete,
                  deleteConfirmText !== "DELETE" && {
                    backgroundColor: "#FCA5A5",
                  },
                ]}
                disabled={deleteConfirmText !== "DELETE"}
                onPress={executeDelete}
              >
                <Text style={styles.modalBtnDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", paddingHorizontal: 16 },

  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 5,
    maxWidth: "100%",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },

  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  statLabel: { fontSize: 10, fontWeight: "600", color: "#64748B" },
  statDivider: { width: 1, height: 30, backgroundColor: "#E2E8F0" },

  switcherContainer: { marginBottom: 10, marginTop: 6 },
  switcherScroll: { gap: 10, paddingVertical: 10, paddingHorizontal: 4 },
  teamPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
  },
  teamPillActive: { backgroundColor: "#4F46E5" },
  teamPillText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  teamPillTextActive: { color: "#fff" },
  addTeamPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  addTeamPillActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  addTeamPillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4F46E5",
    marginLeft: 4,
  },

  teamStatsCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
  teamStatValue: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  teamStatLabel: { fontSize: 10, fontWeight: "600", color: "#64748B" },
  teamStatDivider: { width: 1, height: 28, backgroundColor: "#E2E8F0" },

  // Rank badge row (Users tab)
  userRankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 2,
    flexWrap: "wrap",
  },
  userRankBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  firstRank: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
  },
  secondRank: {
    backgroundColor: "#EDE9FE",
    borderColor: "#C4B5FD",
  },
  thirdRank: {
    backgroundColor: "#CFFAFE",
    borderColor: "#67E8F9",
  },
  otherRank: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
  },
  userRankText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3730A3",
  },
  userStepsText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },

  pinInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingRight: 10,
  },
  pinInput: {
    flex: 1,
    padding: 15,
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 5,
  },
  eyeIcon: { padding: 5 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  rowBody: { flex: 1, flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  rowEmail: { fontSize: 13, color: "#475569", marginTop: 1 },
  rowMeta: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
    fontWeight: "600",
  },

  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  adminLabel: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  adminLabelText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
  },
  youLabel: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youLabelText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },

  actionsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 6,
  },
  trashBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: { color: "#94A3B8", fontSize: 14, fontWeight: "600" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: { alignItems: "center", marginBottom: 16 },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
  },
  modalBody: {
    fontSize: 15,
    color: "#475569",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 4,
  },
  modalSubBody: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
  },
  modalInstruction: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    marginBottom: 12,
  },
  deleteInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 15,
    fontSize: 18,
    textAlign: "center",
    fontWeight: "700",
    letterSpacing: 2,
    color: "#0F172A",
    marginBottom: 24,
  },
  modalActions: { flexDirection: "row", gap: 12 },
  modalBtnCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  modalBtnCancelText: { color: "#64748B", fontWeight: "700", fontSize: 15 },
  modalBtnDelete: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
  },
  modalBtnDeleteText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
});
