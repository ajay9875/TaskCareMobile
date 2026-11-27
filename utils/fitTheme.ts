// utils/fitTheme.ts
// Shared light/dark colors + styles for History and Team Member History screens.
import { StyleSheet } from "react-native";

export function getFitColors(isDark: boolean) {
  return {
    gradient: (isDark ? ["#1a1a2e", "#16213e"] : ["#F8FAFC", "#E8EEF6"]) as [
      string,
      string,
    ],
    bg: isDark ? "#0f0f0f" : "#F8FAFC",
    text: isDark ? "#ffffff" : "#0F172A",
    muted: isDark ? "#a4b0be" : "#64748B",
    accent: "#4ecca3", // fills, rings, buttons
    accentText: isDark ? "#4ecca3" : "#0F766E", // text/icons on surfaces
    orange: isDark ? "#ff6b35" : "#EA580C",
    surface: isDark ? "#ffffff09" : "#FFFFFF",
    surfaceStrong: isDark ? "#1a1a1a" : "#FFFFFF",
    inset: isDark ? "#ffffff04" : "#F8FAFC",
    insetStrong: isDark ? "#00000040" : "#F1F5F9",
    border: isDark ? "#ffffff15" : "#E2E8F0",
    borderSoft: isDark ? "#ffffff08" : "#EEF2F6",
    summaryBorder: isDark ? "#4ecca340" : "#99F6E4",
    summaryDivider: isDark ? "#4ecca320" : "#CCFBF1",
    iconBox: isDark ? "#4ecca315" : "#CCFBF1",
    ringTrack: isDark ? "#ffffff15" : "#E2E8F0",
    chipBg: isDark ? "#ffffff10" : "#F1F5F9",
    chipBorder: isDark ? "#ffffff18" : "#E2E8F0",
    adminBg: isDark ? "#422006" : "#FEF3C7",
    adminText: isDark ? "#FCD34D" : "#92400E",
    adminIcon: isDark ? "#FCD34D" : "#D97706",
    youBg: isDark ? "#064E3B" : "#DCFCE7",
    youText: isDark ? "#6EE7B7" : "#15803D",
    success: isDark ? "#4ADE80" : "#16A34A",
    danger: isDark ? "#F87171" : "#DC2626",
    neutral: "#94A3B8",
  };
}

export type FitColors = ReturnType<typeof getFitColors>;

function build(isDark: boolean) {
  const c = getFitColors(isDark);
  return StyleSheet.create({
    container: { flex: 1, paddingTop: 25, backgroundColor: c.bg },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 16,
      color: c.text,
      letterSpacing: 0.5,
      textShadowColor: isDark ? "rgba(78, 204, 163, 0.3)" : "transparent",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 10,
    },
    listPadding: { paddingHorizontal: 16, paddingBottom: 30 },

    // Error state
    errorWrap: {
      flex: 0.8,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 30,
    },
    errorTitle: {
      color: c.text,
      fontSize: 20,
      fontWeight: "800",
      marginBottom: 8,
      textAlign: "center",
    },
    errorText: {
      color: c.muted,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 24,
    },
    retryBtn: {
      borderColor: c.accentText,
      borderWidth: 1.5,
      paddingVertical: 12,
      paddingHorizontal: 28,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    retryText: { color: c.accentText, fontWeight: "700", fontSize: 14 },

    // Summary block
    summaryCard: {
      backgroundColor: c.surfaceStrong,
      borderRadius: 20,
      padding: 18,
      marginBottom: 24,
      borderWidth: 1.5,
      borderColor: c.summaryBorder,
      elevation: isDark ? 5 : 2,
      shadowColor: isDark ? "#4ecca3" : "#0F172A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.1 : 0.06,
      shadowRadius: 10,
    },
    summaryTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.summaryDivider,
    },
    summaryIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.iconBox,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    summaryTitleTextContainer: { flex: 1 },
    summaryTitleText: {
      color: c.accentText,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 1,
    },
    summaryTitleSubtext: {
      color: c.muted,
      fontSize: 11,
      marginTop: 2,
      fontWeight: "500",
    },
    summaryTotalStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: c.insetStrong,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    stripMetric: { alignItems: "center", flex: 1, gap: 2 },
    stripMetricDivider: {
      width: 1,
      height: "70%",
      backgroundColor: c.border,
    },
    stripLabel: {
      color: c.muted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.8,
      marginTop: 4,
    },
    stripVal: {
      color: c.text,
      fontSize: 16,
      fontWeight: "800",
      marginTop: 4,
    },

    // Day block
    card: {
      backgroundColor: c.surface,
      padding: 18,
      borderRadius: 22,
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    dateText: {
      fontSize: 17,
      color: c.text,
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
    modeColumnDivided: {
      borderLeftWidth: 1,
      borderColor: c.border,
      paddingLeft: 15,
      flex: 0.9,
    },
    columnHeadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 12,
    },
    columnHeading: {
      color: c.accentText,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.8,
    },
    modeStatBlock: {
      backgroundColor: c.inset,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.borderSoft,
    },
    modeStatVal: {
      color: c.text,
      fontSize: 18,
      fontWeight: "bold",
      marginTop: 4,
    },
    modeStatLabel: {
      color: c.muted,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    unitText: { fontSize: 11, color: c.muted, fontWeight: "500" },

    combinedDivider: {
      height: 1.5,
      backgroundColor: c.border,
      marginVertical: 16,
    },
    combinedHeading: {
      color: c.accentText,
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
      color: c.text,
      lineHeight: 24,
    },
    stepMetricLabel: {
      color: c.muted,
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
      color: c.text,
      fontSize: 14,
      fontWeight: "600",
      letterSpacing: 0,
    },

    // Empty state
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
      color: c.text,
      marginBottom: 10,
    },
    emptySubtitle: {
      fontSize: 15,
      color: c.muted,
      textAlign: "center",
      lineHeight: 22,
    },
  });
}

const lightFitStyles = build(false);
const darkFitStyles = build(true);

export const getFitStyles = (isDark: boolean) =>
  isDark ? darkFitStyles : lightFitStyles;
