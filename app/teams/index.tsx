// app/teams/index.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
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
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // Rename team modal state
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete member modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/teams/my-team`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.status === "success") setTeam(data.team);
    } catch (e) {
      Alert.alert("Error", "Could not load team");
    } finally {
      setLoading(false);
    }
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
    const deepLink = `taskcaremobile://teams/join?code=${team.join_code}`;
    Share.share({
      message: `Join my team "${team.name}" on TaskCare360!\nUse code: ${team.join_code}\nOr click: ${deepLink}`,
    });
  };

  // ─────────────────────────────────────────────────────────────
  // RENAME TEAM LOGIC
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // DELETE MEMBER LOGIC
  // ─────────────────────────────────────────────────────────────
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

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  // ─── NO TEAM: Show Create / Join Options ───
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

  // ─── HAS TEAM: Show Dashboard ───
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

      <Text style={styles.subtitle}>Team Members</Text>

      <FlatList
        data={team.members}
        keyExtractor={(item) => item.user_id.toString()}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => {
          const isMe = item.user_id === team.current_user_id;

          return (
            <View style={styles.row}>
              {/* Tappable Body (View History) */}
              <TouchableOpacity
                style={styles.rowBody}
                activeOpacity={0.7}
                onPress={() => {
                  if (!team.is_admin) {
                    Alert.alert(
                      "Team Admins Only",
                      "Only team admins can view member history.",
                    );
                    return;
                  }
                  router.push({
                    pathname: `/teams/member/[id]`,
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
                    {item.name} {item.role === "admin" ? "👑" : ""}
                  </Text>
                  <Text style={styles.memberStatus}>
                    {item.is_signed_in ? "🟢 Signed In" : "⚪ Signed Out"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Actions: Trash (Admins only) + Chevron */}
              <View style={styles.actionsWrap}>
                {team.is_admin && !isMe && (
                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => openDeleteModal(item.user_id, item.name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  </TouchableOpacity>
                )}
                <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
              </View>
            </View>
          );
        }}
      />

      {/* ─────────────────────────────────────────────────────────
          DELETE CONFIRMATION MODAL
      ───────────────────────────────────────────────────────── */}
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

      {/* ─────────────────────────────────────────────────────────
          RENAME TEAM MODAL
      ───────────────────────────────────────────────────────── */}
      <Modal
        visible={renameModalVisible}
        animationType="fade"
        transparent={true}
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

  // List Row Styles
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
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

  // Actions
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
