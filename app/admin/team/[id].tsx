import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

export default function AdminTeamDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        // Use the specific team route we defined earlier
        const res = await fetch(`${API_BASE}/superadmin/teams/${id}`, { credentials: "include" });
        const data = await res.json();
        if (data.status === "success") setTeam(data.team);
      } catch (e) {
        console.log(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, [id]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  if (!team) return <Text style={{ textAlign: "center", marginTop: 50 }}>Team not found</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <View style={{ padding: 20, backgroundColor: "#1E293B" }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#fff" }}>{team.name}</Text>
        <Text style={{ color: "#94A3B8", marginTop: 4 }}>Code: {team.join_code} • {team.members?.length} Members</Text>
      </View>

      <FlatList
        data={team.members || []}
        keyExtractor={(item: any) => item.user_id.toString()}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.row}
            onPress={() => router.push({ pathname: "/admin/user/[id]", params: { id: item.user_id } })}
          >
            <View style={[styles.avatar, { backgroundColor: "#4F46E5" }]}>
              <Text style={{ color: "#fff", fontWeight: "bold" }}>{item.name?.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700" }}>{item.name} {item.role === 'admin' ? '👑' : ''}</Text>
              <Text style={{ fontSize: 12, color: "#64748B" }}>{item.email || "No email"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center", marginRight: 12 },
});