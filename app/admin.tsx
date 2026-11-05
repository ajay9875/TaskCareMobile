// app/admin.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
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

function statusColor(state: AdminUser["state"]): string {
  switch (state) {
    case "online":
      return "#16A34A"; // green
    case "offline":
      return "#94A3B8"; // slate
    case "signed_out":
      return "#DC2626"; // red
    case "never":
    default:
      return "#94A3B8";
  }
}

type AdminUser = {
  id: number;
  name: string;
  email: string;
  target_steps: number;
  state: "online" | "offline" | "never" | "signed_out";
  last_seen: string | null;
  label: string;
};

export default function AdminPanel() {
  const router = useRouter();
  const { isAdmin, isLoggedIn } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guard: never fetch if not logged in or not an admin
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      Alert.alert("Access Denied", "You do not have admin privileges.");
      router.replace("/");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/users`, {
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
        const data = await res.json();
        if (data.status === "success") setUsers(data.users || []);
      } catch (e) {
        Alert.alert("Error", "Failed to load users. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin, isLoggedIn]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBlock}>
        <MaterialCommunityIcons
          name="shield-crown-outline"
          size={40}
          color="#7C3AED"
        />
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <Text style={styles.headerSubtitle}>
          {users.length} user{users.length === 1 ? "" : "s"} · tap a row to view
          their history
        </Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 30 }}
        renderItem={({ item }) => {
          const initial = item.name?.trim().charAt(0).toUpperCase() || "?";
          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.75}
              onPress={() =>
                router.push({
                  pathname: "/admin/user/[id]",
                  params: { id: String(item.id) },
                })
              }
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: colorForUser(item.id) },
                ]}
              >
                <Text style={styles.avatarText}>{initial}</Text>
              </View>

              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowEmail} numberOfLines={1}>
                  {item.email}
                </Text>
                <Text style={styles.rowMeta}>
                  ID #{item.id} · Target {item.target_steps.toLocaleString()}{" "}
                  steps
                </Text>

                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusColor(item.state) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: statusColor(item.state) },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={60}
              color="#CBD5E1"
            />
            <Text style={{ color: "#94A3B8", marginTop: 10, fontSize: 15 }}>
              No users found.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", paddingHorizontal: 16 },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  headerBlock: { alignItems: "center", marginVertical: 20 },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "500",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
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
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  rowText: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  rowEmail: { fontSize: 13, color: "#475569", marginTop: 1 },
  rowMeta: { fontSize: 11, color: "#94A3B8", marginTop: 4, fontWeight: "600" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
