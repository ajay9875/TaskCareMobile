// app/teams/chat/[id].tsx
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../../context/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
const POLL_MS = 3000;
const TYPING_THROTTLE_MS = 2500;

type ReplyRef = { id: number; user_id: number; name: string; body: string };
type MemberLite = { user_id: number; name: string };

type Message = {
  id: number;
  user_id: number;
  name: string;
  body: string;
  created_at: string;
  reply_to?: ReplyRef | null;
  mentions?: MemberLite[];
};

type TeamInfo = { id: number; name: string };

function formatTime(iso: string) {
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

/* ── Module-level helper (shared by parent + TypingIndicator) ── */
function scrollFlatListToEnd(
  ref: React.RefObject<FlatList<any> | null>,
  animated = true,
  delay = 80,
) {
  setTimeout(() => {
    try {
      ref.current?.scrollToEnd({ animated });
    } catch {
      /* list not mounted yet — safe to ignore */
    }
  }, delay);
}

function LiveDot() {
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

/* ── Single canonical TypingIndicator (no scrolling inside it) ── */
function TypingIndicator({ typingUsers }: { typingUsers: MemberLite[] }) {
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

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderBody(
  body: string,
  mentions: MemberLite[] | undefined,
  isMe: boolean,
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

export default function TeamChatScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    name?: string | string[];
  }>();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;

  const teamId = Number(id);
  const validTeamId = Number.isSafeInteger(teamId) && teamId > 0;

  const router = useRouter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [team, setTeam] = useState<TeamInfo | null>(
    name ? { id: teamId, name } : null,
  );
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberLite[]>([]);
  const [typingUsers, setTypingUsers] = useState<MemberLite[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pickedMentions, setPickedMentions] = useState<MemberLite[]>([]);

  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  const lastIdRef = useRef<number>(0);
  const lastTypingPingRef = useRef<number>(0);
  const listRef = useRef<FlatList<any>>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const scrollToEnd = (animated = true, delay = 80) =>
    scrollFlatListToEnd(listRef, animated, delay);

  // Android keyboard lift
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      setAndroidKeyboardHeight(e.endCoordinates?.height ?? 0);
      scrollToEnd(true);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setAndroidKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Fetch team + members
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

  // Typing ping (throttled)
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

  const fetchMessages = useCallback(
    async (initial = false) => {
      try {
        if (!validTeamId) {
          setError("Invalid team ID. Please go back and select a team.");
          setLoading(false);
          return;
        }
        const since = initial ? 0 : lastIdRef.current;
        const url = since
          ? `${API_BASE}/teams/${teamId}/messages?since=${since}`
          : `${API_BASE}/teams/${teamId}/messages`;

        const res = await fetch(url, { credentials: "include" });

        if (res.status === 401) {
          router.replace("/login?sessionExpired=true");
          return;
        }
        if (res.status === 403) {
          setError("You are not a member of this team.");
          return;
        }
        if (!res.ok) throw new Error("fetch failed");

        const data = await res.json();
        const newMsgs: Message[] = data.messages || [];

        const activeTypers: MemberLite[] = (data.typing_users || []).filter(
          (u: MemberLite) => Number(u.user_id) !== Number(user?.id),
        );
        setTypingUsers(activeTypers);

        if (newMsgs.length > 0) {
          lastIdRef.current = newMsgs[newMsgs.length - 1].id;
          setMessages((prev) => {
            const merged = initial ? newMsgs : [...prev, ...newMsgs];
            const seen = new Set<number>();
            return merged.filter((m) => {
              if (seen.has(m.id)) return false;
              seen.add(m.id);
              return true;
            });
          });
          // Fresh initial load → jump hard to bottom. New messages → smooth.
          scrollToEnd(!initial, initial ? 250 : 80);
        }
        setError(null);
      } catch {
        /* silent — retry next poll */
      } finally {
        if (initial) setLoading(false);
      }
    },
    [teamId, validTeamId, router, user?.id],
  );

  // Initial load + poll
  useEffect(() => {
    isMountedRef.current = true;

    const tick = async () => {
      await fetchMessages(false);
      if (!isMountedRef.current) return;
      pollTimerRef.current = setTimeout(tick, POLL_MS);
    };

    (async () => {
      setLoading(true);
      await fetchMessages(true);
      pollTimerRef.current = setTimeout(tick, POLL_MS);
    })();

    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      sendTypingStatus(false);
    };
  }, [fetchMessages, sendTypingStatus]);

  // Auto-scroll when typing indicator appears
  useEffect(() => {
    if (typingUsers.length > 0) scrollToEnd(true, 120);
  }, [typingUsers.length]);

  const send = async () => {
    const body = input.trim();
    if (!body || sending) return;

    setSending(true);
    sendTypingStatus(false);

    try {
      const mentionIds = pickedMentions
        .filter((m) => body.includes(`@${m.name}`))
        .map((m) => m.user_id);

      const res = await fetch(`${API_BASE}/teams/${teamId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          body,
          reply_to_id: replyTo?.id ?? null,
          mentions: mentionIds,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.message) {
        setInput("");
        setReplyTo(null);
        setPickedMentions([]);
        setMentionQuery(null);
        const m = data.message as Message;
        if (m.id > lastIdRef.current) lastIdRef.current = m.id;
        setMessages((prev) => [...prev, m]);
        scrollToEnd(true);
      } else {
        setError(data.error || "Failed to send");
      }
    } catch {
      setError("Network error");
    } finally {
      setSending(false);
    }
  };

  const displayName = team?.name || "Team Chat";

  const rendered = useMemo(() => {
    const out: Array<{
      kind: "day" | "msg";
      key: string;
      dayLabel?: string;
      msg?: Message;
      isFirstInGroup?: boolean;
      isLastInGroup?: boolean;
      showName?: boolean;
    }> = [];

    let lastDay = "";
    let lastSender: number | null = null;
    let lastWasMe: boolean | null = null;

    messages.forEach((m, i) => {
      const dk = dayKey(m.created_at);
      if (dk !== lastDay) {
        out.push({
          kind: "day",
          key: `day-${dk}-${i}`,
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

    return out;
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

  const scrollToMessage = (id: number) => {
    const idx = rendered.findIndex((r) => r.key === `m-${id}`);
    if (idx >= 0)
      listRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5,
      });
  };

  const renderItem = ({
    item,
  }: {
    item: {
      kind: "day" | "msg";
      key: string;
      dayLabel?: string;
      msg?: Message;
      isFirstInGroup?: boolean;
      isLastInGroup?: boolean;
      showName?: boolean;
    };
  }) => {
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
            onLongPress={() => setReplyTo(m)}
            style={[
              styles.bubble,
              isMe ? styles.bubbleMe : styles.bubbleThem,
              item.isFirstInGroup && !isMe && styles.bubbleThemFirst,
              item.isFirstInGroup && isMe && styles.bubbleMeFirst,
              item.isLastInGroup && isMe && styles.bubbleMeLast,
              item.isLastInGroup && !isMe && styles.bubbleThemLast,
            ]}
          >
            {m.reply_to && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => scrollToMessage(m.reply_to!.id)}
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
                  style={[styles.quoteBody, isMe && styles.quoteBodyMe]}
                  numberOfLines={2}
                >
                  {m.reply_to.body}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
              {renderBody(m.body, m.mentions, isMe)}
            </Text>
            <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
              {formatTime(m.created_at)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        Platform.OS === "android" && androidKeyboardHeight > 0
          ? { paddingBottom: androidKeyboardHeight }
          : null,
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerAvatar}>
          <MaterialCommunityIcons
            name="account-group"
            size={22}
            color="#0f0f0f"
          />
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.headerSubRow}>
            <LiveDot />
            <Text style={styles.headerSub}>
              {typingUsers.length > 0
                ? typingUsers.length === 1
                  ? `${typingUsers[0].name} is typing…`
                  : `${typingUsers.length} members typing…`
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
          <ActivityIndicator size="large" color="#4ecca3" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color="#DC2626"
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : messages.length === 0 && typingUsers.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons
            name="chat-outline"
            size={64}
            color="#334155"
          />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySub}>
            Be the first to say hi to your team 👋
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rendered}
          keyExtractor={(r) => r.key}
          renderItem={renderItem}
          ListFooterComponent={<TypingIndicator typingUsers={typingUsers} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
          onContentSizeChange={() => {
            // Scroll on first layout and whenever content grows (new msgs / typing bubble).
            scrollToEnd(false, 60);
            scrollToEnd(true, 300);
          }}
          onLayout={() => {
            // Guarantee first paint lands at the bottom.
            scrollToEnd(false, 0);
            scrollToEnd(false, 150);
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollToIndexFailed={(info) =>
            listRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            })
          }
        />
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

      {replyTo && (
        <View style={styles.replyBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyBarName} numberOfLines={1}>
              Replying to{" "}
              {Number(replyTo.user_id) === Number(user?.id)
                ? "yourself"
                : replyTo.name}
            </Text>
            <Text style={styles.replyBarBody} numberOfLines={1}>
              {replyTo.body}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={10}>
            <Ionicons name="close" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View
        style={[
          styles.inputBar,
          androidKeyboardHeight > 0 && { paddingBottom: 10 },
        ]}
      >
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Message your team…"
            placeholderTextColor="#64748B"
            value={input}
            onChangeText={handleInputChange}
            onBlur={() => sendTypingStatus(false)}
            multiline
            maxLength={1000}
            editable={!sending}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!input.trim() || sending) && { backgroundColor: "#334155" },
          ]}
          disabled={!input.trim() || sending}
          onPress={send}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#4ecca3" />
          ) : (
            <Ionicons name="send" size={18} color="#0f0f0f" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 14,
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  backBtn: { padding: 4, marginRight: 4 },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#4ecca3",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  headerSub: { fontSize: 11, color: "#94A3B8" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 12 },
  emptySub: { color: "#94A3B8", fontSize: 13, marginTop: 4 },
  errorText: {
    color: "#DC2626",
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
  dayLine: { flex: 1, height: 1, backgroundColor: "#1f2937" },
  dayLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
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
    color: "#4ecca3",
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
    borderColor: "#0b1220",
  },
  typingAvatarText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
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
    backgroundColor: "#4ecca3",
  },

  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16 },
  bubbleMe: { backgroundColor: "#4ecca3" },
  bubbleThem: { backgroundColor: "#1f2937" },
  bubbleMeFirst: { borderTopRightRadius: 6 },
  bubbleMeLast: { borderBottomRightRadius: 6 },
  bubbleThemFirst: { borderTopLeftRadius: 6 },
  bubbleThemLast: { borderBottomLeftRadius: 6 },
  bubbleText: { color: "#fff", fontSize: 15, lineHeight: 20 },
  bubbleTextMe: { color: "#0f0f0f" },
  bubbleTime: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  bubbleTimeMe: { color: "#065f46" },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: "#111827",
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  input: { maxHeight: 120, color: "#fff", fontSize: 15, paddingVertical: 8 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4ecca3",
    alignItems: "center",
    justifyContent: "center",
  },

  mention: { color: "#4ecca3", fontWeight: "700" },
  mentionMe: { color: "#065f46", fontWeight: "800" },

  quote: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  quoteThem: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderLeftColor: "#4ecca3",
  },
  quoteMe: { backgroundColor: "rgba(0,0,0,0.12)", borderLeftColor: "#065f46" },
  quoteName: { fontSize: 11, fontWeight: "800", color: "#4ecca3" },
  quoteNameMe: { color: "#065f46" },
  quoteBody: { fontSize: 12, color: "#CBD5E1", marginTop: 1 },
  quoteBodyMe: { color: "#134e4a" },

  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#111827",
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    borderLeftWidth: 3,
    borderLeftColor: "#4ecca3",
  },
  replyBarName: { color: "#4ecca3", fontSize: 12, fontWeight: "800" },
  replyBarBody: { color: "#94A3B8", fontSize: 12, marginTop: 1 },

  mentionPicker: {
    backgroundColor: "#111827",
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
  },
  mentionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mentionRowText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
