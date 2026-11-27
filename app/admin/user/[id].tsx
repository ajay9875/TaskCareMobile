// app/admin/user/[id].tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../../context/ThemeContext";
import { getAdminColors, statusColorFor } from "../../../utils/adminTheme";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

type AdminUserInfo = {
  id: number;
  name: string;
  email: string;
  last_seen?: string | null;
  last_status_change?: string | null;
  is_signed_in?: boolean;
  target_steps?: number;
  status_state?: "online" | "offline" | "never" | "signed_out";
  status_label?: string;
};

// ─── Theme palette for this screen (built on the shared admin colors) ───
function getPalette(isDark: boolean) {
  const c = getAdminColors(isDark);
  return {
    c,
    gradient: (isDark ? ["#1a1a2e", "#16213e"] : ["#F8FAFC", "#EEF2FF"]) as [
      string,
      string,
    ],
    pageBg: isDark ? "#0f0f0f" : "#F8FAFC",
    accent: isDark ? "#4ecca3" : "#0D9488",
    accentFill: "#4ecca3",
    accentSoft: isDark ? "#4ecca315" : "#0D948815",
    accentBorder: isDark ? "#4ecca340" : "#0D948840",
    orange: isDark ? "#ff6b35" : "#EA580C",
    title: c.text,
    text: c.text,
    soft: c.muted,
    surface: isDark ? "#ffffff09" : c.surface,
    border: isDark ? "#ffffff15" : c.border,
    inner: isDark ? "#ffffff04" : c.surfaceAlt,
    innerBorder: isDark ? "#ffffff08" : c.border,
    pill: isDark ? "#ffffff10" : c.chipBg,
    pillBorder: isDark ? "#ffffff18" : c.chipBorder,
    summaryBg: isDark ? "#1a1a1a" : c.surface,
    strip: isDark ? "#00000040" : "#F1F5F9",
    stripBorder: isDark ? "#ffffff10" : c.border,
    stripIcon: isDark ? "#ffffff" : "#334155",
    divider: isDark ? "#ffffff15" : c.border,
    ringTrack: isDark ? "#ffffff10" : "#E2E8F0",
    titleShadow: isDark ? "rgba(78, 204, 163, 0.3)" : "transparent",
    shadow: isDark ? "#4ecca3" : "#000000",
    inputBg: isDark ? "#ffffff10" : c.surfaceAlt,
    inputBorder: isDark ? "#ffffff20" : c.border,
    modalBg: isDark ? "#1a1a2e" : c.surface,
  };
}
type Palette = ReturnType<typeof getPalette>;

function createStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, paddingTop: 25, backgroundColor: p.pageBg },
    centered: { justifyContent: "center", alignItems: "center" },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 16,
      color: p.title,
      letterSpacing: 0.5,
      textShadowColor: p.titleShadow,
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 10,
    },
    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: p.pill,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: p.pillBorder,
      gap: 5,
    },
    metaDot: { width: 6, height: 6, borderRadius: 3 },
    metaPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
    listPadding: { paddingHorizontal: 16, paddingBottom: 30 },

    /* User header block */
    userHeaderCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: p.surface,
      borderRadius: 18,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: p.border,
    },
    userAvatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: p.accentFill,
      justifyContent: "center",
      alignItems: "center",
    },
    userAvatarText: { color: "#0f0f0f", fontSize: 22, fontWeight: "800" },
    userName: { color: p.text, fontSize: 18, fontWeight: "800" },
    userEmail: { color: p.soft, fontSize: 13, marginTop: 2 },
    userId: {
      color: p.accent,
      fontSize: 11,
      marginTop: 4,
      fontWeight: "700",
      letterSpacing: 0.6,
    },

    /* Summary card */
    summaryDaysText: {
      color: p.accent,
      fontSize: 11,
      marginTop: 2,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    summaryCard: {
      backgroundColor: p.summaryBg,
      borderRadius: 20,
      padding: 18,
      marginBottom: 24,
      borderWidth: 1.5,
      borderColor: p.accentBorder,
      elevation: 5,
      shadowColor: p.shadow,
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
      borderBottomColor: p.accentBorder,
    },
    summaryIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: p.accentSoft,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    summaryTitleTextContainer: { flex: 1 },
    summaryTitleText: {
      color: p.accent,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 1,
    },
    summaryTitleSubtext: {
      color: p.soft,
      fontSize: 11,
      marginTop: 2,
      fontWeight: "500",
    },
    summaryTotalStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: p.strip,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.stripBorder,
    },
    stripMetric: { alignItems: "center", flex: 1, gap: 2 },
    stripMetricDivider: {
      width: 1,
      height: "70%",
      backgroundColor: p.divider,
    },
    stripLabel: {
      color: p.soft,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.8,
      marginTop: 4,
    },
    stripVal: {
      color: p.text,
      fontSize: 16,
      fontWeight: "800",
      marginTop: 4,
    },

    /* Day card */
    card: {
      backgroundColor: p.surface,
      padding: 18,
      borderRadius: 22,
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: p.border,
    },
    dateText: {
      fontSize: 17,
      color: p.text,
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
      color: p.accent,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.8,
    },
    modeStatBlock: {
      backgroundColor: p.inner,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.innerBorder,
    },
    modeStatVal: {
      color: p.text,
      fontSize: 18,
      fontWeight: "bold",
      marginTop: 4,
    },
    modeStatLabel: {
      color: p.soft,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    unitText: { fontSize: 11, color: p.soft, fontWeight: "500" },
    combinedDivider: {
      height: 1.5,
      backgroundColor: p.divider,
      marginVertical: 16,
    },
    combinedHeading: {
      color: p.accent,
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
    numbersColumn: { flexDirection: "column", justifyContent: "center" },
    stepMetricItem: { flexDirection: "row", alignItems: "center", gap: 12 },
    textDataContainer: { flexDirection: "column" },
    stepText: {
      fontSize: 20,
      fontWeight: "800",
      color: p.text,
      lineHeight: 24,
    },
    stepMetricLabel: {
      color: p.soft,
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
      color: p.text,
      fontSize: 14,
      fontWeight: "600",
      letterSpacing: 0,
    },

    /* Empty / error states */
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
      color: p.text,
      marginBottom: 10,
    },
    emptySubtitle: {
      fontSize: 15,
      color: p.soft,
      textAlign: "center",
      lineHeight: 22,
    },
    errorWrap: {
      flex: 0.8,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 30,
    },
    errorTitle: {
      color: p.text,
      fontSize: 20,
      fontWeight: "800",
      marginBottom: 8,
      textAlign: "center",
    },
    retryBtn: {
      borderColor: p.accent,
      borderWidth: 1.5,
      paddingVertical: 12,
      paddingHorizontal: 28,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    retryText: { color: p.accent, fontWeight: "700", fontSize: 14 },

    /* Reset password */
    resetPasswordButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.accentFill,
      paddingVertical: 13,
      borderRadius: 12,
      marginBottom: 20,
      gap: 8,
    },
    resetPasswordButtonText: {
      color: "#1a1a2e",
      fontSize: 14,
      fontWeight: "800",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: p.c.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    resetModal: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: p.modalBg,
      borderRadius: 20,
      padding: 22,
      borderWidth: 1,
      borderColor: p.accentBorder,
    },
    modalIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: p.accentSoft,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginBottom: 14,
    },
    modalTitle: {
      color: p.text,
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
    },
    modalSubtitle: {
      color: p.soft,
      fontSize: 13,
      textAlign: "center",
      marginTop: 7,
      marginBottom: 20,
    },
    passwordInput: {
      backgroundColor: p.inputBg,
      borderWidth: 1,
      borderColor: p.inputBorder,
      borderRadius: 11,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: p.text,
      fontSize: 14,
      marginBottom: 12,
    },
    confirmResetButton: {
      backgroundColor: p.accentFill,
      paddingVertical: 14,
      borderRadius: 11,
      alignItems: "center",
      marginTop: 5,
    },
    confirmResetText: { color: "#1a1a2e", fontWeight: "800", fontSize: 14 },
    cancelResetButton: { paddingVertical: 12, alignItems: "center" },
    cancelResetText: { color: p.soft, fontWeight: "700", fontSize: 14 },
  });
}

const lightPalette = getPalette(false);
const darkPalette = getPalette(true);
const lightStyles = createStyles(lightPalette);
const darkStyles = createStyles(darkPalette);

export default function AdminUserHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // ✅ Theme
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const p = isDark ? darkPalette : lightPalette;
  const c = p.c;
  const styles = isDark ? darkStyles : lightStyles;

  const [userInfo, setUserInfo] = useState<AdminUserInfo | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [target, setTarget] = useState(5000);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasNetError, setHasNetError] = useState(false);
  // Color is derived at render time so it follows the theme
  const [status, setStatus] = useState<{
    state: "online" | "offline" | "never" | "signed_out";
    label: string;
  } | null>(null);

  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

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

  const handleAdminPasswordReset = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      alert("Please enter and confirm the new password.");
      return;
    }

    if (newPassword.length < 6) {
      alert("Password must contain at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setResetLoading(true);

    try {
      const res = await fetch(`${API_BASE}/admin/users/${id}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      const json = await res.json();

      if (res.status === 401) {
        setResetModalVisible(false);
        router.replace("/login?sessionExpired=true");
        return;
      }

      if (!res.ok) {
        alert(json.message || "Unable to reset password.");
        return;
      }

      alert("User password has been reset successfully.");

      setNewPassword("");
      setConfirmPassword("");
      setResetModalVisible(false);
    } catch (error) {
      alert("Network error. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  // ─── User header block ────────────────────────────────────────
  const renderUserHeader = () => {
    if (!userInfo) return null;
    const initial = userInfo.name?.trim().charAt(0).toUpperCase() || "?";

    const signedInLabel = userInfo.is_signed_in ? "Signed In" : "Signed Out";
    const signedInColor = userInfo.is_signed_in ? c.success : c.danger;
    const statusColor = statusColorFor(c, status?.state);

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
                  style={[styles.metaDot, { backgroundColor: statusColor }]}
                />
                <Text style={[styles.metaPillText, { color: statusColor }]}>
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
              <Ionicons name="flag-outline" size={11} color={p.accent} />
              <Text style={[styles.metaPillText, { color: p.accent }]}>
                Target {(userInfo.target_steps ?? 5000).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ─── Lifetime summary ─────────────────────────────────────────
  const renderHeaderSummary = () => {
    if (history.length === 0) return null;
    return (
      <View style={styles.summaryCard}>
        <View style={styles.summaryTitleRow}>
          <View style={styles.summaryIconWrapper}>
            <MaterialCommunityIcons
              name="trophy-outline"
              size={20}
              color={p.accent}
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
              color={p.stripIcon}
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
              color={p.stripIcon}
            />
            <Text style={styles.stripLabel}>DISTANCE</Text>
            <Text style={styles.stripVal}>
              {summary?.combined_km?.display ?? "0"}{" "}
              <Text style={styles.unitText}>KM</Text>
            </Text>
          </View>
          <View style={styles.stripMetricDivider} />
          <View style={styles.stripMetric}>
            <MaterialCommunityIcons name="fire" size={16} color={p.orange} />
            <Text style={styles.stripLabel}>ENERGY</Text>
            <Text style={[styles.stripVal, { color: p.orange }]}>
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
              <MaterialCommunityIcons name="walk" size={18} color={p.accent} />
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
              <Text style={[styles.modeStatVal, { color: p.orange }]}>
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
                borderColor: p.divider,
                paddingLeft: 15,
                flex: 0.9,
              },
            ]}
          >
            <View style={styles.columnHeadingRow}>
              <MaterialCommunityIcons
                name="speedometer"
                size={18}
                color={p.accent}
              />
              <Text style={styles.columnHeading}>METRICS</Text>
            </View>
            <View style={styles.modeStatBlock}>
              <Text style={styles.modeStatVal}>{pace}</Text>
              <Text style={styles.modeStatLabel}>PACE (MIN/KM)</Text>
              <Text style={styles.modeStatVal}>{stepsPerKm}</Text>
              <Text style={styles.modeStatLabel}>STEPS / KM</Text>
              <Text style={[styles.modeStatVal, { color: p.accent }]}>
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
              <Ionicons name="checkmark-circle" size={18} color={p.accent} />
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
                color={stepsLeft === 0 ? p.accent : p.orange}
              />
              <View style={styles.textDataContainer}>
                <Text
                  style={[
                    styles.stepText,
                    stepsLeft === 0 && { color: p.accent },
                  ]}
                >
                  {stepsLeft.toLocaleString()}
                </Text>
                <Text style={styles.stepMetricLabel}>STEPS LEFT</Text>
              </View>
            </View>

            <View style={[styles.stepMetricItem, { marginTop: 12 }]}>
              <Ionicons name="trending-up" size={18} color={p.accent} />
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
                stroke={p.ringTrack}
                strokeWidth={strokeWidth}
                fill="none"
              />
              <Circle
                cx="45"
                cy="45"
                r={radius}
                stroke={p.accent}
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
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    );
  }

  return (
    <LinearGradient colors={p.gradient} style={styles.container}>
      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resetModal}>
            <View style={styles.modalIcon}>
              <Ionicons name="lock-closed" size={25} color={p.accent} />
            </View>

            <Text style={styles.modalTitle}>Reset User Password</Text>

            <Text style={styles.modalSubtitle}>
              Set a new password for {userInfo?.name}.
            </Text>

            <TextInput
              style={styles.passwordInput}
              placeholder="Enter new password"
              placeholderTextColor={c.faint}
              keyboardAppearance={isDark ? "dark" : "light"}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!resetLoading}
            />

            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm new password"
              placeholderTextColor={c.faint}
              keyboardAppearance={isDark ? "dark" : "light"}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!resetLoading}
            />

            <TouchableOpacity
              style={styles.confirmResetButton}
              onPress={handleAdminPasswordReset}
              disabled={resetLoading}
            >
              {resetLoading ? (
                <ActivityIndicator color="#1a1a2e" />
              ) : (
                <Text style={styles.confirmResetText}>Update Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelResetButton}
              onPress={() => {
                setResetModalVisible(false);
                setNewPassword("");
                setConfirmPassword("");
              }}
              disabled={resetLoading}
            >
              <Text style={styles.cancelResetText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Text style={styles.headerTitle}>👤 User History</Text>

      {hasNetError ? (
        <View style={styles.errorWrap}>
          <MaterialCommunityIcons
            name="wifi-strength-alert-outline"
            size={70}
            color={p.orange}
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.errorTitle}>Could Not Load History</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoading(true);
              fetchUserHistory();
            }}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={p.accent} />
            <Text style={styles.retryText}>Try Again</Text>
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

              {userInfo && (
                <TouchableOpacity
                  style={styles.resetPasswordButton}
                  onPress={() => setResetModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color="#1a1a2e"
                  />
                  <Text style={styles.resetPasswordButtonText}>
                    Reset User Password
                  </Text>
                </TouchableOpacity>
              )}

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
