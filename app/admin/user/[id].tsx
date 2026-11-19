// app/admin/user/[id].tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

type AdminUserInfo = {
  id: number;
  name: string;
  email: string;
  last_seen?: string | null;
  last_status_change?: string | null;
  is_signed_in?: boolean;
  target_steps?: number;
  status_state?: "online" | "offline" | "never";
  status_label?: string;
};

export default function AdminUserHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [userInfo, setUserInfo] = useState<AdminUserInfo | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [target, setTarget] = useState(5000);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasNetError, setHasNetError] = useState(false);
  const [status, setStatus] = useState<{
    state: "online" | "offline" | "never";
    label: string;
    color: string;
  } | null>(null);

  useEffect(() => {
    fetchUserHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchUserHistory = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${API_BASE}/admin/users/${id}/history`, {
        credentials: "include",
        signal: controller.signal,
      });

      if (res.status === 401) {
        clearTimeout(timeoutId);
        router.replace("/login?sessionExpired=true");
        return;
      }
      if (res.status === 403) {
        clearTimeout(timeoutId);
        router.replace("/");
        return;
      }
      if (!res.ok) throw new Error("User history endpoint error");

      const ct = res.headers.get("content-type");
      if (!ct || !ct.includes("application/json")) {
        throw new Error("Invalid response format");
      }

      const json = await res.json();
      if (json.status === "success") {
        setUserInfo(json.user);
        setHistory((json.history || []).filter((i: any) => i && i.date));
        setSummary(json.summary || null);

        const isOnline = json.user?.status_state === "online";

        setStatus({
          state: json.user?.status_state ?? "never",
          label: isOnline
            ? "Active now"
            : (json.user?.status_label ?? "Not active yet"),
          color: isOnline
            ? "#16A34A"
            : json.user?.status_state === "signed_out"
              ? "#DC2626"
              : "#94A3B8",
        });

        setTarget(json.user?.target_steps ?? 5000);
        setHasNetError(false);
      }
      clearTimeout(timeoutId);
    } catch (e) {
      clearTimeout(timeoutId);
      setHasNetError(true);
    } finally {
      setLoading(false);
    }
  };

  // ─── User header block ────────────────────────────────────────
  const renderUserHeader = () => {
    if (!userInfo) return null;
    const initial = userInfo.name?.trim().charAt(0).toUpperCase() || "?";

    const signedInLabel = userInfo.is_signed_in ? "Signed In" : "Signed Out";
    const signedInColor = userInfo.is_signed_in ? "#16A34A" : "#DC2626";

    return (
      <View style={styles.userHeaderCard}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.userName}>{userInfo.name}</Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {userInfo.email}
          </Text>
          <Text style={styles.userId}>User ID #{userInfo.id}</Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginTop: 8,
              gap: 6,
            }}
          >
            {status && (
              <View style={styles.metaPill}>
                <View
                  style={[styles.metaDot, { backgroundColor: status.color }]}
                />
                <Text style={[styles.metaPillText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            )}
            <View style={styles.metaPill}>
              <View
                style={[styles.metaDot, { backgroundColor: signedInColor }]}
              />
              <Text style={[styles.metaPillText, { color: signedInColor }]}>
                {signedInLabel}
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="flag-outline" size={11} color="#4ecca3" />
              <Text style={[styles.metaPillText, { color: "#4ecca3" }]}>
                Target {(userInfo.target_steps ?? 5000).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ─── Lifetime summary: Walking | Activity ────────────────────
  const renderHeaderSummary = () => {
    if (history.length === 0) return null;
    return (
      <View style={styles.summaryCard}>
        <View style={styles.summaryTitleRow}>
          <View style={styles.summaryIconWrapper}>
            <MaterialCommunityIcons
              name="trophy-outline"
              size={20}
              color="#4ecca3"
            />
          </View>
          <View style={styles.summaryTitleTextContainer}>
            <Text style={styles.summaryTitleText}>
              {history.length === 1
                ? `${history[0]?.date_full ?? history[0]?.date ?? ""}'s SUMMARY`
                : "LIFETIME PERFORMANCE"}
            </Text>
            <Text style={styles.summaryTitleSubtext}>User Fitness Journey</Text>
            {history.length > 1 && (
              <Text style={styles.summaryDaysText}>
                {summary?.days_tracked ?? history.length} days tracked
              </Text>
            )}
          </View>
        </View>

        <View style={styles.summaryTotalStrip}>
          <View style={styles.stripMetric}>
            <MaterialCommunityIcons
              name="shoe-print"
              size={16}
              color="#ffffff"
            />
            <Text style={styles.stripLabel}>TOTAL STEPS</Text>
            <Text style={styles.stripVal}>
              {summary?.combined_steps?.display ?? "—"}
            </Text>
          </View>
          <View style={styles.stripMetricDivider} />
          <View style={styles.stripMetric}>
            <MaterialCommunityIcons
              name="map-marker-distance"
              size={16}
              color="#ffffff"
            />
            <Text style={styles.stripLabel}>DISTANCE</Text>
            <Text style={styles.stripVal}>
              {summary?.combined_km?.display ?? "0"}{" "}
              <Text style={styles.unitText}>KM</Text>
            </Text>
          </View>
          <View style={styles.stripMetricDivider} />
          <View style={styles.stripMetric}>
            <MaterialCommunityIcons name="fire" size={16} color="#ff6b35" />
            <Text style={styles.stripLabel}>ENERGY</Text>
            <Text style={[styles.stripVal, { color: "#ff6b35" }]}>
              {summary?.combined_cal?.display ?? "0"}{" "}
              <Text style={styles.unitText}>CAL</Text>
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyHistory = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No History Yet</Text>
      <Text style={styles.emptySubtitle}>
        This user has no synced step history.
      </Text>
    </View>
  );

  const renderDayBlock = ({ item }: { item: any }) => {
    const dayTarget = item.target_steps || target || 5000;
    const walkSteps =
      item.walking_steps !== undefined ? item.walking_steps : item.steps || 0;

    const walkKm = (walkSteps * 0.000762).toFixed(2);
    const walkCal = (walkSteps * 0.04).toFixed(0);

    const pace =
      walkSteps > 0 ? (1000 / (walkSteps * 0.000762)).toFixed(1) : "0.0";
    const stepsPerKm =
      walkSteps > 0
        ? Math.round(walkSteps / Math.max(0.01, parseFloat(walkKm)))
        : 0;

    const stepsLeft = Math.max(0, dayTarget - walkSteps);
    const percentage = Math.min(100, (walkSteps / dayTarget) * 100);

    // Thin Ring Math
    const radius = 38;
    const strokeWidth = 5;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <View style={styles.card}>
        <Text style={styles.dateText}>{item.date_full ?? item.date}</Text>

        <View style={styles.modeSplitRow}>
          <View style={[styles.modeColumn, { flex: 1.1 }]}>
            <View style={styles.columnHeadingRow}>
              <MaterialCommunityIcons name="walk" size={18} color="#4ecca3" />
              <Text style={styles.columnHeading}>WALKING</Text>
            </View>
            <View style={styles.modeStatBlock}>
              <Text style={styles.modeStatVal}>
                {walkSteps.toLocaleString()}
              </Text>
              <Text style={styles.modeStatLabel}>STEPS</Text>
              <Text style={styles.modeStatVal}>
                {walkKm} <Text style={styles.unitText}>KM</Text>
              </Text>
              <Text style={styles.modeStatLabel}>DISTANCE</Text>
              <Text style={[styles.modeStatVal, { color: "#ff6b35" }]}>
                {walkCal} <Text style={styles.unitText}>CAL</Text>
              </Text>
              <Text style={styles.modeStatLabel}>ENERGY</Text>
            </View>
          </View>

          <View
            style={[
              styles.modeColumn,
              {
                borderLeftWidth: 1,
                borderColor: "#ffffff15",
                paddingLeft: 15,
                flex: 0.9,
              },
            ]}
          >
            <View style={styles.columnHeadingRow}>
              <MaterialCommunityIcons
                name="speedometer"
                size={18}
                color="#4ecca3"
              />
              <Text style={styles.columnHeading}>METRICS</Text>
            </View>
            <View style={styles.modeStatBlock}>
              <Text style={styles.modeStatVal}>{pace}</Text>
              <Text style={styles.modeStatLabel}>PACE (MIN/KM)</Text>
              <Text style={styles.modeStatVal}>{stepsPerKm}</Text>
              <Text style={styles.modeStatLabel}>STEPS / KM</Text>
              <Text style={[styles.modeStatVal, { color: "#4ecca3" }]}>
                {Math.round(percentage)}%{" "}
                <Text style={styles.unitText}>DONE</Text>
              </Text>
              <Text style={styles.modeStatLabel}>GOAL PROGRESS</Text>
            </View>
          </View>
        </View>

        <View style={styles.combinedDivider} />

        <Text style={styles.combinedHeading}>DAILY GOAL PROGRESS</Text>

        <View style={styles.progressLayoutWrapper}>
          <View style={styles.numbersColumn}>
            <View style={styles.stepMetricItem}>
              <Ionicons name="checkmark-circle" size={18} color="#4ecca3" />
              <View style={styles.textDataContainer}>
                <Text style={styles.stepText}>
                  {walkSteps.toLocaleString()}
                </Text>
                <Text style={styles.stepMetricLabel}>TOTAL STEPS</Text>
              </View>
            </View>

            <View style={[styles.stepMetricItem, { marginTop: 12 }]}>
              <Ionicons
                name="flag"
                size={18}
                color={stepsLeft === 0 ? "#4ecca3" : "#ff6b35"}
              />
              <View style={styles.textDataContainer}>
                <Text
                  style={[
                    styles.stepText,
                    stepsLeft === 0 && { color: "#4ecca3" },
                  ]}
                >
                  {stepsLeft.toLocaleString()}
                </Text>
                <Text style={styles.stepMetricLabel}>STEPS LEFT</Text>
              </View>
            </View>

            <View style={[styles.stepMetricItem, { marginTop: 12 }]}>
              <Ionicons name="trending-up" size={18} color="#4ecca3" />
              <View style={styles.textDataContainer}>
                <Text style={styles.stepText}>
                  {dayTarget.toLocaleString()}
                </Text>
                <Text style={styles.stepMetricLabel}>DAILY GOAL</Text>
              </View>
            </View>
          </View>

          <View style={styles.thinRingWrapper}>
            <Svg
              width="90"
              height="90"
              viewBox="0 0 90 90"
              style={{ transform: [{ rotate: "-90deg" }] }}
            >
              <Circle
                cx="45"
                cy="45"
                r={radius}
                stroke="#ffffff08"
                strokeWidth={strokeWidth}
                fill="none"
              />
              <Circle
                cx="45"
                cy="45"
                r={radius}
                stroke="#4ecca3"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </Svg>
            <View style={styles.ringTextContainer}>
              <Text style={styles.ringPercentText}>
                {Math.round(percentage)}%
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#4ecca3" />
      </View>
    );
  }

  return (
    <LinearGradient colors={["#1a1a2e", "#16213e"]} style={styles.container}>
      <Text style={styles.headerTitle}>👤 User History</Text>

      {hasNetError ? (
        <View
          style={{
            flex: 0.8,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 30,
          }}
        >
          <MaterialCommunityIcons
            name="wifi-strength-alert-outline"
            size={70}
            color="#ff6b35"
            style={{ marginBottom: 16 }}
          />
          <Text
            style={{
              color: "#ffffff",
              fontSize: 20,
              fontWeight: "800",
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            Could Not Load History
          </Text>
          <TouchableOpacity
            style={{
              borderColor: "#4ecca3",
              borderWidth: 1.5,
              paddingVertical: 12,
              paddingHorizontal: 28,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
            onPress={() => {
              setLoading(true);
              fetchUserHistory();
            }}
          >
            <MaterialCommunityIcons name="refresh" size={18} color="#4ecca3" />
            <Text style={{ color: "#4ecca3", fontWeight: "700", fontSize: 14 }}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.date_iso ?? item.date}
          renderItem={renderDayBlock}
          ListHeaderComponent={
            <>
              {renderUserHeader()}
              {renderHeaderSummary()}
            </>
          }
          ListEmptyComponent={renderEmptyHistory}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 25, backgroundColor: "#0f0f0f" },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
    color: "#ffffff",
    letterSpacing: 0.5,
    textShadowColor: "rgba(78, 204, 163, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff10",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ffffff18",
    gap: 5,
  },
  metaDot: { width: 6, height: 6, borderRadius: 3 },
  metaPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  listPadding: { paddingHorizontal: 16, paddingBottom: 30 },

  /* User header block */
  userHeaderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff09",
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#ffffff15",
  },
  userAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#4ecca3",
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarText: { color: "#0f0f0f", fontSize: 22, fontWeight: "800" },
  userName: { color: "#ffffff", fontSize: 18, fontWeight: "800" },
  userEmail: { color: "#a4b0be", fontSize: 13, marginTop: 2 },
  userId: {
    color: "#4ecca3",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "700",
    letterSpacing: 0.6,
  },

  /* Summary card */
  summaryDaysText: {
    color: "#4ecca3",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  summaryCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: "#4ecca340",
    elevation: 5,
    shadowColor: "#4ecca3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  summaryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#4ecca320",
  },
  summaryIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#4ecca315",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  summaryTitleTextContainer: { flex: 1 },
  summaryTitleText: {
    color: "#4ecca3",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  summaryTitleSubtext: {
    color: "#a4b0be",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  summarySplitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  summaryColumn: { flex: 1, paddingRight: 10 },
  summaryColumnDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "#4ecca320",
    paddingLeft: 14,
  },
  summaryColHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  summaryColLabel: {
    color: "#4ecca3",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  summaryColVal: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  summarySubVal: {
    color: "#a4b0be",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "500",
  },
  summaryTotalStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#00000040",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ffffff10",
  },
  stripMetric: { alignItems: "center", flex: 1, gap: 2 },
  stripMetricDivider: {
    width: 1,
    height: "70%",
    backgroundColor: "#ffffff15",
  },
  stripLabel: {
    color: "#a4b0be",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  stripVal: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },

  /* Day card */
  card: {
    backgroundColor: "#ffffff09",
    padding: 18,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#ffffff15",
  },
  dateText: {
    fontSize: 17,
    color: "#ffffff",
    fontWeight: "800",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  modeSplitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modeColumn: { flex: 1, paddingRight: 5 },
  columnHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  columnHeading: {
    color: "#4ecca3",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  modeStatBlock: {
    backgroundColor: "#ffffff04",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ffffff08",
  },
  modeStatVal: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 4,
  },
  modeStatLabel: {
    color: "#a4b0be",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  unitText: { fontSize: 11, color: "#a4b0be", fontWeight: "500" },
  combinedDivider: {
    height: 1.5,
    backgroundColor: "#ffffff15",
    marginVertical: 16,
  },
  combinedHeading: {
    color: "#4ecca3",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 14,
    textAlign: "left",
  },
  progressLayoutWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  numbersColumn: {
    flexDirection: "column",
    justifyContent: "center",
  },
  stepMetricItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  textDataContainer: { flexDirection: "column" },
  stepText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 24,
  },
  stepMetricLabel: {
    color: "#a4b0be",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginTop: 2,
  },
  thinRingWrapper: {
    width: 90,
    height: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  ringTextContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ringPercentText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0,
  },

  /* Empty state */
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#a4b0be",
    textAlign: "center",
    lineHeight: 22,
  },
});
