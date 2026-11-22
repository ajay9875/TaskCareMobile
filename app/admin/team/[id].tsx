import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
              <TouchableOpacity
                key={String(item.user_id)}
                style={styles.memberRow}
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

                <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
