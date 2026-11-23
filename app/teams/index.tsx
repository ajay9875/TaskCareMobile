// app/teams/index.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
const MAX_TEAMS = 10;

// 🔥 Helper to check for Team Admin status
function isTeamAdmin(member: any): boolean {
  const role = (member?.role ?? "").toLowerCase();
  return (
    !!member?.is_admin ||
    !!member?.is_team_admin ||
    !!member?.team_admin ||
    role === "admin" ||
    role === "team_admin"
  );
}

// 🏅 Medal emoji helper (rank 1–3 get a medal, others just "#N")
function rankBadge(rank: number) {
  if (rank === 1) return { text: "🥇 #1", style: styles.firstRank };
  if (rank === 2) return { text: "🥈 #2", style: styles.secondRank };
  if (rank === 3) return { text: "🥉 #3", style: styles.thirdRank };
  return { text: `#${rank}`, style: styles.otherRank };
}

export default function MyTeamScreen() {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const [fetchError, setFetchError] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // ✅ NEW: team count states
  const [teamCount, setTeamCount] = useState(0);
  const [adminTeamCount, setAdminTeamCount] = useState(0);

  const { user: currentUser } = useAuth();

  // ✅ NEW: 60s ticker — forces online pills to re-evaluate
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Rename team modal state
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete team modal state
  const [deleteTeamModalVisible, setDeleteTeamModalVisible] = useState(false);
  const [deleteTeamConfirmText, setDeleteTeamConfirmText] = useState("");
  const [isDeletingTeam, setIsDeletingTeam] = useState(false);

  // Delete member modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();

  // ✅ INTERCEPT BACK BUTTON WHEN A TEAM IS SELECTED
  useEffect(() => {
    const onBackPress = () => {
      if (selectedTeamId !== null) {
        setSelectedTeamId(null);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );

    return () => subscription.remove();
  }, [selectedTeamId]);

  // Deep-link prefill
  useEffect(() => {
    if (prefill && typeof prefill === "string") {
      setJoinCode(prefill.toUpperCase());
      setSelectedTeamId(null);
    }
  }, [prefill]);

  // Fetch teams
  const fetchTeams = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`${API_BASE}/teams/my-teams`, {
        credentials: "include",
      });
      if (res.status === 401) {
        router.replace("/login?sessionExpired=true");
        return;
      }
      const data = await res.json();
      if (data.status === "success") {
        setTeams(data.teams);
        setTeamCount(data.teams.length);
        setAdminTeamCount(data.teams.filter((t: any) => t.is_admin).length);
      } else {
        setFetchError(true);
      }
    } catch (e) {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const activeTeam = useMemo(() => {
    return teams.find((t) => t.id === selectedTeamId) || null;
  }, [teams, selectedTeamId]);

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      if (a.is_admin && !b.is_admin) return -1;
      if (!a.is_admin && b.is_admin) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [teams]);

  // ── Derived status helpers ────────────────────────────────────
  const ONLINE_WINDOW_MS = 15 * 60 * 1000;

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
    const uniqueUsers = new Set();
    teams.forEach((t) => {
      (t.members ?? []).forEach((m: any) => {
        uniqueUsers.add(m.user_id);
      });
    });
    return uniqueUsers.size;
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

  // 🔥 RANK MAP — Dense ranking (Same logic as admin.tsx)
  const rankMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!activeTeam?.members) return map;

    // Sort by steps descending
    const bySteps = [...activeTeam.members].sort(
      (a: any, b: any) => (b.steps_today ?? 0) - (a.steps_today ?? 0),
    );

    let currentRank = 0;
    let previousSteps: number | null = null;

    bySteps.forEach((m: any, index: number) => {
      const steps = m.steps_today ?? 0;

      if (previousSteps === null || steps !== previousSteps) {
        currentRank = index + 1;
      }

      map.set(m.user_id, currentRank);
      previousSteps = steps;
    });

    return map;
  }, [activeTeam]);

  // Leaderboard sorting (Steps DESC, ID ASC for tie-breaker)
  const leaderboard = useMemo(() => {
    if (!activeTeam?.members) return [];
    return [...activeTeam.members].sort((a: any, b: any) => {
      const diff = (b.steps_today ?? 0) - (a.steps_today ?? 0);
      if (diff !== 0) return diff;
      return a.user_id - b.user_id;
    });
  }, [activeTeam]);

  const colorForUser = (userId: number) => {
    const colors = [
      "#4F46E5",
      "#0284C7",
      "#059669",
      "#D97706",
      "#DB2777",
      "#7C3AED",
      "#0891B2",
      "#EA580C",
    ];
    return colors[Math.abs(Number(userId) || 0) % colors.length];
  };

  const handleCreate = async () => {
    if (!teamName) return Alert.alert("Error", "Enter a team name");
    try {
      const res = await fetch(`${API_BASE}/teams/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: teamName }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data?.error || "Failed to create team");
        return;
      }
      setTeamName("");
      fetchTeams();
    } catch (e) {
      Alert.alert("Error", "Failed to create team");
    }
  };

  const handleJoin = async () => {
    if (!joinCode) return Alert.alert("Error", "Enter a code");
    try {
      const res = await fetch(`${API_BASE}/teams/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: joinCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data?.error || "Failed to join team");
        return;
      }
      setJoinCode("");
      fetchTeams();
    } catch (e) {
      Alert.alert("Error", "Failed to join team");
    }
  };

  const handleShare = () => {
    if (!activeTeam) return;
    const joinLink = `https://TaskCare360.pythonanywhere.com/join-team?code=${activeTeam.join_code}`;
    const message =
      `🎯 You've been invited to join "${activeTeam.name}" on FitWisely!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n   JOIN CODE\n   ${activeTeam.join_code}\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👇 Tap below to join automatically\n${joinLink}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Or join manually:\n1. Open FitWisely\n2. Tap the "Teams" tab\n3. Enter the code above in "Join a Team"`;
    Share.share({ message });
  };

  const openRenameModal = () => {
    setRenameValue(activeTeam?.name || "");
    setRenameModalVisible(true);
  };

  const executeRenameTeam = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed) return Alert.alert("Error", "Team name cannot be empty");
    if (trimmed === activeTeam?.name) {
      setRenameModalVisible(false);
      return;
    }

    setIsRenaming(true);
    try {
      const res = await fetch(`${API_BASE}/teams/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: trimmed, team_id: activeTeam?.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Error", data?.error || "Failed to rename team");
        return;
      }
      setRenameModalVisible(false);
      await fetchTeams();
    } catch {
      Alert.alert("Error", "Network error");
    } finally {
      setIsRenaming(false);
    }
  };

  const openDeleteModal = (memberId: number, memberName: string) => {
    setMemberToDelete({ id: memberId, name: memberName });
    setDeleteConfirmText("");
    setDeleteModalVisible(true);
  };

  const [isTransferring, setIsTransferring] = useState(false);

  const handleTransferAdmin = (userId: number, userName: string) => {
    Alert.alert(
      "Transfer Admin Role?",
      `${userName} will become the new team admin. You will be demoted to a regular member.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            setIsTransferring(true);
            try {
              const res = await fetch(`${API_BASE}/teams/transfer-admin`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  team_id: activeTeam?.id,
                  user_id: userId,
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok) {
                Alert.alert("Success", `${userName} is now the team admin.`);
                await fetchTeams();
              } else {
                Alert.alert(
                  "Error",
                  data.error || data.message || "Failed to transfer admin role",
                );
              }
            } catch {
              Alert.alert("Error", "Network error");
            } finally {
              setIsTransferring(false);
            }
          },
        },
      ],
    );
  };

  const executeDeleteMember = async () => {
    if (!memberToDelete || deleteConfirmText !== "DELETE") return;
    setIsDeleting(true);
    setDeleteModalVisible(false);

    try {
      const res = await fetch(
        `${API_BASE}/teams/members/${memberToDelete.id}?team_id=${activeTeam?.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Removed", `${memberToDelete.name} removed.`);
        fetchTeams();
      } else {
        Alert.alert("Error", data.error || "Failed to remove member");
      }
    } catch (e) {
      Alert.alert("Error", "Network error");
    } finally {
      setIsDeleting(false);
      setMemberToDelete(null);
    }
  };

  const executeDeleteTeam = async () => {
    if (deleteTeamConfirmText !== "DELETE" || !activeTeam) return;
    setIsDeletingTeam(true);
    setDeleteTeamModalVisible(false);

    try {
      const res = await fetch(
        `${API_BASE}/teams/delete?team_id=${activeTeam.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Error", data?.error || "Failed to delete team");
        return;
      }
      setSelectedTeamId(null);
      await fetchTeams();
    } catch (e) {
      Alert.alert("Error", "Network error");
    } finally {
      setIsDeletingTeam(false);
    }
  };

  if (fetchError && teams.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <MaterialCommunityIcons
          name="cloud-off-outline"
          size={64}
          color="#94A3B8"
        />
        <Text
          style={{
            fontSize: 16,
            color: "#64748B",
            marginTop: 12,
            textAlign: "center",
          }}
        >
          Could not load teams. Check your connection.
        </Text>
        <TouchableOpacity
          style={[styles.btnPrimary, { marginTop: 16, paddingHorizontal: 40 }]}
          onPress={fetchTeams}
        >
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && teams.length === 0)
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  // ── NO TEAMS / CREATE & JOIN SCREEN ──
  if (teams.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={styles.title}>Teams</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create a Team</Text>
          <TextInput
            style={styles.input}
            placeholder="Team Name"
            value={teamName}
            onChangeText={setTeamName}
          />
          <TouchableOpacity style={styles.btnPrimary} onPress={handleCreate}>
            <Text style={styles.btnText}>Create</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Join a Team</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter Join Code"
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.btnSecondary} onPress={handleJoin}>
            <Text style={styles.btnText}>Join</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ── ACTIVE TEAM DASHBOARD ──
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={fetchTeams} />
      }
    >
      {/* Horizontal Team Switcher */}
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
              name="add"
              size={20}
              color={selectedTeamId === null ? "#fff" : "#4F46E5"}
            />
            <Text
              style={[
                styles.addTeamPillText,
                selectedTeamId === null && { color: "#fff" },
              ]}
            >
              Add / Join
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ✅ Team stats strip — 2 rows for 6 metrics */}
      <View style={styles.teamStatsCard}>
        {/* Row 1 — team-level metrics */}
        <View style={styles.teamStatsRowInner}>
          <View style={styles.teamStatItem}>
            <MaterialCommunityIcons
              name="account-group"
              size={18}
              color="#4F46E5"
            />
            <Text style={styles.teamStatValue}>{teamCount}</Text>
            <Text style={styles.teamStatLabel}>Teams</Text>
          </View>
          <View style={styles.teamStatDivider} />
          <View style={styles.teamStatItem}>
            <MaterialCommunityIcons name="crown" size={18} color="#D97706" />
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
                ? (activeTeam.members?.length ?? 0)
                : allTeamsMemberCount()}
            </Text>
            <Text style={styles.teamStatLabel}>
              {activeTeam ? "Members" : "Total Members"}
            </Text>
          </View>
        </View>

        {/* Row 2 — active team status */}
        <View style={styles.teamStatsRowInner}>
          <View style={styles.teamStatItem}>
            <MaterialCommunityIcons
              name="check-circle"
              size={18}
              color="#16A34A"
            />
            <Text style={styles.teamStatValue}>
              {activeTeam ? teamOnlineCount(activeTeam) : allTeamsOnlineCount()}
            </Text>
            <Text style={styles.teamStatLabel}>
              {activeTeam ? "Online" : "Total Online"}
            </Text>
          </View>
          <View style={styles.teamStatDivider} />
          <View style={styles.teamStatItem}>
            <MaterialCommunityIcons name="login" size={18} color="#0284C7" />
            <Text style={styles.teamStatValue}>
              {activeTeam
                ? teamSignedInCount(activeTeam)
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

      {/* If selectedTeamId is null, show Create/Join forms FIRST, then the user's teams */}
      {!activeTeam ? (
        <View style={{ paddingBottom: 20 }}>
          {teams.length >= MAX_TEAMS ? (
            <View style={styles.limitCard}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={40}
                color="#DC2626"
                style={{ alignSelf: "center", marginBottom: 10 }}
              />
              <Text style={styles.limitTitle}>Team Limit Reached</Text>
              <Text style={styles.limitText}>
                You can only be part of a maximum of {MAX_TEAMS} teams. Please
                contact admin if you need to create or join more.
              </Text>
            </View>
          ) : (
            <View style={styles.twoColumnRow}>
              <View style={styles.halfCard}>
                <Text style={styles.halfCardTitle}>Create</Text>
                <TextInput
                  style={styles.compactInput}
                  placeholder="Team Name"
                  value={teamName}
                  onChangeText={setTeamName}
                />
                <TouchableOpacity
                  style={styles.btnPrimaryCompact}
                  onPress={handleCreate}
                >
                  <Text style={styles.btnText}>Create Team</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.halfCard}>
                <Text style={styles.halfCardTitle}>Join</Text>
                <TextInput
                  style={styles.compactInput}
                  placeholder="Join Code"
                  value={joinCode}
                  onChangeText={setJoinCode}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={styles.btnSecondaryCompact}
                  onPress={handleJoin}
                >
                  <Text style={styles.btnText}>Join Team</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {sortedTeams.length > 0 && (
            <View style={{ marginBottom: 4 }}>
              <Text style={styles.cardTitle}>Your Teams</Text>
              {sortedTeams.map((t) => {
                const onlineCount = teamOnlineCount(t);
                const signedInCount = teamSignedInCount(t);
                const totalMembers = t.members?.length ?? 0;

                return (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.teamListItem}
                    onPress={() => setSelectedTeamId(t.id)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.teamListLeft}>
                      <View
                        style={[
                          styles.teamListBadge,
                          {
                            backgroundColor: t.is_admin ? "#FEF3C7" : "#E0E7FF",
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={t.is_admin ? "crown" : "account"}
                          size={16}
                          color={t.is_admin ? "#B45309" : "#4F46E5"}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.teamListName} numberOfLines={1}>
                          {t.name}
                        </Text>
                        <Text style={styles.teamListRole}>
                          {t.is_admin ? "Admin" : "Member"} • {totalMembers}{" "}
                          member{totalMembers === 1 ? "" : "s"}
                        </Text>

                        {/* ✅ per-team status pills */}
                        <View style={styles.teamPillRow}>
                          <View style={styles.teamStatusPill}>
                            <View
                              style={[
                                styles.teamStatusDot,
                                { backgroundColor: "#16A34A" },
                              ]}
                            />
                            <Text
                              style={[
                                styles.teamStatusPillText,
                                { color: "#16A34A" },
                              ]}
                            >
                              {onlineCount} online
                            </Text>
                          </View>
                          <View style={styles.teamStatusPill}>
                            <View
                              style={[
                                styles.teamStatusDot,
                                { backgroundColor: "#0284C7" },
                              ]}
                            />
                            <Text
                              style={[
                                styles.teamStatusPillText,
                                { color: "#0284C7" },
                              ]}
                            >
                              {signedInCount} signed in
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      ) : (
        /* Active Team Leaderboard */
        <>
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.title} numberOfLines={1}>
                {activeTeam.name}
              </Text>
              {activeTeam.is_admin && (
                <TouchableOpacity
                  style={styles.editNameBtn}
                  onPress={openRenameModal}
                >
                  <MaterialCommunityIcons
                    name="pencil-outline"
                    size={20}
                    color="#0284C7"
                  />
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {/* 💬 Team Chat — available to all members */}
              <TouchableOpacity
                style={styles.chatBtn}
                onPress={() => {
                  console.log("TEAM ID:", activeTeam.id);
                  console.log("TEAM ID TYPE:", typeof activeTeam.id);

                  if (
                    !activeTeam?.id ||
                    !Number.isInteger(Number(activeTeam.id))
                  ) {
                    Alert.alert(
                      "Error",
                      "Invalid team ID. Please select a team again.",
                    );
                    return;
                  }

                  router.push({
                    pathname: "/teams/chat/[idx]",
                    params: {
                      id: String(activeTeam.id),
                      name: activeTeam.name,
                    },
                  });
                }}
              >
                <MaterialCommunityIcons
                  name="chat-outline"
                  size={20}
                  color="#fff"
                />
                <Text style={{ color: "#fff", marginLeft: 5 }}>Chat</Text>
              </TouchableOpacity>

                <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                  <MaterialCommunityIcons
                    name="share-variant"
                    size={20}
                    color="#fff"
                  />
                  <Text style={{ color: "#fff", marginLeft: 5 }}>Invite</Text>
                </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.subtitle}>Leaderboard</Text>

          <View style={{ paddingBottom: 20 }}>
            {leaderboard.map((item: any) => {
              const isMe =
                Number(item.user_id) === Number(activeTeam.current_user_id);

              // 🔥 Pull rank from rankMap and generate badge
              const rank = rankMap.get(item.user_id) ?? 0;
              const badge = rank > 0 ? rankBadge(rank) : null;
              const isAdmin = isTeamAdmin(item);

              const openMemberHistory = () => {
                if (!activeTeam.is_admin && !isMe) {
                  Alert.alert(
                    "Private",
                    "Detailed history is only visible to the team admin.",
                  );
                  return;
                }

                router.push({
                  pathname: "/teams/member/[id]",
                  params: {
                    id: item.user_id,
                    team_id: activeTeam.id,
                  },
                });
              };

              return (
                <View
                  key={item.user_id}
                  style={[styles.row, isMe && styles.rowMe]}
                >
                  <TouchableOpacity
                    style={styles.rowBody}
                    activeOpacity={0.7}
                    onPress={openMemberHistory}
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: colorForUser(item.user_id) },
                      ]}
                    >
                      <Text style={styles.avatarText}>
                        {item.name?.charAt(0)?.toUpperCase() || "?"}
                      </Text>
                    </View>

                    <View style={styles.rowText}>
                      <View style={styles.nameRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {item.name}
                        </Text>

                        {isAdmin && (
                          <View style={styles.adminLabel}>
                            <MaterialCommunityIcons
                              name="crown"
                              size={13}
                              color="#D97706"
                            />
                            <Text style={styles.adminLabelText}>Admin</Text>
                          </View>
                        )}

                        {isMe && (
                          <View style={styles.youLabel}>
                            <Text style={styles.youLabelText}>You</Text>
                          </View>
                        )}
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        {/* 🏅 RANK BADGE — Matches admin.tsx EXACTLY */}
                        {badge && (
                          <View style={[styles.userRankBadge, badge.style]}>
                            <Text style={styles.userRankText}>
                              {badge.text}
                            </Text>
                          </View>
                        )}

                        <Text style={styles.memberStatus}>
                          {item.is_signed_in ? "🟢 Signed In" : "⚪ Signed Out"}
                        </Text>

                        <Text style={styles.memberStatus}>
                          {isOnlineMember(item) ? "🟢 Online" : "⚪ Offline"}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.stepsWrap}>
                    <Text style={styles.stepsNumber}>
                      {(item.steps_today ?? 0).toLocaleString()}
                    </Text>
                    <Text style={styles.stepsLabel}>steps</Text>
                  </View>

                  {/* 👑 Transfer admin — only visible to the current team admin, on non-admin members */}
                  {activeTeam.is_admin && !isMe && !isAdmin && (
                    <TouchableOpacity
                      style={styles.makeAdminBtn}
                      disabled={isTransferring}
                      onPress={() =>
                        handleTransferAdmin(item.user_id, item.name)
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons
                        name="crown-outline"
                        size={18}
                        color="#0284C7"
                      />
                    </TouchableOpacity>
                  )}

                  {/* 🗑️ Trash — team admin can remove non-admin members */}
                  {activeTeam.is_admin && !isMe && !isAdmin && (
                    <TouchableOpacity
                      style={styles.trashBtn}
                      onPress={() => openDeleteModal(item.user_id, item.name)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#DC2626"
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={openMemberHistory}
                    activeOpacity={0.6}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={22}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {activeTeam.is_admin && (
            <TouchableOpacity
              style={styles.deleteTeamBtn}
              onPress={() => {
                setDeleteTeamConfirmText("");
                setDeleteTeamModalVisible(true);
              }}
            >
              <MaterialCommunityIcons
                name="delete-forever-outline"
                size={20}
                color="#DC2626"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.deleteTeamBtnText}>Delete Team</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* --- ALL MODALS --- */}
      <Modal visible={deleteTeamModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons
                name="delete-forever"
                size={36}
                color="#DC2626"
              />
              <Text style={styles.modalTitle}>Delete Team?</Text>
            </View>
            <Text style={styles.modalBody}>
              You are about to permanently delete{" "}
              <Text style={{ fontWeight: "700", color: "#0F172A" }}>
                {activeTeam?.name}
              </Text>
              .
            </Text>
            <Text style={styles.modalSubBody}>
              All members will be removed. Their personal step history will not
              be deleted.
            </Text>
            <Text style={styles.modalInstruction}>
              Please type{" "}
              <Text style={{ fontWeight: "bold", color: "#DC2626" }}>
                DELETE
              </Text>{" "}
              to confirm.
            </Text>
            <TextInput
              style={styles.deleteInput}
              placeholder="DELETE"
              value={deleteTeamConfirmText}
              onChangeText={setDeleteTeamConfirmText}
              autoCapitalize="characters"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setDeleteTeamModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtnDelete,
                  deleteTeamConfirmText !== "DELETE" && {
                    backgroundColor: "#FCA5A5",
                  },
                ]}
                disabled={deleteTeamConfirmText !== "DELETE" || isDeletingTeam}
                onPress={executeDeleteTeam}
              >
                {isDeletingTeam ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnDeleteText}>Delete Team</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={deleteModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={36}
                color="#DC2626"
              />
              <Text style={styles.modalTitle}>Remove Member?</Text>
            </View>
            <Text style={styles.modalBody}>
              Remove{" "}
              <Text style={{ fontWeight: "700", color: "#0F172A" }}>
                {memberToDelete?.name}
              </Text>
              ?
            </Text>
            <Text style={styles.modalSubBody}>
              Their fitness history will not be deleted.
            </Text>
            <Text style={styles.modalInstruction}>
              Type{" "}
              <Text style={{ fontWeight: "bold", color: "#DC2626" }}>
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
                disabled={deleteConfirmText !== "DELETE" || isDeleting}
                onPress={executeDeleteMember}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnDeleteText}>Remove</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={renameModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="pencil" size={36} color="#0284C7" />
              <Text style={styles.modalTitle}>Rename Team</Text>
            </View>
            <Text style={styles.modalBody}>Give your team a new name.</Text>
            <TextInput
              style={styles.renameInput}
              placeholder="Team name"
              value={renameValue}
              onChangeText={setRenameValue}
              maxLength={150}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setRenameModalVisible(false)}
                disabled={isRenaming}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtnSave,
                  (isRenaming || !renameValue.trim()) && {
                    backgroundColor: "#7DD3FC",
                  },
                ]}
                onPress={executeRenameTeam}
                disabled={isRenaming || !renameValue.trim()}
              >
                {isRenaming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // 🔥 EXACT RANK STYLES FROM ADMIN.TSX
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

  // 🔥 EXACT BADGE STYLES FROM ADMIN TEAM FILE
  nameRow: {
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

  // Per-team status pills (in the "Your Teams" list)
  teamPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  teamStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 5,
  },
  teamStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  teamStatusPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  // Team stats (2-row card)
  teamStatsCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 10,
    gap: 8,
  },
  teamStatsRowInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  container: { flex: 1, padding: 20, backgroundColor: "#F8FAFC" },
  title: { fontSize: 26, fontWeight: "800", color: "#0F172A", flexShrink: 1 },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748B",
    marginVertical: 15,
  },

  // Team Switcher
  switcherContainer: { marginBottom: 10, marginTop: -5 },
  switcherScroll: { gap: 10, paddingVertical: 10 },
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

  // Forms / Limit
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    color: "#0F172A",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  btnPrimary: {
    backgroundColor: "#16A34A",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnSecondary: {
    backgroundColor: "#0284C7",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  limitCard: {
    backgroundColor: "#FEF2F2",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 20,
  },
  limitTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#991B1B",
    textAlign: "center",
    marginBottom: 8,
  },
  limitText: {
    fontSize: 14,
    color: "#7F1D1D",
    textAlign: "center",
    lineHeight: 20,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  editNameBtn: { marginLeft: 8, padding: 4 },
  shareBtn: {
    flexDirection: "row",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
  },

  chatBtn: {
    flexDirection: "row",
    backgroundColor: "#0284C7",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
  },

  // List row
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  rowMe: { borderColor: "#4F46E5", borderWidth: 2 },
  rowBody: { flex: 1, flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  rowText: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  memberStatus: { fontSize: 12, color: "#64748B" },
  stepsWrap: {
    alignItems: "flex-end",
    marginRight: 8,
    minWidth: 76,
  },
  stepsNumber: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  stepsLabel: { fontSize: 10, color: "#64748B", marginTop: 1 },
  trashBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  makeAdminBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  deleteTeamBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  deleteTeamBtnText: { color: "#DC2626", fontWeight: "800", fontSize: 15 },

  // Modals
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
  modalActions: { flexDirection: "row", gap: 12 },
  modalBtnCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  modalBtnCancelText: { color: "#64748B", fontWeight: "700", fontSize: 15 },
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
  modalBtnDelete: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
  },
  modalBtnDeleteText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  renameInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: "#0F172A",
    marginBottom: 20,
  },
  modalBtnSave: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#0284C7",
    alignItems: "center",
  },
  modalBtnSaveText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },

  teamStatItem: { flex: 1, alignItems: "center", gap: 2 },
  teamStatValue: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  teamStatLabel: { fontSize: 10, fontWeight: "600", color: "#64748B" },
  teamStatDivider: { width: 1, height: 28, backgroundColor: "#E2E8F0" },

  teamListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  teamListLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  teamListBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  teamListName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  teamListRole: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  twoColumnRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  halfCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  halfCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  compactInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0F172A",
    marginBottom: 8,
  },
  btnPrimaryCompact: {
    backgroundColor: "#16A34A",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnSecondaryCompact: {
    backgroundColor: "#0284C7",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
});
