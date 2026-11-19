import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [target, setTarget] = useState(5000);
  const [loading, setLoading] = useState(true);
  const [hasNetError, setHasNetError] = useState(false);
  const [summary, setSummary] = useState(null);

  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
  const router = useRouter();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const dataRes = await fetch(`${API_BASE}/steps/data`, {
        credentials: "include",
        signal: controller.signal,
      });

      if (dataRes.status === 401) {
        clearTimeout(timeoutId);
        return router.replace("/login?sessionExpired=true");
      }
      if (!dataRes.ok) throw new Error("Target endpoint error");

      const targetContentType = dataRes.headers.get("content-type");
      if (
        !targetContentType ||
        !targetContentType.includes("application/json")
      ) {
        throw new Error("Invalid format received");
      }
      const dataJson = await dataRes.json();
      if (dataJson.status === "success") setTarget(dataJson.target_steps);

      const res = await fetch(`${API_BASE}/steps/performance`, {
        credentials: "include",
        signal: controller.signal,
      });

      if (res.status === 401) {
        clearTimeout(timeoutId);
        return router.replace("/login?sessionExpired=true");
      }
      if (!res.ok) throw new Error("Performance endpoint error");

      const perfContentType = res.headers.get("content-type");
      if (!perfContentType || !perfContentType.includes("application/json")) {
        throw new Error("Invalid performance format");
      }

      const json = await res.json();
      if (json.status === "success") {
        const activeHistory = (json.history || []).filter(
          (item) => item && item.date,
        );
        setHistory(activeHistory);
        setSummary(json.summary || null);
        setHasNetError(false);
      }

      clearTimeout(timeoutId);
    } catch (e) {
      clearTimeout(timeoutId);
      console.log("Fetch history parsing failed:", e);
      setHistory((prev) => prev);
      setHasNetError(true);
    } finally {
      setLoading(false);
    }
  };

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
            <Text style={styles.summaryTitleSubtext}>
              Your Complete Fitness Journey
            </Text>
          </View>
        </View>

        <View style={styles.summaryTotalStrip}>
          <View style={styles.stripMetric}>
            <MaterialCommunityIcons
              name="shoe-print"
              size={16}
              color="#4ecca3"
            />
            <Text style={styles.stripLabel}>STEPS</Text>
            <Text style={styles.stripVal}>
              {summary?.combined_steps?.display ?? "—"}
            </Text>
          </View>
          <View style={styles.stripMetricDivider} />
          <View style={styles.stripMetric}>
            <MaterialCommunityIcons
              name="map-marker-distance"
              size={16}
              color="#4ecca3"
            />
            <Text style={styles.stripLabel}>DISTANCE</Text>
            <Text style={styles.stripVal}>
              {summary?.combined_km?.display ?? "0"}{" "}
              <Text style={styles.unitText}>KM</Text>
            </Text>
          </View>
          <View style={styles.stripMetricDivider} />
          <View style={styles.stripMetric}>
            <MaterialCommunityIcons
              name="calendar-check"
              size={16}
              color="#4ecca3"
            />
            <Text style={styles.stripLabel}>DAYS ACTIVE</Text>
            <Text style={styles.stripVal}>
              {summary?.days_tracked ?? history.length}
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
        Your performance history will appear here once you start syncing your
        steps to the cloud.
      </Text>
    </View>
  );

  const renderDayBlock = ({ item }) => {
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
    const strokeWidth = 5; // Very thin, elegant stroke
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
          {/* Left side: Numbers */}
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

          {/* Right side: Thin Ring */}
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
      <View
        style={[
          styles.container,
          { justifyContent: "center", backgroundColor: "#1a1a2e" },
        ]}
      >
        <ActivityIndicator size="large" color="#4ecca3" />
      </View>
    );
  }

  return (
    <LinearGradient colors={["#1a1a2e", "#16213e"]} style={styles.container}>
      <Text style={styles.headerTitle}>📊 Your Fitness Overview</Text>

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
          <Text
            style={{
              color: "#a4b0be",
              fontSize: 14,
              textAlign: "center",
              lineHeight: 22,
              marginBottom: 24,
            }}
          >
            FitWisely needs a live network link to load your historical
            performance data.
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
              fetchHistory();
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
          ListHeaderComponent={renderHeaderSummary}
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
  listPadding: { paddingHorizontal: 16, paddingBottom: 30 },

  // Summary Block
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
  stripMetricDivider: { width: 1, height: "70%", backgroundColor: "#ffffff15" },
  stripLabel: {
    color: "#a4b0be",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  stripVal: { color: "#ffffff", fontSize: 16, fontWeight: "800", marginTop: 4 },

  // Day Block
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

  // Combined / Goal Section
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

  // New Layout: Numbers Left, Ring Right
  progressLayoutWrapper: {
    flexDirection: "row",
    justifyContent: "space-between", // Pushes ring to the right, numbers to left
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

  // Thin Ring
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
    fontSize: 14, // Small, elegant text inside the ring
    fontWeight: "600",
    letterSpacing: 0,
  },

  // Empty State
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
