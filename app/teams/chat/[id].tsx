// app/teams/chat/[id].tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../context/ThemeContext";
import { setActiveChatTeam } from "../../../utils/chatPresence";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
const POLL_MS = 3000;
const TYPING_THROTTLE_MS = 2500;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 60_000;

/* ------------------------------------------------------------------ */
/* Theme palettes                                                      */
/* ------------------------------------------------------------------ */
const PALETTES = {
  light: {
    bg: "#F1F5F9",
    surface: "#FFFFFF",
    surfaceAlt: "#F1F5F9",
    border: "#E2E8F0",
    text: "#0F172A",
    textMuted: "#64748B",
    textFaint: "#94A3B8",
    bubbleThem: "#FFFFFF",
    bubbleThemBorder: "#E2E8F0",
    bubbleThemText: "#0F172A",
    sender: "#0F766E",
    mention: "#0F766E",
    quoteThemBg: "rgba(15,23,42,0.05)",
    quoteThemText: "#475569",
    fileChipThemBg: "rgba(15,23,42,0.05)",
    typingBubble: "#E2E8F0",
    placeholder: "#94A3B8",
    sendDisabled: "#CBD5E1",
    overlay: "rgba(15,23,42,0.45)",
    emptyIcon: "#CBD5E1",
    error: "#DC2626",
    sheetText: "#0F172A",
  },
  dark: {
    bg: "#0F172A",
    surface: "#1E293B",
    surfaceAlt: "#0F172A",
    border: "#334155",
    text: "#F8FAFC",
    textMuted: "#94A3B8",
    textFaint: "#64748B",
    bubbleThem: "#1E293B",
    bubbleThemBorder: "#1E293B",
    bubbleThemText: "#F8FAFC",
    sender: "#4ecca3",
    mention: "#4ecca3",
    quoteThemBg: "rgba(255,255,255,0.06)",
    quoteThemText: "#CBD5E1",
    fileChipThemBg: "rgba(255,255,255,0.06)",
    typingBubble: "#1E293B",
    placeholder: "#64748B",
    sendDisabled: "#334155",
    overlay: "rgba(0,0,0,0.55)",
    emptyIcon: "#334155",
    error: "#FCA5A5",
    sheetText: "#E2E8F0",
  },
} as const;

type Palette = { [K in keyof typeof PALETTES.light]: string };

const ACCENT = "#4ecca3";
const ON_ACCENT = "#0f0f0f";
const ON_ACCENT_MUTED = "#065f46";

type Attachment = {
  file: string;
  name: string;
  mime?: string | null;
  size: number;
  is_image: boolean;
};
type ReplyRef = {
  id: number;
  user_id: number;
  name: string;
  body: string;
  deleted?: boolean;
};
type MemberLite = { user_id: number; name: string };

type Message = {
  id: number;
  user_id: number;
  name: string;
  body: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  attachment?: Attachment | null;
  reply_to?: ReplyRef | null;
  mentions?: MemberLite[];
};

type TeamInfo = { id: number; name: string };
type PendingFile = {
  uri: string;
  name: string;
  mime: string;
  size?: number;
  isImage: boolean;
};
type RenderItem = {
  kind: "day" | "msg";
  key: string;
  dayLabel?: string;
  msg?: Message;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  showName?: boolean;
};

function formatTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function dayKey(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const fileUrl = (file: string) => `${API_BASE}/chat-files/${file}`;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

function withExt(name: string, mime: string) {
  if (/\.[a-z0-9]{1,5}$/i.test(name)) return name;
  const ext = MIME_EXT[mime.toLowerCase()];
  return ext ? `${name}.${ext}` : name;
}

function normalizeMime(mime: string) {
  return mime.toLowerCase() === "image/jpg" ? "image/jpeg" : mime;
}

function fileIconFor(name: string): ComponentProps<typeof Ionicons>["name"] {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["xls", "xlsx", "csv"].includes(ext)) return "grid-outline";
  if (["ppt", "pptx"].includes(ext)) return "easel-outline";
  if (["zip"].includes(ext)) return "archive-outline";
  if (["mp3", "m4a"].includes(ext)) return "musical-notes-outline";
  if (["mp4"].includes(ext)) return "videocam-outline";
  if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext))
    return "document-text-outline";
  return "document-outline";
}

const sameUsers = (a: MemberLite[], b: MemberLite[]) =>
  a.length === b.length && a.every((u, i) => u.user_id === b[i].user_id);

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
];
function avatarColor(userId: number) {
  return AVATAR_COLORS[Math.abs(Number(userId) || 0) % AVATAR_COLORS.length];
}

/* ------------------------------------------------------------------ */
/* Styles (built once per theme)                                       */
/* ------------------------------------------------------------------ */
function createStyles(c: Palette, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 20,
      paddingBottom: 16,
      paddingHorizontal: 14,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    downloadOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 999,
    },
    downloadBox: {
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingVertical: 24,
      paddingHorizontal: 32,
      alignItems: "center",
      gap: 12,
    },
    downloadText: { color: c.sheetText, fontSize: 15, fontWeight: "600" },
    backBtn: { padding: 4, marginRight: 4 },
    headerAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: ACCENT,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 17, fontWeight: "800", color: c.text },
    headerSubRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 2,
      gap: 5,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#22c55e",
    },
    headerSub: { fontSize: 11, color: c.textMuted },

    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    emptyText: {
      color: c.text,
      fontSize: 16,
      fontWeight: "700",
      marginTop: 12,
    },
    emptySub: { color: c.textMuted, fontSize: 13, marginTop: 4 },
    errorText: {
      color: c.error,
      fontSize: 14,
      marginTop: 12,
      textAlign: "center",
    },

    dayRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 16,
      gap: 10,
    },
    dayLine: { flex: 1, height: 1, backgroundColor: c.border },
    dayLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: c.textFaint,
      letterSpacing: 0.5,
      paddingHorizontal: 6,
    },

    msgRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 3 },
    msgRowMe: { justifyContent: "flex-end" },
    msgRowThem: { justifyContent: "flex-start" },
    avatarMini: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    avatarMiniText: { color: "#fff", fontSize: 12, fontWeight: "800" },
    avatarSpacer: { width: 36 },
    senderName: {
      fontSize: 12,
      color: c.sender,
      fontWeight: "700",
      marginTop: 5,
      marginBottom: 4,
      marginLeft: 4,
    },

    typingRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      marginBottom: 8,
    },
    typingAvatarsWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: 8,
    },
    typingAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: c.bg,
    },
    typingAvatarText: { color: "#fff", fontSize: 11, fontWeight: "800" },
    typingBubble: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.typingBubble,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 16,
      borderTopLeftRadius: 6,
      gap: 5,
    },
    typingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: ACCENT,
    },

    bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16 },
    bubbleMe: { backgroundColor: ACCENT },
    bubbleThem: {
      backgroundColor: c.bubbleThem,
      borderWidth: isDark ? 0 : 1,
      borderColor: c.bubbleThemBorder,
    },
    bubbleMeFirst: { borderTopRightRadius: 6 },
    bubbleMeLast: { borderBottomRightRadius: 6 },
    bubbleThemFirst: { borderTopLeftRadius: 6 },
    bubbleThemLast: { borderBottomLeftRadius: 6 },
    bubbleText: { color: c.bubbleThemText, fontSize: 15, lineHeight: 20 },
    bubbleTextMe: { color: ON_ACCENT },
    bubbleTime: {
      fontSize: 10,
      color: c.textFaint,
      marginTop: 4,
      alignSelf: "flex-end",
    },
    bubbleTimeMe: { color: ON_ACCENT_MUTED },
    deletedText: { color: c.textMuted, fontSize: 14, fontStyle: "italic" },
    deletedTextMe: { color: ON_ACCENT_MUTED },

    attachImage: {
      width: 220,
      height: 180,
      borderRadius: 12,
      marginBottom: 6,
      backgroundColor: c.surfaceAlt,
      overflow: "hidden",
    },
    attachOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.overlay,
      gap: 6,
    },
    attachOverlayText: { color: c.textFaint, fontSize: 12 },
    fileChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.fileChipThemBg,
      borderRadius: 10,
      padding: 10,
      marginBottom: 6,
      minWidth: 180,
    },
    fileChipMe: { backgroundColor: "rgba(0,0,0,0.1)" },
    fileName: { color: c.bubbleThemText, fontSize: 13, fontWeight: "700" },
    fileMeta: { color: c.textMuted, fontSize: 11, marginTop: 1 },

    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 24,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: 8,
    },
    attachBtn: {
      width: 40,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    inputWrap: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderWidth: isDark ? 0 : 1,
      borderColor: c.border,
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    input: { maxHeight: 120, color: c.text, fontSize: 15, paddingVertical: 8 },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: ACCENT,
      alignItems: "center",
      justifyContent: "center",
    },

    mention: { color: c.mention, fontWeight: "700" },
    mentionMe: { color: ON_ACCENT_MUTED, fontWeight: "800" },

    quote: {
      borderLeftWidth: 3,
      borderRadius: 6,
      paddingVertical: 4,
      paddingHorizontal: 8,
      marginBottom: 6,
    },
    quoteThem: {
      backgroundColor: c.quoteThemBg,
      borderLeftColor: ACCENT,
    },
    quoteMe: {
      backgroundColor: "rgba(0,0,0,0.12)",
      borderLeftColor: ON_ACCENT_MUTED,
    },
    quoteName: { fontSize: 11, fontWeight: "800", color: c.sender },
    quoteNameMe: { color: ON_ACCENT_MUTED },
    quoteBody: { fontSize: 12, color: c.quoteThemText, marginTop: 1 },
    quoteBodyMe: { color: "#134e4a" },

    replyBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
      borderLeftWidth: 3,
      borderLeftColor: ACCENT,
    },
    replyBarName: { color: c.sender, fontSize: 12, fontWeight: "800" },
    replyBarBody: { color: c.textMuted, fontSize: 12, marginTop: 1 },

    pendingBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    pendingThumb: { width: 44, height: 44, borderRadius: 8 },
    pendingIcon: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: c.surfaceAlt,
      borderWidth: isDark ? 0 : 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    pendingName: { color: c.text, fontSize: 13, fontWeight: "700" },
    pendingMeta: { color: c.textMuted, fontSize: 11, marginTop: 1 },

    mentionPicker: {
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    mentionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    mentionRowText: { color: c.text, fontSize: 14, fontWeight: "600" },

    jumpBtn: {
      position: "absolute",
      right: 16,
      bottom: 12,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: ACCENT,
      alignItems: "center",
      justifyContent: "center",
      elevation: 4,
    },
    jumpBadge: {
      position: "absolute",
      top: -6,
      right: -4,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "#EF4444",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    jumpBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },

    sheetBackdrop: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingVertical: 8,
      paddingBottom: 24,
    },
    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 22,
      paddingVertical: 15,
    },
    sheetRowText: { color: c.sheetText, fontSize: 16, fontWeight: "600" },

    viewerBg: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.95)",
      justifyContent: "center",
      alignItems: "center",
    },
    viewerImg: { width: "100%", height: "80%" },
    viewerClose: { position: "absolute", top: 48, right: 20, padding: 8 },
  });
}

type Styles = ReturnType<typeof createStyles>;

const lightStyles = createStyles(PALETTES.light as Palette, false);
const darkStyles = createStyles(PALETTES.dark as Palette, true);

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */
function LiveDot({ styles }: { styles: Styles }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.liveDot, { opacity }]} />;
}

function TypingIndicator({
  typingUsers,
  styles,
}: {
  typingUsers: MemberLite[];
  styles: Styles;
}) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (typingUsers.length === 0) return;

    const bounce = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: -4,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.delay(Math.max(0, 450 - delay)),
        ]),
      );

    const a1 = bounce(dot1, 0);
    const a2 = bounce(dot2, 140);
    const a3 = bounce(dot3, 280);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [typingUsers.length, dot1, dot2, dot3]);

  if (typingUsers.length === 0) return null;

  return (
    <View style={styles.typingRow}>
      <View style={styles.typingAvatarsWrap}>
        {typingUsers.slice(0, 4).map((u, idx) => (
          <View
            key={u.user_id}
            style={[
              styles.typingAvatar,
              {
                backgroundColor: avatarColor(u.user_id),
                marginLeft: idx === 0 ? 0 : -10,
                zIndex: 10 - idx,
              },
            ]}
          >
            <Text style={styles.typingAvatarText}>
              {u.name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.typingBubble}>
        <Animated.View
          style={[styles.typingDot, { transform: [{ translateY: dot1 }] }]}
        />
        <Animated.View
          style={[styles.typingDot, { transform: [{ translateY: dot2 }] }]}
        />
        <Animated.View
          style={[styles.typingDot, { transform: [{ translateY: dot3 }] }]}
        />
      </View>
    </View>
  );
}

function AttachmentImage({
  uri,
  onPress,
  onLongPress,
  styles,
  mutedColor,
}: {
  uri: string;
  onPress: () => void;
  onLongPress: () => void;
  styles: Styles;
  mutedColor: string;
}) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setStatus("loading");
    setSrc(null);

    (async () => {
      try {
        const res = await fetch(`${uri}?json=1`, { credentials: "include" });
        if (!res.ok) throw new Error(`JSON status ${res.status}`);
        const data = await res.json();

        if (!data.url) throw new Error("No URL in response");

        if (isMounted) {
          setSrc(data.url);
        }
      } catch (e: any) {
        if (isMounted) setStatus("error");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [uri, attempt]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={status === "error" ? () => setAttempt((a) => a + 1) : onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.attachImage}>
        {src && (
          <Image
            key={attempt}
            source={{ uri: src }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onLoad={() => setStatus("ok")}
            onError={() => setStatus("error")}
          />
        )}

        {status === "loading" && (
          <View style={styles.attachOverlay}>
            <ActivityIndicator color={ACCENT} />
          </View>
        )}

        {status === "error" && (
          <View style={styles.attachOverlay}>
            <Ionicons name="refresh" size={24} color={mutedColor} />
            <Text style={styles.attachOverlayText}>Tap to retry</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function SheetRow({
  icon,
  label,
  onPress,
  danger,
  styles,
  iconColor,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  danger?: boolean;
  styles: Styles;
  iconColor: string;
}) {
  return (
    <TouchableOpacity style={styles.sheetRow} onPress={onPress}>
      <Ionicons name={icon} size={22} color={danger ? "#EF4444" : iconColor} />
      <Text style={[styles.sheetRowText, danger && { color: "#EF4444" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderBody(
  body: string,
  mentions: MemberLite[] | undefined,
  isMe: boolean,
  styles: Styles,
) {
  if (!mentions?.length) return body;
  const names = [...mentions]
    .map((m) => m.name)
    .sort((a, b) => b.length - a.length);
  const re = new RegExp(`(@(?:${names.map(escapeRegex).join("|")}))`, "g");
  return body.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <Text key={i} style={isMe ? styles.mentionMe : styles.mention}>
        {part}
      </Text>
    ) : (
      part
    ),
  );
}

function describeError(e: any): { title: string; body: string } {
  const name = e?.name || "Error";
  const message =
    (typeof e === "string" ? e : e?.message) || String(e ?? "Unknown error");
  const title = `Upload failed (${name})`;
  const body = message;
  return { title, body };
}

async function describeResponse(res: Response): Promise<string> {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      const j = await res.json();
      return j.error || j.message || `HTTP ${res.status}`;
    }
    const text = await res.text();
    const stripped = text
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return `HTTP ${res.status}: ${stripped.slice(0, 200) || res.statusText}`;
  } catch {
    return `HTTP ${res.status} ${res.statusText || ""}`.trim();
  }
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */
export default function TeamChatScreen() {
  const params = useLocalSearchParams<{
    idx?: string | string[];
    id?: string | string[];
    name?: string | string[];
  }>();
  const raw = params.idx ?? params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;

  const teamId = Number(id);
  const validTeamId = Number.isSafeInteger(teamId) && teamId > 0;

  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const { user } = useAuth();
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  // Theme
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const styles = isDark ? darkStyles : lightStyles;
  const colors = (isDark ? PALETTES.dark : PALETTES.light) as Palette;

  const [messages, setMessages] = useState<Message[]>([]);
  const [team, setTeam] = useState<TeamInfo | null>(
    name ? { id: teamId, name } : null,
  );
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberLite[]>([]);
  const [typingUsers, setTypingUsers] = useState<MemberLite[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pickedMentions, setPickedMentions] = useState<MemberLite[]>([]);

  const [pending, setPending] = useState<PendingFile | null>(null);
  const [picking, setPicking] = useState<"image" | "file" | null>(null);
  const [actionMsg, setActionMsg] = useState<Message | null>(null);
  const [attachSheet, setAttachSheet] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const [showJump, setShowJump] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const lastIdRef = useRef(0);
  const oldestIdRef = useRef(0);
  const syncRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const initialOkRef = useRef(false);
  const nearBottomRef = useRef(true);
  const lastTypingPingRef = useRef(0);
  const listRef = useRef<FlatList<RenderItem>>(null);
  const inputRef = useRef<TextInput>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [downloading, setDownloading] = useState(false);

  const downloadAttachment = async (att: Attachment) => {
    if (downloading) return;
    setActionMsg(null);
    setDownloading(true);

    let localUri: string | null = null;
    try {
      const res = await fetch(
        `${fileUrl(att.file)}?json=1&dl=1&name=${encodeURIComponent(att.name)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { url: signed } = await res.json();
      if (!signed) throw new Error("No download URL");

      const safeName = att.name.replace(/[^\w.\-]/g, "_");
      const dl = await FileSystem.downloadAsync(
        signed,
        FileSystem.cacheDirectory + safeName,
      );
      if (dl.status !== 200) throw new Error(`Download failed (${dl.status})`);
      localUri = dl.uri;
    } catch (e: any) {
      setDownloading(false);
      Alert.alert("Couldn't download", e?.message || "Please try again.");
      return;
    }

    setDownloading(false);

    try {
      // Images go straight to the gallery
      if (att.is_image) {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          await MediaLibrary.Asset.create(localUri);
          Alert.alert("Success", "Image saved to your gallery.");
          return;
        } else {
          Alert.alert(
            "Permission needed",
            "Please allow gallery access to save images.",
          );
        }
      }

      // Documents use the share sheet so the user can choose where to save
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: att.mime || undefined,
          dialogTitle: att.name,
        });
      }
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message || "Please try again.");
    }
  };

  const scrollToBottom = (animated = true) =>
    listRef.current?.scrollToOffset({ offset: 0, animated });

  useEffect(() => {
    oldestIdRef.current = messages.length ? messages[0].id : 0;
  }, [messages]);

  const goBackToTeam = useCallback(() => {
    if (validTeamId) {
      router.replace({
        pathname: "/teams",
        params: { team_id: String(teamId) },
      });
      return true;
    }
    if (router.canGoBack()) {
      router.back();
      return true;
    }
    router.replace("/teams");
    return true;
  }, [router, teamId, validTeamId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", goBackToTeam);
    return () => sub.remove();
  }, [goBackToTeam]);

  useEffect(() => {
    if (!validTeamId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/teams/my-teams`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== "success") return;
        const found = (data.teams || []).find(
          (t: any) => Number(t.id) === teamId,
        );
        if (!found) return;
        setMembers(
          (found.members || []).map((m: any) => ({
            user_id: m.user_id,
            name: m.name,
          })),
        );
        setTeam((prev) =>
          prev?.name ? prev : { id: found.id, name: found.name },
        );
      } catch {
        /* non-blocking */
      }
    })();
  }, [teamId, validTeamId]);

  const sendTypingStatus = useCallback(
    async (isTyping: boolean) => {
      if (!validTeamId) return;
      const now = Date.now();
      if (isTyping && now - lastTypingPingRef.current < TYPING_THROTTLE_MS) {
        return;
      }
      lastTypingPingRef.current = isTyping ? now : 0;
      try {
        await fetch(`${API_BASE}/teams/${teamId}/typing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ is_typing: isTyping }),
        });
      } catch {
        /* non-blocking */
      }
    },
    [teamId, validTeamId],
  );

  const leavePresence = useCallback(() => {
    if (!validTeamId) return;
    fetch(`${API_BASE}/teams/${teamId}/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active: false }),
    }).catch(() => {});
  }, [teamId, validTeamId]);

  const fetchMessages = useCallback(
    async (initial = false) => {
      try {
        if (!validTeamId) {
          setError("Invalid team ID. Please go back and select a team.");
          setLoading(false);
          return;
        }
        let url = `${API_BASE}/teams/${teamId}/messages`;
        if (!initial) {
          url += `?since=${lastIdRef.current}`;
          if (syncRef.current)
            url += `&sync=${encodeURIComponent(syncRef.current)}`;
        }

        const res = await fetch(url, { credentials: "include" });

        if (res.status === 401) {
          routerRef.current.replace("/login?sessionExpired=true");
          return;
        }
        if (res.status === 403) {
          setError("You are not a member of this team.");
          return;
        }
        if (!res.ok) throw new Error("fetch failed");

        const data = await res.json();
        if (data.server_utc) syncRef.current = data.server_utc;

        const activeTypers: MemberLite[] = (data.typing_users || []).filter(
          (u: MemberLite) => Number(u.user_id) !== Number(userIdRef.current),
        );
        setTypingUsers((prev) =>
          sameUsers(prev, activeTypers) ? prev : activeTypers,
        );
        setOnlineCount(Number(data.online_count ?? 0));

        const newMsgs: Message[] = data.messages || [];
        const changed: Message[] = data.changed || [];

        if (initial) {
          hasMoreRef.current = !!data.has_more;
          lastIdRef.current = newMsgs.length
            ? newMsgs[newMsgs.length - 1].id
            : 0;
          setMessages(newMsgs);
          initialOkRef.current = true;
        } else if (newMsgs.length || changed.length) {
          if (newMsgs.length) {
            lastIdRef.current = Math.max(
              lastIdRef.current,
              newMsgs[newMsgs.length - 1].id,
            );
          }
          setMessages((prev) => {
            let next = prev;
            if (changed.length) {
              const map = new Map(changed.map((m) => [m.id, m]));
              next = next.map((m) => map.get(m.id) ?? m);
            }
            if (newMsgs.length) {
              const have = new Set(next.map((m) => m.id));
              const add = newMsgs.filter((m) => !have.has(m.id));
              if (add.length) next = [...next, ...add];
            }
            return next;
          });
          const incoming = newMsgs.filter(
            (m) => Number(m.user_id) !== Number(userIdRef.current),
          ).length;
          if (!nearBottomRef.current && incoming > 0) {
            setNewCount((c) => c + incoming);
          }
        }
        setError(null);
      } catch {
        if (initial) setError("Couldn't load messages. Pull back and retry.");
      } finally {
        if (initial) setLoading(false);
      }
    },
    [teamId, validTeamId],
  );

  const loadOlder = useCallback(async () => {
    if (
      loadingOlderRef.current ||
      !hasMoreRef.current ||
      !oldestIdRef.current ||
      !validTeamId
    )
      return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const res = await fetch(
        `${API_BASE}/teams/${teamId}/messages?before=${oldestIdRef.current}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("older failed");
      const data = await res.json();
      const older: Message[] = data.messages || [];
      hasMoreRef.current = !!data.has_more;
      if (older.length) {
        setMessages((prev) => {
          const have = new Set(prev.map((m) => m.id));
          const add = older.filter((m) => !have.has(m.id));
          return add.length ? [...add, ...prev] : prev;
        });
      }
    } catch {
      /* retry on next scroll */
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [teamId, validTeamId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    initialOkRef.current = false;
    lastIdRef.current = 0;
    syncRef.current = null;

    const tick = async () => {
      if (cancelled) return;
      if (AppState.currentState === "active") {
        await fetchMessages(!initialOkRef.current);
      }
      if (cancelled) return;
      pollTimerRef.current = setTimeout(tick, POLL_MS);
    };

    (async () => {
      await fetchMessages(true);
      if (cancelled) return;
      pollTimerRef.current = setTimeout(tick, POLL_MS);
    })();

    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      sendTypingStatus(false);
      leavePresence();
    };
  }, [fetchMessages, sendTypingStatus, leavePresence]);

  useEffect(() => {
    if (!validTeamId) return;
    setActiveChatTeam(teamId);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setActiveChatTeam(teamId);
        fetchMessages(!initialOkRef.current);
      } else {
        setActiveChatTeam(null);
        sendTypingStatus(false);
        leavePresence();
      }
    });
    return () => {
      sub.remove();
      setActiveChatTeam(null);
    };
  }, [teamId, validTeamId, fetchMessages, sendTypingStatus, leavePresence]);

  const patchMessage = (m: Message) =>
    setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));

  async function uploadForm(form: FormData): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      return await fetch(`${API_BASE}/teams/${teamId}/messages`, {
        method: "POST",
        credentials: "include",
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  const send = async () => {
    const text = input.trim();
    if ((!text && !pending && !editing) || sending) return;

    setSending(true);
    sendTypingStatus(false);

    try {
      const mentionIds = pickedMentions
        .filter((m) => text.includes(`@${m.name}`))
        .map((m) => m.user_id);

      if (editing) {
        if (!text && !editing.attachment) {
          Alert.alert(
            "Message is empty",
            "Write something or delete the message.",
          );
          return;
        }
        if (text === editing.body) {
          cancelEdit();
          return;
        }
        const res = await fetch(
          `${API_BASE}/teams/${teamId}/messages/${editing.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ body: text, mentions: mentionIds }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.message) {
          patchMessage(data.message as Message);
          cancelEdit();
        } else {
          Alert.alert("Couldn't edit", data.error || "Please try again.");
        }
        return;
      }

      let res: Response;

      if (pending) {
        const form = new FormData();
        form.append("body", text);
        if (replyTo) form.append("reply_to_id", String(replyTo.id));
        form.append("mentions", JSON.stringify(mentionIds));

        form.append("file", new ExpoFile(pending.uri) as any);

        try {
          res = await uploadForm(form);
        } catch (uploadErr: any) {
          if (uploadErr?.name === "AbortError") {
            Alert.alert(
              "Upload timed out",
              `The server did not respond within ${Math.round(
                UPLOAD_TIMEOUT_MS / 1000,
              )}s. The file might be too large, or your connection is slow.`,
            );
          } else {
            const { title, body } = describeError(uploadErr);
            Alert.alert(title, body);
          }
          return;
        }

        if (!res.ok) {
          const reason = await describeResponse(res);
          Alert.alert(`Upload failed (HTTP ${res.status})`, reason);
          return;
        }
      } else {
        res = await fetch(`${API_BASE}/teams/${teamId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            body: text,
            reply_to_id: replyTo?.id ?? null,
            mentions: mentionIds,
          }),
        });
      }

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.message) {
        setInput("");
        setReplyTo(null);
        setPending(null);
        setPickedMentions([]);
        setMentionQuery(null);
        const m = data.message as Message;
        if (m.id > lastIdRef.current) lastIdRef.current = m.id;
        nearBottomRef.current = true;
        setNewCount(0);
        setMessages((prev) =>
          prev.some((x) => x.id === m.id) ? prev : [...prev, m],
        );
        setTimeout(() => scrollToBottom(true), 60);
      } else {
        Alert.alert(
          "Couldn't send",
          data.error || data.message || `Failed to send (HTTP ${res.status})`,
        );
      }
    } catch (e: any) {
      const { title, body } = describeError(e);
      Alert.alert(title, body);
    } finally {
      setSending(false);
    }
  };

  const startEdit = (m: Message) => {
    setActionMsg(null);
    setReplyTo(null);
    setPending(null);
    setEditing(m);
    setInput(m.body);
    setPickedMentions(m.mentions ?? []);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  function cancelEdit() {
    setEditing(null);
    setInput("");
    setPickedMentions([]);
    setMentionQuery(null);
  }

  const deleteMessage = async (m: Message) => {
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}/messages/${m.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.message) {
        patchMessage(data.message as Message);
        if (replyTo?.id === m.id) setReplyTo(null);
        if (editing?.id === m.id) cancelEdit();
      } else {
        Alert.alert("Couldn't delete", data.error || "Please try again.");
      }
    } catch (e: any) {
      const { title, body } = describeError(e);
      Alert.alert(
        `Delete failed (${title.replace("Upload failed ", "")})`,
        body,
      );
    }
  };

  const confirmDelete = (m: Message) => {
    setActionMsg(null);
    Alert.alert("Delete message?", "This removes the message for everyone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMessage(m) },
    ]);
  };

  const openActions = (m: Message) => {
    if (m.deleted_at) return;
    setActionMsg(m);
  };

  const pickImage = async () => {
    setAttachSheet(false);
    setPicking("image");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;

      const a = result.assets[0];
      const cacheDir = FileSystem.cacheDirectory!;
      let uri = a.uri;

      if (!uri.startsWith("file://")) {
        const baseName = (a.fileName || `photo_${Date.now()}.jpg`).replace(
          /[^\w.\-]/g,
          "_",
        );
        const dest = cacheDir + baseName;
        await FileSystem.copyAsync({ from: a.uri, to: dest });
        uri = dest;
      }

      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        Alert.alert(
          "Picker error",
          "The photo could not be read. Please pick it again.",
        );
        return;
      }

      const size = (info as any).size ?? a.fileSize ?? 0;
      if (size > MAX_UPLOAD_BYTES) {
        Alert.alert("File too large", "Maximum size is 10 MB.");
        return;
      }

      const mime = normalizeMime(a.mimeType || "image/jpeg");
      setPending({
        uri,
        name: withExt(a.fileName || `photo_${Date.now()}`, mime),
        mime,
        size,
        isImage: true,
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Couldn't open your photos.");
    } finally {
      setPicking(null);
    }
  };

  const pickDocument = async () => {
    setAttachSheet(false);
    setPicking("file");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const a = result.assets[0];
      const cacheDir = FileSystem.cacheDirectory!;
      let uri = a.uri;

      if (!uri.startsWith("file://")) {
        const baseName = (a.name || `upload_${Date.now()}`).replace(
          /[^\w.\-]/g,
          "_",
        );
        const dest = cacheDir + baseName;
        await FileSystem.copyAsync({ from: a.uri, to: dest });
        uri = dest;
      }

      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        Alert.alert(
          "Picker error",
          "The file could not be read. Please pick it again.",
        );
        return;
      }

      const size = (info as any).size ?? a.size ?? 0;
      if (size > MAX_UPLOAD_BYTES) {
        Alert.alert("File too large", "Maximum size is 10 MB.");
        return;
      }

      const mime = normalizeMime(a.mimeType || "application/octet-stream");
      setPending({
        uri,
        name: withExt(a.name || `upload_${Date.now()}`, mime),
        mime,
        size,
        isImage: mime.startsWith("image/"),
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Couldn't open the file picker.");
    } finally {
      setPicking(null);
    }
  };

  const displayName = team?.name || "Team Chat";

  const rendered = useMemo(() => {
    const out: RenderItem[] = [];
    let lastDay = "";
    let lastSender: number | null = null;
    let lastWasMe: boolean | null = null;

    messages.forEach((m, i) => {
      const dk = dayKey(m.created_at);
      if (dk !== lastDay) {
        out.push({
          kind: "day",
          key: `day-${dk}`,
          dayLabel: formatDayLabel(m.created_at),
        });
        lastDay = dk;
        lastSender = null;
        lastWasMe = null;
      }

      const isMe = Number(m.user_id) === Number(user?.id);
      const showName = !isMe && lastSender !== m.user_id;

      const next = messages[i + 1];
      const sameSenderNext =
        next &&
        Number(next.user_id) === Number(m.user_id) &&
        dayKey(next.created_at) === dk;

      out.push({
        kind: "msg",
        key: `m-${m.id}`,
        msg: m,
        isFirstInGroup: lastSender !== m.user_id || lastWasMe !== isMe,
        isLastInGroup: !sameSenderNext,
        showName,
      });

      lastSender = m.user_id;
      lastWasMe = isMe;
    });

    return out.reverse();
  }, [messages, user?.id]);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter(
        (m) =>
          Number(m.user_id) !== Number(user?.id) &&
          m.name.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [mentionQuery, members, user?.id]);

  const handleInputChange = (text: string) => {
    setInput(text);
    const m = text.match(/(?:^|\s)@([^\s@]*)$/);
    setMentionQuery(m ? m[1] : null);

    if (text.trim().length > 0) sendTypingStatus(true);
    else sendTypingStatus(false);
  };

  const pickMention = (member: MemberLite) => {
    setInput((prev) =>
      prev.replace(/(^|\s)@[^\s@]*$/, (_, lead) => `${lead}@${member.name} `),
    );
    setPickedMentions((prev) =>
      prev.some((p) => p.user_id === member.user_id) ? prev : [...prev, member],
    );
    setMentionQuery(null);
  };

  const scrollToMessage = (mid: number) => {
    const idx = rendered.findIndex((r) => r.key === `m-${mid}`);
    if (idx >= 0)
      listRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5,
      });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    nearBottomRef.current = y < 120;
    const far = y > 320;
    setShowJump((prev) => (prev === far ? prev : far));
    if (y < 120) setNewCount((c) => (c === 0 ? c : 0));
  };

  const renderItem = ({ item }: { item: RenderItem }) => {
    if (item.kind === "day") {
      return (
        <View style={styles.dayRow}>
          <View style={styles.dayLine} />
          <Text style={styles.dayLabel}>{item.dayLabel}</Text>
          <View style={styles.dayLine} />
        </View>
      );
    }

    const m = item.msg!;
    const isMe = Number(m.user_id) === Number(user?.id);
    const deleted = !!m.deleted_at;
    const edited = !!m.edited_at && !deleted;
    const att = !deleted ? m.attachment : null;
    const timeText = deleted
      ? formatTime(m.deleted_at)
      : edited
        ? `Edited ${formatTime(m.edited_at)}`
        : formatTime(m.created_at);
    const longPress = () => openActions(m);

    return (
      <View
        style={[
          styles.msgRow,
          isMe ? styles.msgRowMe : styles.msgRowThem,
          item.isLastInGroup && { marginBottom: 12 },
        ]}
      >
        {!isMe && item.isFirstInGroup && (
          <View
            style={[
              styles.avatarMini,
              { backgroundColor: avatarColor(m.user_id) },
            ]}
          >
            <Text style={styles.avatarMiniText}>
              {m.name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
        )}
        {!isMe && !item.isFirstInGroup && <View style={styles.avatarSpacer} />}

        <View style={{ maxWidth: "82%" }}>
          {item.showName && (
            <Text style={styles.senderName} numberOfLines={1}>
              {m.name}
            </Text>
          )}
          <TouchableOpacity
            activeOpacity={0.85}
            delayLongPress={250}
            onLongPress={longPress}
            style={[
              styles.bubble,
              isMe ? styles.bubbleMe : styles.bubbleThem,
              item.isFirstInGroup && !isMe && styles.bubbleThemFirst,
              item.isFirstInGroup && isMe && styles.bubbleMeFirst,
              item.isLastInGroup && isMe && styles.bubbleMeLast,
              item.isLastInGroup && !isMe && styles.bubbleThemLast,
            ]}
          >
            {m.reply_to && !deleted && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => scrollToMessage(m.reply_to!.id)}
                onLongPress={longPress}
                style={[styles.quote, isMe ? styles.quoteMe : styles.quoteThem]}
              >
                <Text
                  style={[styles.quoteName, isMe && styles.quoteNameMe]}
                  numberOfLines={1}
                >
                  {Number(m.reply_to.user_id) === Number(user?.id)
                    ? "You"
                    : m.reply_to.name}
                </Text>
                <Text
                  style={[
                    styles.quoteBody,
                    isMe && styles.quoteBodyMe,
                    m.reply_to.deleted && { fontStyle: "italic" },
                  ]}
                  numberOfLines={2}
                >
                  {m.reply_to.deleted ? "Message deleted" : m.reply_to.body}
                </Text>
              </TouchableOpacity>
            )}

            {deleted ? (
              <Text style={[styles.deletedText, isMe && styles.deletedTextMe]}>
                🚫 Message deleted
              </Text>
            ) : (
              <>
                {att?.is_image && (
                  <AttachmentImage
                    uri={fileUrl(att.file)}
                    onPress={() => setViewerUri(fileUrl(att.file))}
                    onLongPress={longPress}
                    styles={styles}
                    mutedColor={colors.textFaint}
                  />
                )}
                {att && !att.is_image && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => downloadAttachment(att)}
                    onLongPress={longPress}
                    style={[styles.fileChip, isMe && styles.fileChipMe]}
                  >
                    <Ionicons
                      name={fileIconFor(att.name)}
                      size={26}
                      color={isMe ? ON_ACCENT_MUTED : colors.sender}
                    />
                    <View style={{ flexShrink: 1 }}>
                      <Text
                        style={[styles.fileName, isMe && { color: ON_ACCENT }]}
                        numberOfLines={1}
                      >
                        {att.name}
                      </Text>
                      <Text
                        style={[
                          styles.fileMeta,
                          isMe && { color: ON_ACCENT_MUTED },
                        ]}
                      >
                        {formatSize(att.size)} · Tap to download
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                {!!m.body && (
                  <Text
                    style={[styles.bubbleText, isMe && styles.bubbleTextMe]}
                  >
                    {renderBody(m.body, m.mentions, isMe, styles)}
                  </Text>
                )}
              </>
            )}

            <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
              {timeText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const canSend = (!!input.trim() || !!pending) && !sending;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBackToTeam}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerAvatar}>
          <MaterialCommunityIcons
            name="account-group"
            size={22}
            color={ON_ACCENT}
          />
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.headerSubRow}>
            <LiveDot styles={styles} />
            <Text style={styles.headerSub}>
              {typingUsers.length > 0
                ? typingUsers.length === 1
                  ? `${typingUsers[0].name} is typing…`
                  : `${typingUsers.length} members typing…`
                : onlineCount > 0
                  ? `${onlineCount} Online ${onlineCount === 1 ? "member" : "members"}`
                  : members.length > 0
                    ? `${members.length} ${members.length === 1 ? "member" : "members"} · Live updates`
                    : "Team channel · Live updates"}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={colors.error}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : messages.length === 0 && typingUsers.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons
            name="chat-outline"
            size={64}
            color={colors.emptyIcon}
          />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySub}>
            Be the first to say hi to your team 👋
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={rendered}
            inverted
            keyExtractor={(r) => r.key}
            renderItem={renderItem}
            extraData={isDark}
            ListHeaderComponent={
              <TypingIndicator typingUsers={typingUsers} styles={styles} />
            }
            ListFooterComponent={
              loadingOlder ? (
                <ActivityIndicator
                  style={{ marginVertical: 12 }}
                  size="small"
                  color={ACCENT}
                />
              ) : null
            }
            contentContainerStyle={{ padding: 16 }}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.4}
            onScroll={onScroll}
            scrollEventThrottle={64}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            windowSize={11}
            onScrollToIndexFailed={(info) =>
              listRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              })
            }
          />
          {showJump && (
            <TouchableOpacity
              style={styles.jumpBtn}
              onPress={() => {
                setNewCount(0);
                scrollToBottom(true);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-down" size={22} color={ON_ACCENT} />
              {newCount > 0 && (
                <View style={styles.jumpBadge}>
                  <Text style={styles.jumpBadgeText}>
                    {newCount > 99 ? "99+" : newCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {mentionCandidates.length > 0 && (
        <View style={styles.mentionPicker}>
          {mentionCandidates.map((m) => (
            <TouchableOpacity
              key={m.user_id}
              style={styles.mentionRow}
              onPress={() => pickMention(m)}
            >
              <View
                style={[
                  styles.avatarMini,
                  { backgroundColor: avatarColor(m.user_id), marginRight: 10 },
                ]}
              >
                <Text style={styles.avatarMiniText}>
                  {m.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.mentionRowText}>{m.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {editing && (
        <View style={[styles.replyBar, { borderLeftColor: "#F59E0B" }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.replyBarName, { color: "#F59E0B" }]}>
              Editing message
            </Text>
            <Text style={styles.replyBarBody} numberOfLines={1}>
              {editing.body || "Attachment"}
            </Text>
          </View>
          <TouchableOpacity onPress={cancelEdit} hitSlop={10}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {replyTo && !editing && (
        <View style={styles.replyBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyBarName} numberOfLines={1}>
              Replying to{" "}
              {Number(replyTo.user_id) === Number(user?.id)
                ? "yourself"
                : replyTo.name}
            </Text>
            <Text style={styles.replyBarBody} numberOfLines={1}>
              {replyTo.body || (replyTo.attachment ? "Attachment" : "")}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={10}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Picker loading state */}
      {picking && (
        <View style={styles.pendingBar}>
          <View style={styles.pendingIcon}>
            <ActivityIndicator size="small" color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingName}>
              {picking === "image" ? "Preparing photo…" : "Preparing document…"}
            </Text>
            <Text style={styles.pendingMeta}>
              Bear with us — opening your picker
            </Text>
          </View>
        </View>
      )}

      {pending && (
        <View style={styles.pendingBar}>
          <View style={{ position: "relative" }}>
            {pending.isImage ? (
              <Image
                source={{ uri: pending.uri }}
                style={styles.pendingThumb}
              />
            ) : (
              <View style={styles.pendingIcon}>
                <Ionicons
                  name={fileIconFor(pending.name)}
                  size={26}
                  color={colors.sender}
                />
              </View>
            )}
            {sending && (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(11,18,32,0.6)",
                    borderRadius: 8,
                  },
                ]}
              >
                <ActivityIndicator size="small" color={ACCENT} />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingName} numberOfLines={1}>
              {pending.name}
            </Text>
            <Text style={styles.pendingMeta}>
              {sending
                ? `Uploading ${formatSize(pending.size) || "document"}…`
                : formatSize(pending.size) || "Ready to send"}
            </Text>
          </View>
          {!sending && (
            <TouchableOpacity onPress={() => setPending(null)} hitSlop={10}>
              <Ionicons
                name="close-circle"
                size={22}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Input */}
      <View style={styles.inputBar}>
        {!editing && (
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => setAttachSheet(true)}
            disabled={sending}
          >
            <Ionicons name="attach" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={pending ? "Add a caption…" : "Message your team…"}
            placeholderTextColor={colors.placeholder}
            value={input}
            onChangeText={handleInputChange}
            onBlur={() => sendTypingStatus(false)}
            multiline
            maxLength={1000}
            editable={!sending}
            keyboardAppearance={isDark ? "dark" : "light"}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            !canSend && { backgroundColor: colors.sendDisabled },
          ]}
          disabled={!canSend}
          onPress={send}
        >
          {sending ? (
            <ActivityIndicator size="small" color={ON_ACCENT} />
          ) : (
            <Ionicons
              name={editing ? "checkmark" : "send"}
              size={18}
              color={canSend ? ON_ACCENT : colors.textFaint}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Message actions */}
      <Modal
        visible={!!actionMsg}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMsg(null)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setActionMsg(null)}
        >
          <View style={styles.sheet}>
            {actionMsg && (
              <>
                <SheetRow
                  icon="arrow-undo-outline"
                  label="Reply"
                  styles={styles}
                  iconColor={colors.sheetText}
                  onPress={() => {
                    setReplyTo(actionMsg);
                    setActionMsg(null);
                    setTimeout(() => inputRef.current?.focus(), 150);
                  }}
                />
                {!!actionMsg.attachment && !actionMsg.deleted_at && (
                  <SheetRow
                    icon="download-outline"
                    label="Download"
                    styles={styles}
                    iconColor={colors.sheetText}
                    onPress={() => downloadAttachment(actionMsg.attachment!)}
                  />
                )}
                {Number(actionMsg.user_id) === Number(user?.id) && (
                  <>
                    <SheetRow
                      icon="create-outline"
                      label="Edit"
                      styles={styles}
                      iconColor={colors.sheetText}
                      onPress={() => startEdit(actionMsg)}
                    />
                    <SheetRow
                      icon="trash-outline"
                      label="Delete"
                      danger
                      styles={styles}
                      iconColor={colors.sheetText}
                      onPress={() => confirmDelete(actionMsg)}
                    />
                  </>
                )}
              </>
            )}
            <SheetRow
              icon="close-outline"
              label="Cancel"
              styles={styles}
              iconColor={colors.sheetText}
              onPress={() => setActionMsg(null)}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Attach sheet */}
      <Modal
        visible={attachSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setAttachSheet(false)}
        >
          <View style={styles.sheet}>
            <SheetRow
              icon="image-outline"
              label="Photo from gallery"
              styles={styles}
              iconColor={colors.sheetText}
              onPress={pickImage}
            />
            <SheetRow
              icon="folder-open-outline"
              label="File from device"
              styles={styles}
              iconColor={colors.sheetText}
              onPress={pickDocument}
            />
            <SheetRow
              icon="close-outline"
              label="Cancel"
              styles={styles}
              iconColor={colors.sheetText}
              onPress={() => setAttachSheet(false)}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image viewer (always dark for contrast) */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <View style={styles.viewerBg}>
          {viewerUri && (
            <Image
              source={{ uri: viewerUri }}
              style={styles.viewerImg}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewerUri(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Downloading overlay */}
      {downloading && (
        <View style={styles.downloadOverlay}>
          <View style={styles.downloadBox}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.downloadText}>Downloading…</Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
