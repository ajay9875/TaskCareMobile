// app/history.tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";
import { getFitColors, getFitStyles } from "../utils/fitTheme";

export default function HistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [target, setTarget] = useState(5000);
  const [loading, setLoading] = useState(true);
  const [hasNetError, setHasNetError] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const { theme } = useTheme();
  const isDark = theme === "dark";
  const c = getFitColors(isDark);
  const styles = getFitStyles(isDark);

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
          (item: any) => item && item.date,
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
              color={c.accentText}
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
              color={c.accentText}
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
              color={c.accentText}
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
              color={c.accentText}
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

    // Thin ring math
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
              <MaterialCommunityIcons
                name="walk"
                size={18}
                color={c.accentText}
              />
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
              <Text style={[styles.modeStatVal, { color: c.orange }]}>
                {walkCal} <Text style={styles.unitText}>CAL</Text>
              </Text>
              <Text style={styles.modeStatLabel}>ENERGY</Text>
            </View>
          </View>

          <View style={[styles.modeColumn, styles.modeColumnDivided]}>
            <View style={styles.columnHeadingRow}>
              <MaterialCommunityIcons
                name="speedometer"
                size={18}
                color={c.accentText}
              />
              <Text style={styles.columnHeading}>METRICS</Text>
            </View>
            <View style={styles.modeStatBlock}>
              <Text style={styles.modeStatVal}>{pace}</Text>
              <Text style={styles.modeStatLabel}>PACE (MIN/KM)</Text>
              <Text style={styles.modeStatVal}>{stepsPerKm}</Text>
              <Text style={styles.modeStatLabel}>STEPS / KM</Text>
              <Text style={[styles.modeStatVal, { color: c.accentText }]}>
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
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={c.accentText}
              />
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
                color={stepsLeft === 0 ? c.accentText : c.orange}
              />
              <View style={styles.textDataContainer}>
                <Text
                  style={[
                    styles.stepText,
                    stepsLeft === 0 && { color: c.accentText },
                  ]}
                >
                  {stepsLeft.toLocaleString()}
                </Text>
                <Text style={styles.stepMetricLabel}>STEPS LEFT</Text>
              </View>
            </View>

            <View style={[styles.stepMetricItem, { marginTop: 12 }]}>
              <Ionicons name="trending-up" size={18} color={c.accentText} />
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
                stroke={c.ringTrack}
                strokeWidth={strokeWidth}
                fill="none"
              />
              <Circle
                cx="45"
                cy="45"
                r={radius}
                stroke={c.accent}
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
          { justifyContent: "center", backgroundColor: c.gradient[0] },
        ]}
      >
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <LinearGradient colors={c.gradient} style={styles.container}>
      <Text style={styles.headerTitle}>📊 Your Fitness Overview</Text>

      {hasNetError ? (
        <View style={styles.errorWrap}>
          <MaterialCommunityIcons
            name="wifi-strength-alert-outline"
            size={70}
            color={c.orange}
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.errorTitle}>Could Not Load History</Text>
          <Text style={styles.errorText}>
            FitWisely needs a live network link to load your historical
            performance data.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoading(true);
              fetchHistory();
            }}
          >
            <MaterialCommunityIcons
              name="refresh"
              size={18}
              color={c.accentText}
            />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.date_iso ?? item.date}
          renderItem={renderDayBlock}
          extraData={isDark}
          ListHeaderComponent={renderHeaderSummary}
          ListEmptyComponent={renderEmptyHistory}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
        />
      )}
    </LinearGradient>
  );
}
