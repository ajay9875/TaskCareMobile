// app/teams/index.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

export default function MyTeamScreen() {
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<any>(null);
  const [fetchError, setFetchError] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");

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

  // ── Deep-link prefill ─────────────────────────────────────
  useEffect(() => {
    if (prefill && typeof prefill === "string") {
      setJoinCode(prefill.toUpperCase());
    }
  }, [prefill]);

  // ── Deep-link while already in a team → alert ─────────────
  useEffect(() => {
    if (loading) return;
    if (!prefill) return;
    if (!team) return;

    Alert.alert(
      "Already in a team",
      `You're already part of "${team.name}". Ask a team admin to remove you before joining another team.`,
      [{ text: "OK" }],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, team, prefill]);

  // ── Fetch team ────────────────────────────────────────────
  const fetchTeam = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`${API_BASE}/teams/my-team`, {
        credentials: "include",
      });

      if (res.status === 401) {
        router.replace("/login?sessionExpired=true");
        return;
      }

      const data = await res.json();
      if (data.status === "success") {
        setTeam(data.team);
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
    fetchTeam();
  }, []);

  // ── Leaderboard (sorted, tie-broken) ──────────────────────
  const leaderboard = useMemo(() => {
    if (!team?.members) return [];
    return [...team.members].sort((a: any, b: any) => {
      const diff = (b.steps_today ?? 0) - (a.steps_today ?? 0);
      if (diff !== 0) return diff;
      return a.user_id - b.user_id; // deterministic tie-break
    });
  }, [team]);

  // ── Competition ranking (5,4,4,4,1 → 1,2,2,2,5) ──────────
  const rankFor = (steps: number) =>
    leaderboard.filter((m: any) => (m.steps_today ?? 0) > steps).length + 1;

  const medalFor = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
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
      if (res.ok) fetchTeam();
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
      if (res.ok) fetchTeam();
      else Alert.alert("Error", data.error);
    } catch (e) {
      Alert.alert("Error", "Failed to join team");
    }
  };

  const handleShare = () => {
    if (!team) return;

    const joinLink = `https://TaskCare360.pythonanywhere.com/join-team?code=${team.join_code}`;

    const message =
      `🎯 You've been invited to join "${team.name}" on TaskCare360!\n` +
      `\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `   JOIN CODE\n` +
      `   ${team.join_code}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `\n` +
      `👇 Tap below to join automatically\n` +
      `\n` +
      `${joinLink}\n` +
      `\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `\n` +
      `Or join manually:\n` +
      `1. Open TaskCare360\n` +
      `2. Tap the "Teams" tab at the bottom\n` +
      `3. Enter the code above in "Join a Team"\n` +
      `4. Tap "Join"`;

    Share.share({ message });
  };

  // ── Rename ────────────────────────────────────────────────
  const openRenameModal = () => {
    setRenameValue(team?.name || "");
    setRenameModalVisible(true);
  };

  const executeRenameTeam = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      Alert.alert("Error", "Team name cannot be empty");
      return;
    }
    if (trimmed.length < 2) {
      Alert.alert("Error", "Team name must be at least 2 characters");
      return;
    }
    if (trimmed === team?.name) {
      setRenameModalVisible(false);
      return;
    }

    setIsRenaming(true);
    try {
      const res = await fetch(`${API_BASE}/teams/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setRenameModalVisible(false);
        router.replace("/login?sessionExpired=true");
        return;
      }
      if (res.status === 403) {
        setRenameModalVisible(false);
        Alert.alert("Access Denied", "Only team admins can rename the team.");
        return;
      }
      if (!res.ok) {
        Alert.alert("Error", data?.error || "Failed to rename team");
        return;
      }

      setRenameModalVisible(false);
      await fetchTeam();
    } catch {
      Alert.alert("Error", "Network error while renaming team");
    } finally {
      setIsRenaming(false);
    }
  };

  // ── Delete member ─────────────────────────────────────────
  const openDeleteModal = (memberId: number, memberName: string) => {
    setMemberToDelete({ id: memberId, name: memberName });
    setDeleteConfirmText("");
    setDeleteModalVisible(true);
  };

  const executeDeleteMember = async () => {
    if (!memberToDelete || deleteConfirmText !== "DELETE") return;

    setIsDeleting(true);
    setDeleteModalVisible(false);

    try {
      const res = await fetch(
        `${API_BASE}/teams/members/${memberToDelete.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = await res.json();

      if (res.ok) {
        Alert.alert(
          "Removed",
          `${memberToDelete.name} has been removed from the team.`,
        );
        fetchTeam();
      } else {
        Alert.alert("Error", data.error || "Failed to remove member");
      }
    } catch (e) {
      Alert.alert("Error", "Network error while removing member");
    } finally {
      setIsDeleting(false);
      setMemberToDelete(null);
    }
  };

  // ── Delete team (admin only) ──────────────────────────────
  const openDeleteTeamModal = () => {
    setDeleteTeamConfirmText("");
    setDeleteTeamModalVisible(true);
  };

  const executeDeleteTeam = async () => {
    if (deleteTeamConfirmText !== "DELETE") return;

    setIsDeletingTeam(true);
    setDeleteTeamModalVisible(false);

    try {
      const res = await fetch(`${API_BASE}/teams/delete`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        router.replace("/login?sessionExpired=true");
        return;
      }
      if (res.status === 403) {
        Alert.alert("Access Denied", "Only team admins can delete the team.");
        return;
      }
      if (!res.ok) {
        Alert.alert("Error", data?.error || "Failed to delete team");
        return;
      }

      Alert.alert(
        "Team deleted",
        "Your team has been deleted. All members have been removed.",
      );
      setTeam(null); // immediately show Create/Join screen
      await fetchTeam(); // confirm with server
    } catch (e) {
      Alert.alert("Error", "Network error while deleting team");
    } finally {
      setIsDeletingTeam(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  // ── Retry screen ──────────────────────────────────────────
  if (fetchError) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Teams</Text>
        <View style={styles.card}>
          <MaterialCommunityIcons
            name="wifi-off"
            size={36}
            color="#DC2626"
            style={{ alignSelf: "center", marginBottom: 10 }}
          />
          <Text
            style={{ textAlign: "center", color: "#475569", marginBottom: 14 }}
          >
            Could not load your team. Check your connection and try again.
          </Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={fetchTeam}>
            <Text style={styles.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── No team → Create / Join ───────────────────────────────
  if (!team) {
    return (
      <View style={styles.container}>
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
      </View>
    );
  }

  // ── Has team → leaderboard dashboard ──────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {team.name}
          </Text>
          {team.is_admin && (
            <TouchableOpacity
              style={styles.editNameBtn}
              onPress={openRenameModal}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Rename team"
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={20}
                color="#0284C7"
              />
            </TouchableOpacity>
          )}
        </View>
        {team.is_admin && (
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <MaterialCommunityIcons
              name="share-variant"
              size={20}
              color="#fff"
            />
            <Text style={{ color: "#fff", marginLeft: 5 }}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.subtitle}>Leaderboard</Text>

      <FlatList
        data={leaderboard}
        keyExtractor={(item: any) => item.user_id.toString()}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchTeam} />
        }
        renderItem={({ item }: { item: any }) => {
          const isMe = item.user_id === team.current_user_id;
          const rank = rankFor(item.steps_today ?? 0);

          return (
            <View style={[styles.row, isMe && styles.rowMe]}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{medalFor(rank)}</Text>
              </View>

              <TouchableOpacity
                style={styles.rowBody}
                activeOpacity={0.7}
                onPress={() => {
                  const isSelf = item.user_id === team.current_user_id;
                  if (!team.is_admin && !isSelf) {
                    Alert.alert(
                      "Private",
                      "Detailed history is only visible to the member and the team admin. " +
                        "You can see everyone's daily step totals on this leaderboard.",
                    );
                    return;
                  }
                  router.push({
                    pathname: "/teams/member/[id]",
                    params: { id: item.user_id },
                  });
                }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.name?.charAt(0)?.toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.memberName}>
                    {item.name} {item.role === "admin" ? "👑" : ""}{" "}
                    {isMe ? "(you)" : ""}
                  </Text>
                  <Text style={styles.memberStatus}>
                    {item.is_signed_in ? "🟢 Signed In" : "⚪ Signed Out"}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.stepsWrap}>
                <Text style={styles.stepsNumber}>
                  {(item.steps_today ?? 0).toLocaleString()}
                </Text>
                <Text style={styles.stepsLabel}>steps</Text>
              </View>

              {team.is_admin && !isMe && (
                <TouchableOpacity
                  style={styles.trashBtn}
                  onPress={() => openDeleteModal(item.user_id, item.name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                </TouchableOpacity>
              )}

              <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
            </View>
          );
        }}
      />

      {team.is_admin && (
        <TouchableOpacity
          style={styles.deleteTeamBtn}
          onPress={openDeleteTeamModal}
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

      {/* DELETE TEAM MODAL */}
      <Modal
        visible={deleteTeamModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteTeamModalVisible(false)}
      >
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
              You are about to{" "}
              <Text style={{ fontWeight: "800", color: "#DC2626" }}>
                permanently delete
              </Text>{" "}
              <Text style={{ fontWeight: "700", color: "#0F172A" }}>
                {team.name}
              </Text>
              .
            </Text>
            <Text style={styles.modalSubBody}>
              All members will be removed from the team and the leaderboard will
              be gone. Their personal step history will not be deleted.
            </Text>

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
              value={deleteTeamConfirmText}
              onChangeText={setDeleteTeamConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholderTextColor="#94A3B8"
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

      {/* DELETE MEMBER MODAL */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent
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
              <Text style={styles.modalTitle}>Remove Member?</Text>
            </View>

            <Text style={styles.modalBody}>
              You are about to remove{" "}
              <Text style={{ fontWeight: "700", color: "#0F172A" }}>
                {memberToDelete?.name}
              </Text>{" "}
              from the team.
            </Text>
            <Text style={styles.modalSubBody}>
              Their fitness history will not be deleted, but they will lose
              access to the team leaderboard.
            </Text>

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

      {/* RENAME MODAL */}
      <Modal
        visible={renameModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="pencil" size={36} color="#0284C7" />
              <Text style={styles.modalTitle}>Rename Team</Text>
            </View>

            <Text style={styles.modalBody}>
              Give your team a new name. All members will see the change
              immediately.
            </Text>

            <TextInput
              style={styles.renameInput}
              placeholder="Team name"
              value={renameValue}
              onChangeText={setRenameValue}
              maxLength={150}
              autoFocus
              autoCorrect={false}
              placeholderTextColor="#94A3B8"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#F8FAFC" },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748B",
    marginVertical: 15,
  },
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
  rankBadge: {
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  rankText: { fontSize: 16, fontWeight: "800", color: "#475569" },
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
  memberStatus: { fontSize: 12, color: "#64748B", marginTop: 2 },
  stepsWrap: { alignItems: "flex-end", marginRight: 8 },
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

  // Delete team button
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
  deleteTeamBtnText: {
    color: "#DC2626",
    fontWeight: "800",
    fontSize: 15,
  },

  // Modal shared
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
  modalBtnCancelText: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 15,
  },

  // Delete modal
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
  modalBtnDeleteText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },

  // Rename modal
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
  modalBtnSaveText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
});
