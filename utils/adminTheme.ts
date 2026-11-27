// utils/adminTheme.ts
// Shared light/dark colors + styles for the admin screens
// (app/admin.tsx and app/admin/team/[id].tsx).
import { StyleSheet } from "react-native";

export function getAdminColors(isDark: boolean) {
  return {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    surface: isDark ? "#1E293B" : "#FFFFFF",
    surfaceAlt: isDark ? "#0F172A" : "#F8FAFC",
    border: isDark ? "#334155" : "#E2E8F0",
    text: isDark ? "#F8FAFC" : "#0F172A",
    textSoft: isDark ? "#CBD5E1" : "#475569",
    muted: isDark ? "#94A3B8" : "#64748B",
    faint: isDark ? "#64748B" : "#94A3B8",
    emptyIcon: isDark ? "#334155" : "#CBD5E1",

    primary: "#4F46E5", // fills (active pills etc.)
    primaryIcon: isDark ? "#818CF8" : "#4F46E5", // icons/text on surfaces
    purple: isDark ? "#A78BFA" : "#7C3AED",
    purpleBtn: "#7C3AED",

    info: isDark ? "#38BDF8" : "#0284C7",
    infoBg: isDark ? "#0C4A6E" : "#E0F2FE",
    infoDisabled: isDark ? "#0369A1" : "#7DD3FC",

    danger: isDark ? "#F87171" : "#DC2626",
    dangerSolid: "#DC2626",
    dangerBg: isDark ? "#450A0A" : "#FEE2E2",
    dangerDisabled: isDark ? "#450A0A" : "#FCA5A5",

    success: isDark ? "#4ADE80" : "#16A34A",
    neutral: "#94A3B8",
    slate: isDark ? "#CBD5E1" : "#475569",

    chipBg: isDark ? "#0F172A" : "#F1F5F9",
    chipBorder: isDark ? "#334155" : "#E2E8F0",

    tabTrack: isDark ? "#1E293B" : "#E2E8F0",
    tabActive: isDark ? "#334155" : "#FFFFFF",
    pillBg: isDark ? "#1E293B" : "#E2E8F0",
    pillText: isDark ? "#94A3B8" : "#475569",
    addPillBg: isDark ? "#1E293B" : "#EEF2FF",
    addPillBorder: isDark ? "#334155" : "#C7D2FE",

    adminBg: isDark ? "#422006" : "#FEF3C7",
    adminText: isDark ? "#FCD34D" : "#92400E",
    adminIcon: isDark ? "#FCD34D" : "#D97706",
    youBg: isDark ? "#064E3B" : "#DCFCE7",
    youText: isDark ? "#6EE7B7" : "#15803D",

    selectActiveBg: isDark ? "#0C4A6E" : "#E0F2FE",
    disabledBtn: isDark ? "#334155" : "#D1D5DB",
    cancelBg: isDark ? "#334155" : "#F1F5F9",
    cancelText: isDark ? "#E2E8F0" : "#64748B",
    overlay: isDark ? "rgba(0, 0, 0, 0.7)" : "rgba(15, 23, 42, 0.6)",
    headerBar: "#1E293B",
  };
}

export type AdminColors = ReturnType<typeof getAdminColors>;

export function statusColorFor(c: AdminColors, state?: string): string {
  switch (state) {
    case "online":
      return c.success;
    case "signed_out":
      return c.danger;
    default:
      return c.neutral;
  }
}

function build(isDark: boolean) {
  const c = getAdminColors(isDark);
  return StyleSheet.create({
    // Status pills
    pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.chipBg,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.chipBorder,
      gap: 5,
      maxWidth: "100%",
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },

    // Labels
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

    // Action buttons
    trashBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: c.dangerBg,
      alignItems: "center",
      justifyContent: "center",
    },
    infoBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: c.infoBg,
      alignItems: "center",
      justifyContent: "center",
    },

    // Row pieces
    rowBody: { flex: 1, flexDirection: "row", alignItems: "center" },
    avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },

    // Modals
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 24,
      elevation: 10,
    },
    modalHeader: { alignItems: "center", marginBottom: 16 },
    modalTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: c.text,
      marginTop: 8,
    },
    modalBody: {
      fontSize: 15,
      color: c.textSoft,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 4,
    },
    modalBodyStrong: { fontWeight: "700", color: c.text },
    modalSubBody: {
      fontSize: 13,
      color: c.muted,
      textAlign: "center",
      marginBottom: 20,
    },
    modalInstruction: {
      fontSize: 14,
      color: c.textSoft,
      textAlign: "center",
      marginBottom: 12,
    },
    deleteInput: {
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 15,
      fontSize: 18,
      textAlign: "center",
      fontWeight: "700",
      letterSpacing: 2,
      color: c.text,
      marginBottom: 24,
    },
    modalActions: { flexDirection: "row", gap: 12 },
    modalBtnCancel: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.cancelBg,
      alignItems: "center",
    },
    modalBtnCancelText: {
      color: c.cancelText,
      fontWeight: "700",
      fontSize: 15,
    },
    modalBtnDelete: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.dangerSolid,
      alignItems: "center",
    },
    modalBtnDeleteText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
    modalBtnSave: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      backgroundColor: "#0284C7",
      alignItems: "center",
    },
    modalBtnSaveText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  });
}

const lightStyles = build(false);
const darkStyles = build(true);

export const getAdminStyles = (isDark: boolean) =>
  isDark ? darkStyles : lightStyles;
