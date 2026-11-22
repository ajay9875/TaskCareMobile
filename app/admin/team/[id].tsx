// app/admin/team/[id].tsx
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

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

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

export default function AdminTeamDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTeam = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await fetch(`${API_BASE}/superadmin/teams/${id}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data.status === "success") setTeam(data.team);
      } catch (e) {
        console.log(e);
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

  const sortedMembers = useMemo(() => {
    return [...(team?.members || [])].sort((a: any, b: any) =>
      (a.name || "").localeCompare(b.name || "", undefined, {
        sensitivity: "base",
      }),
    );
  }, [team?.members]);

  // Initial full-screen loading state
  if (loading && !team) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }

  if (!team) {
    return (
      <Text style={{ textAlign: "center", marginTop: 50 }}>Team not found</Text>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      {/* Header (Static) */}
      <View style={{ padding: 20, backgroundColor: "#1E293B" }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#fff" }}>
          {team.name}
        </Text>
        <Text style={{ color: "#94A3B8", marginTop: 4 }}>
          Code: {team.join_code} • {team.members?.length} Members
        </Text>
      </View>

      {/* Scrollable Member List */}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTeam(true)}
            tintColor="#4F46E5"
            colors={["#4F46E5"]}
          />
        }
      >
        {team.members?.length === 0 ? (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={48}
              color="#CBD5E1"
            />
            <Text style={{ color: "#64748B", marginTop: 10 }}>
              No members in this team yet.
            </Text>
          </View>
        ) : (
          sortedMembers.map((item: any, index: number) => (
            <TouchableOpacity
              key={item.user_id.toString()}
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: "/admin/user/[id]",
                  params: { id: item.user_id },
                })
              }
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: getAvatarColor(index) },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  {item.name?.charAt(0)}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "700" }}>
                  {item.name} {item.role === "admin" ? "👑" : ""}
                </Text>
                <Text style={{ fontSize: 12, color: "#64748B" }}>
                  {item.email || "No email"}
                </Text>

                <StatusPill
                  state={item.state}
                  label={item.label}
                  isSignedIn={item.is_signed_in}
                />
              </View>

              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
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
});
