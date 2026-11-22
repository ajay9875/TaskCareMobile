import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../../context/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

const AVATAR_COLORS = [
  "#4F46E5",
  "#0891B2",
  "#16A34A",
  "#D97706",
  "#DB2777",
  "#7C3AED",
  "#0D9488",
  "#EA580C",
  "#2563EB",
  "#9333EA",
  "#65A30D",
  "#E11D48",
];

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function statusColorFor(state?: string): string {
  switch (state) {
    case "online":
      return "#16A34A";
    case "signed_out":
      return "#DC2626";
    case "offline":
      return "#94A3B8";
    default:
      return "#94A3B8";
  }
}

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

export default function AdminTeamDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // Delete Member Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTeam = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const res = await fetch(`${API_BASE}/superadmin/teams/${id}`, {
          credentials: "include",
        });

        if (!res.ok) {
          setTeam(null);
          return;
        }

        const data = await res.json();

        if (data.status === "success") {
          setTeam(data.team);
        } else {
          setTeam(null);
        }
      } catch (error) {
        console.log("Error fetching team:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Team admin first, all other members alphabetically.
  // Steps and user IDs are deliberately NOT used for sorting.
  const sortedMembers = useMemo(() => {
    return [...(team?.members ?? [])].sort((a: any, b: any) => {
      const aIsAdmin = isTeamAdmin(a);
      const bIsAdmin = isTeamAdmin(b);

      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;

      return (a.name ?? "").localeCompare(b.name ?? "", undefined, {
        sensitivity: "base",
      });
    });
  }, [team?.members]);

  // ─── DELETE MEMBER LOGIC ───
  const openDeleteModal = (memberId: number, memberName: string) => {
    setMemberToDelete({ id: memberId, name: memberName });
    setDeleteConfirmText("");
    setDeleteModalVisible(true);
  };

  const handleTransferAdmin = async (userId: number, userName: string) => {
    const makingSelfAdmin = Number(userId) === Number(user?.id);

    Alert.alert(
      makingSelfAdmin ? "Claim Admin Role?" : "Transfer Admin Role?",
      makingSelfAdmin
        ? `You will become the new team admin. The current admin will be demoted to a regular member.`
        : `${userName} will become the new team admin.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            setIsTransferring(true);
            try {
              const res = await fetch(
                `${API_BASE}/superadmin/teams/${id}/transfer-admin`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ user_id: userId }),
                },
              );

              const data = await res.json().catch(() => ({}));

              if (res.ok) {
                Alert.alert(
                  "Success",
                  makingSelfAdmin
                    ? "You are now the team admin."
                    : `${userName} is now the team admin.`,
                );
                fetchTeam();
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
        `${API_BASE}/superadmin/teams/${id}/members/${memberToDelete.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        Alert.alert("Removed", `${memberToDelete.name} removed.`);
        fetchTeam();
      } else {
        Alert.alert(
          "Error",
          data.error || data.message || "Failed to remove member",
        );
      }
    } catch (e) {
      Alert.alert("Error", "Network error");
    } finally {
      setIsDeleting(false);
      setMemberToDelete(null);
    }
  };

  if (loading && !team) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!team) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.notFoundText}>Team not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Team header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{team.name}</Text>
        <Text style={styles.headerSubtitle}>
          Code: {team.join_code} • {team.members?.length ?? 0} Members
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTeam(true)}
            tintColor="#4F46E5"
            colors={["#4F46E5"]}
          />
        }
      >
        {sortedMembers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={48}
              color="#CBD5E1"
            />
            <Text style={styles.emptyText}>No members in this team yet.</Text>
          </View>
        ) : (
          sortedMembers.map((item: any, index: number) => {
            const isAdmin = isTeamAdmin(item);
            const isYou = Number(user?.id) === Number(item.user_id);

            return (
              <View key={String(item.user_id)} style={styles.memberRow}>
                <TouchableOpacity
                  style={styles.rowBody}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: "/admin/user/[id]",
                      params: { id: String(item.user_id) },
                    })
                  }
                >
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: getAvatarColor(index) },
                    ]}
                  >
                    <Text style={styles.avatarText}>
                      {item.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </Text>
                  </View>

                  <View style={styles.memberInfo}>
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

                      {isYou && (
                        <View style={styles.youLabel}>
                          <Text style={styles.youLabelText}>You</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.emailText} numberOfLines={1}>
                      {item.email || "No email"}
                    </Text>

                    <Text style={styles.stepsText}>
                      {(item.steps_today ?? 0).toLocaleString()} steps today
                    </Text>

                    <StatusPill
                      state={item.state}
                      label={item.label}
                      isSignedIn={item.is_signed_in}
                    />
                  </View>
                </TouchableOpacity>

                <View style={styles.actionsWrap}>
                  {/* 👑 Make Admin — superadmin can transfer to ANY non-admin member (including self) */}
                  {!isAdmin && (
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

                  {/* 🗑️ Trash — hide for admins and yourself */}
                  {!isAdmin && !isYou && (
                    <TouchableOpacity
                      style={styles.trashBtn}
                      onPress={() => openDeleteModal(item.user_id, item.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color="#DC2626"
                      />
                    </TouchableOpacity>
                  )}

                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ─── REMOVE MEMBER CONFIRMATION MODAL ─── */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  makeAdminBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },

  notFoundText: {
    color: "#64748B",
    fontSize: 15,
  },

  header: {
    padding: 20,
    backgroundColor: "#1E293B",
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  headerSubtitle: {
    color: "#94A3B8",
    marginTop: 4,
  },

  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  rowBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  actionsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 100,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  avatarText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 18,
  },

  memberInfo: {
    flex: 1,
    minWidth: 0,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },

  memberName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
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

  emailText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  stepsText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 6,
  },

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
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  emptyContainer: {
    alignItems: "center",
    marginTop: 40,
  },

  emptyText: {
    color: "#64748B",
    marginTop: 10,
  },

  // ─── MODAL STYLES ───
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
