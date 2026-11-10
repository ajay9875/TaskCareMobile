// app/admin.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

// Deterministic avatar colors so each user always gets the same color
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

type AdminUser = {
  id: number;
  name: string;
  email: string;
  target_steps: number;
  state: "online" | "offline" | "never" | "signed_out";
  last_seen: string | null;
  label: string;
  is_signed_in?: boolean;
  last_status_change?: string | null;
  created_at_label?: string;
};

type AdminTeam = {
  id: number;
  name: string;
  join_code: string;
  created_by: string;
  created_at_label: string;
  member_count: number;
};

export default function AdminPanel() {
  const router = useRouter();
  const { user, isAdmin, isLoggedIn } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-row deleting flags so we can show an inline spinner
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<number | null>(null);

  // Super Admin State
  const [isVerified, setIsVerified] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false); // Toggle for PIN visibility
  const [activeTab, setActiveTab] = useState<"users" | "teams">("users");

  // Delete Confirmation Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "user" | "team";
    id: number;
    name: string;
    extraInfo: string;
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // ─────────────────────────────────────────────────────────────
  // OPEN DELETE MODAL
  // ─────────────────────────────────────────────────────────────
  const openDeleteModal = (
    type: "user" | "team",
    item: AdminUser | AdminTeam,
  ) => {
    setDeleteConfirmText(""); // Reset text input
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

  // ─────────────────────────────────────────────────────────────
  // EXECUTE DELETE
  // ─────────────────────────────────────────────────────────────
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
          Alert.alert("Delete failed", data?.error || data?.message || "Unknown error");
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
          Alert.alert("Delete failed", data?.error || data?.message || "Unknown error");
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

  // ─────────────────────────────────────────────────────────────
  // PIN VERIFY + FETCH
  // ─────────────────────────────────────────────────────────────
  const verifyPin = async () => {
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
      }
    } catch {
      Alert.alert("Error", "Network error");
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

  if (loading) {
    return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;
  }

  // ─── PIN SCREEN ───
  if (!isVerified) {
    return (
      <SafeAreaView style={styles.container}>
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
            style={{ textAlign: "center", color: "#64748B", marginBottom: 20 }}
          >
            Enter PIN to unlock Teams and User Management
          </Text>

          {/* ── PIN Input with Visibility Toggle ── */}
          <View style={styles.pinInputWrapper}>
            <TextInput
              style={styles.pinInput}
              placeholder="••••"
              keyboardType="number-pad"
              secureTextEntry={!showPin}
              value={pin}
              onChangeText={setPin}
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
            style={{
              backgroundColor: "#7C3AED",
              padding: 15,
              borderRadius: 10,
              marginTop: 20,
            }}
          >
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
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── MAIN ADMIN DASHBOARD ───
  return (
    <SafeAreaView style={styles.container}>
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
          onPress={() => setActiveTab("users")}
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

      {activeTab === "users" ? (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.emptyBlock}>
              <MaterialCommunityIcons
                name="account-off-outline"
                size={42}
                color="#CBD5E1"
              />
              <Text style={styles.emptyText}>No users yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isDeleting = deletingUserId === item.id;
            // inside renderItem:
            const isSelf = user?.id === item.id;
            return (
              <View style={styles.row}>
                {/* ── Tappable main body → opens user detail ── */}
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
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowEmail} numberOfLines={1}>
                      {item.email}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      Created {item.created_at_label ?? "—"} • ID #{item.id}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* ── Right-side actions: trash + chevron ── */}
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
                  <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
                </View>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.emptyBlock}>
              <MaterialCommunityIcons
                name="account-group-outline"
                size={42}
                color="#CBD5E1"
              />
              <Text style={styles.emptyText}>No teams yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isDeleting = deletingTeamId === item.id;
            return (
              <View style={styles.row}>
                {/* ── Tappable main body → opens team detail ── */}
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
                  <View style={[styles.avatar, { backgroundColor: "#4F46E5" }]}>
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
                      Created {item.created_at_label} • {item.member_count}{" "}
                      members
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* ── Right-side actions: trash + chevron ── */}
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
                  <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          DELETE CONFIRMATION MODAL (REQUIRES TYPING "DELETE")
      ───────────────────────────────────────────────────────────── */}
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
                  }, // disabled style
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
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
  },

  // PIN Input Styles
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
  eyeIcon: {
    padding: 5,
  },

  // FlatList Row Styles
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
  rowBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
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
  rowMeta: { fontSize: 11, color: "#94A3B8", marginTop: 4, fontWeight: "600" },

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

  // Modal Styles
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
  modalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
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
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
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
});
