// app/teams/member/[id].tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../context/ThemeContext";
import {
  getFitColors,
  getFitStyles,
  type FitColors,
} from "../../../utils/fitTheme";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

// Team admin check
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

type MemberInfo = {
  id: number;
  name: string;
  email: string;
  last_seen?: string | null;
  last_status_change?: string | null;
  is_signed_in?: boolean;
  target_steps?: number;
  status_state?: "online" | "offline" | "never";
  status_label?: string;
  role?: string;
  is_admin?: boolean;
  is_team_admin?: boolean;
  team_admin?: boolean;
};

// Styles that only this screen needs (shared ones live in utils/fitTheme.ts)
function createMemberStyles(c: FitColors) {
  return StyleSheet.create({
    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.chipBg,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.chipBorder,
      gap: 5,
    },
    metaDot: { width: 6, height: 6, borderRadius: 3 },
    metaPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
    userHeaderCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 18,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    userAvatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: c.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    userAvatarText: { color: "#0f0f0f", fontSize: 22, fontWeight: "800" },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 2,
    },
    adminLabel: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.adminBg,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      gap: 3,
    },
    adminLabelText: { fontSize: 10, fontWeight: "800", color: c.adminText },
    youLabel: {
      backgroundColor: c.youBg,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    youLabelText: { fontSize: 10, fontWeight: "800", color: c.youText },
    userName: { color: c.text, fontSize: 18, fontWeight: "800" },
    userEmail: { color: c.muted, fontSize: 13, marginTop: 2 },
    userId: {
      color: c.accentText,
      fontSize: 11,
      marginTop: 4,
      fontWeight: "700",
      letterSpacing: 0.6,
    },
  });
}

const lightMemberStyles = createMemberStyles(getFitColors(false));
const darkMemberStyles = createMemberStyles(getFitColors(true));

export default function TeamMemberHistory() {
  const { idx, team_id } = useLocalSearchParams<{
    idx: string;
    team_id: string;
  }>();
  const id = idx;
  const router = useRouter();

  const { user: currentUser } = useAuth();

  // Theme
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const c = getFitColors(isDark);
  const styles = getFitStyles(isDark);
  const ms = isDark ? darkMemberStyles : lightMemberStyles;

  const [userInfo, setUserInfo] = useState<MemberInfo | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [target, setTarget] = useState(5000);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasNetError, setHasNetError] = useState(false);

  // Status stores only the state; the color is resolved at render time so it
  // follows the theme.
  const [status, setStatus] = useState<{
    state: "online" | "offline" | "never" | "signed_out";
    label: string;
  } | null>(null);

  const statusColor = (state?: string) =>
    state === "online"
      ? c.success
      : state === "signed_out"
        ? c.danger
        : c.neutral;

  useEffect(() => {
    fetchMemberHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const goBackToTeam = () => {
      if (team_id) {
        router.replace({
          pathname: "/teams",
          params: { team_id: String(team_id) },
        });
        return true;
      }
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      router.replace("/teams");
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", goBackToTeam);
    return () => sub.remove();
  }, [router, team_id]);

  const fetchMemberHistory = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(
        `${API_BASE}/teams/member/${id}/history?team_id=${team_id}`,
        {
          credentials: "include",
          signal: controller.signal,
        },
      );

      if (res.status === 401) {
        clearTimeout(timeoutId);
        router.replace("/login?sessionExpired=true");
        return;
      }
      if (res.status === 403) {
        clearTimeout(timeoutId);
        if (team_id) {
          router.replace({
            pathname: "/teams",
            params: { team_id: String(team_id) },
          });
        } else {
          router.replace("/teams");
        }
        return;
      }
      if (!res.ok) throw new Error("Member history endpoint error");

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
    } catch {
      clearTimeout(timeoutId);
      setHasNetError(true);
    } finally {
      setLoading(false);
    }
  };

  const renderUserHeader = () => {
    if (!userInfo) return null;
    const initial = userInfo.name?.trim().charAt(0).toUpperCase() || "?";
    const signedInLabel = userInfo.is_signed_in ? "Signed In" : "Signed Out";
    const signedInColor = userInfo.is_signed_in ? c.success : c.danger;

    const isAdmin = isTeamAdmin(userInfo);
    const isYou = Number(currentUser?.id) === Number(userInfo.id);
    const sColor = statusColor(status?.state);

    return (
      <View style={ms.userHeaderCard}>
        <View style={ms.userAvatar}>
          <Text style={ms.userAvatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={ms.nameRow}>
            <Text style={ms.userName}>{userInfo.name}</Text>

            {isAdmin && (
              <View style={ms.adminLabel}>
                <MaterialCommunityIcons
                  name="crown"
                  size={13}
                  color={c.adminIcon}
                />
                <Text style={ms.adminLabelText}>Admin</Text>
              </View>
            )}

            {isYou && (
              <View style={ms.youLabel}>
                <Text style={ms.youLabelText}>You</Text>
              </View>
            )}
          </View>

          <Text style={ms.userEmail} numberOfLines={1}>
            {userInfo.email}
          </Text>
          <Text style={ms.userId}>User ID #{userInfo.id}</Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginTop: 8,
              gap: 6,
            }}
          >
            {status && (
              <View style={ms.metaPill}>
                <View style={[ms.metaDot, { backgroundColor: sColor }]} />
                <Text style={[ms.metaPillText, { color: sColor }]}>
                  {status.label}
                </Text>
              </View>
            )}
            <View style={ms.metaPill}>
              <View style={[ms.metaDot, { backgroundColor: signedInColor }]} />
              <Text style={[ms.metaPillText, { color: signedInColor }]}>
                {signedInLabel}
              </Text>
            </View>
            <View style={ms.metaPill}>
              <Ionicons name="flag-outline" size={11} color={c.accentText} />
              <Text style={[ms.metaPillText, { color: c.accentText }]}>
                Target {(userInfo.target_steps ?? 5000).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
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
              Member Fitness Journey
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
        This member has no synced step history.
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
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <LinearGradient colors={c.gradient} style={styles.container}>
      <Text style={styles.headerTitle}>👥 Member History</Text>

      {hasNetError ? (
        <View style={styles.errorWrap}>
          <MaterialCommunityIcons
            name="wifi-strength-alert-outline"
            size={70}
            color={c.orange}
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.errorTitle}>Could Not Load History</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoading(true);
              fetchMemberHistory();
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
