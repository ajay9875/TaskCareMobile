// app/dashboard.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
const TIMEOUT_MS = 10000;

// Helper: Safe ISO date formatting
const formatDate = (dateString: any) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
};

// Custom Fetch Wrapper with Timeout & Handling
const fetchWithTimeout = async (url: string, options: any = {}) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */
function getColors(isDark: boolean) {
  return {
    bg: isDark ? "#0F172A" : "#F4F7FE",
    surface: isDark ? "#1E293B" : "#FFFFFF",
    border: isDark ? "#334155" : "#E2E8F0",
    divider: isDark ? "#334155" : "#F1F5F9",
    text: isDark ? "#F8FAFC" : "#0F172A",
    title: isDark ? "#F8FAFC" : "#1E293B",
    muted: isDark ? "#94A3B8" : "#64748B",
    faint: isDark ? "#64748B" : "#94A3B8",
    placeholder: isDark ? "#64748B" : "#999999",
    primary: "#6200EE",
    primaryIcon: isDark ? "#A78BFA" : "#6200EE",
    accentBar: isDark ? "#A78BFA" : "#6200EE",
    success: "#10B981",
    completedBg: isDark ? "#052E2B" : "#F0FDF4",
    edit: isDark ? "#38BDF8" : "#007BFF",
    editDisabled: isDark ? "#475569" : "#CBD5E1",
    danger: isDark ? "#F87171" : "#DC3545",
    emptyIcon: isDark ? "#334155" : "#CBD5E1",
    cancelBg: isDark ? "#334155" : "#F1F5F9",
    cancelText: isDark ? "#E2E8F0" : "#64748B",
    overlay: isDark ? "rgba(0, 0, 0, 0.65)" : "rgba(15, 23, 42, 0.5)",
  };
}
type Colors = ReturnType<typeof getColors>;

function createStyles(c: Colors, isDark: boolean) {
  return StyleSheet.create({
    headerBlock: { marginBottom: 20, alignItems: "center" },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: c.text,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 14,
      color: c.muted,
      marginTop: 4,
      fontWeight: "500",
    },
    safeArea: { flex: 1, backgroundColor: c.bg },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.bg,
    },
    container: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },

    /* Add Task Section */
    inputCard: {
      backgroundColor: c.surface,
      padding: 12,
      borderRadius: 15,
      elevation: 3,
      marginBottom: 15,
      borderWidth: isDark ? 1 : 0,
      borderColor: c.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.1,
      shadowRadius: 4,
    },
    input: {
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      padding: 10,
      marginBottom: 8,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.surface,
    },
    addBtn: {
      backgroundColor: c.primary,
      padding: 10,
      borderRadius: 10,
      marginTop: 8,
      alignItems: "center",
    },
    addBtnText: {
      color: "#FFFFFF",
      textAlign: "center",
      fontWeight: "bold",
      fontSize: 15,
    },

    /* Task Cards */
    taskCard: {
      backgroundColor: c.surface,
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      elevation: 2,
      borderLeftWidth: 4,
      borderLeftColor: c.accentBar,
      borderWidth: isDark ? 1 : 0,
      borderColor: c.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.04,
      shadowRadius: 4,
    },
    taskCardCompleted: {
      borderLeftColor: c.success,
      backgroundColor: c.completedBg,
    },
    cardHeaderArea: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      width: "100%",
    },
    textContainer: { flex: 1, paddingRight: 12 },
    checkboxTouchTarget: { padding: 2, alignSelf: "flex-start" },
    textLineThrough: { textDecorationLine: "line-through", color: c.faint },
    taskTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: c.title,
      marginBottom: 4,
    },
    taskDesc: { fontSize: 13, color: c.muted, marginBottom: 6 },
    cardBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: c.divider,
      paddingTop: 8,
    },
    dateText: { fontSize: 11, color: c.faint, fontWeight: "500" },
    actionGroup: { flexDirection: "row", alignItems: "center" },
    iconBtn: { marginLeft: 12, padding: 2 },

    emptyWrap: { alignItems: "center", marginTop: 40 },
    emptyText: { color: c.faint, fontSize: 16, marginTop: 10 },

    /* Modal */
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      width: "90%",
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 22,
      elevation: 10,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: c.text,
      marginBottom: 16,
      textAlign: "center",
    },
    modalInput: {
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      padding: 10,
      marginBottom: 12,
      fontSize: 15,
      color: c.text,
    },
    buttonRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 16,
    },
    cancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: c.cancelBg,
    },
    cancelBtnText: { color: c.cancelText, fontWeight: "600" },
    saveBtn: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: c.primary,
    },
    saveBtnText: { color: "#FFFFFF", fontWeight: "600" },
  });
}

const lightColors = getColors(false);
const darkColors = getColors(true);
const lightStyles = createStyles(lightColors, false);
const darkStyles = createStyles(darkColors, true);

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */
export default function Dashboard() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const c = isDark ? darkColors : lightColors;
  const styles = isDark ? darkStyles : lightStyles;

  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState<number | null>(null);

  // Modals
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<{
    sno: number | null;
    title: string;
    desc: string;
  }>({
    sno: null,
    title: "",
    desc: "",
  });

  const router = useRouter();

  const fetchTasks = async () => {
    try {
      const response = await fetchWithTimeout(`${API_BASE}/dashboard`, {
        credentials: "include",
      });

      if (response.status === 401) {
        router.replace("/login?sessionExpired=true");
        return;
      }
      if (!response.ok) throw new Error("Dashboard endpoint error");

      const data = await response.json();
      if (data.status === "success") {
        setTasks(data.tasks || []);
      }
    } catch (error) {
      Alert.alert(
        "Sync Error",
        "Failed to fetch dashboard data. Please check your connection or try again later.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleAddTask = async () => {
    if (!title.trim()) {
      Alert.alert("Input Error", "Please enter a title.");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_BASE}/addTodo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: title.trim(), desc: desc.trim() }),
      });

      if (response.status === 401) {
        router.replace("/login?sessionExpired=true");
        return;
      }

      const data = await response.json();
      if (data.status === "success") {
        setTitle("");
        setDesc("");
        fetchTasks();
      } else {
        Alert.alert("Error", data.message || "Failed to add task.");
      }
    } catch (error) {
      Alert.alert(
        "Connection Error",
        "Failed to add task. Please check your network connection.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSubmit = async () => {
    if (!editingTask.sno) return;

    setActionLoading(true);
    try {
      const response = await fetchWithTimeout(
        `${API_BASE}/update/${editingTask.sno}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: editingTask.title.trim(),
            desc: editingTask.desc.trim(),
          }),
        },
      );

      if (response.status === 401) {
        router.replace("/login?sessionExpired=true");
        return;
      }

      const result = await response.json();
      if (result.status === "success") {
        setEditModalVisible(false);
        fetchTasks();
      } else {
        Alert.alert("Error", result.message || "Failed to update task.");
      }
    } catch (error) {
      Alert.alert("Update Error", "Failed to update task. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleComplete = async (sno: number) => {
    setToggleLoadingId(sno);
    try {
      const response = await fetchWithTimeout(
        `${API_BASE}/tasks/toggle/${sno}`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (response.status === 401) {
        router.replace("/login?sessionExpired=true");
        return;
      }

      const data = await response.json();
      if (data.status === "success") {
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.SNo === sno
              ? { ...task, is_completed: !task.is_completed }
              : task,
          ),
        );
      } else {
        Alert.alert(
          "Update Failed",
          data.message || "Could not modify task status.",
        );
      }
    } catch (error) {
      Alert.alert(
        "Network Error",
        "Failed to modify status. Check connection and retry.",
      );
    } finally {
      setToggleLoadingId(null);
    }
  };

  const handleDelete = (sno: number) => {
    Alert.alert(
      "Delete Task",
      "Are you sure you want to permanently delete this task?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetchWithTimeout(
                `${API_BASE}/delete/${sno}`,
                {
                  method: "DELETE",
                  credentials: "include",
                },
              );

              if (response.status === 401) {
                router.replace("/login?sessionExpired=true");
                return;
              }

              const data = await response.json();
              if (data.status === "success") {
                fetchTasks();
              } else {
                Alert.alert("Error", data.message || "Could not delete item.");
              }
            } catch (e) {
              Alert.alert("Error", "Failed to delete task.");
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={c.primaryIcon} />
      </SafeAreaView>
    );
  }

  const keyboardAppearance = isDark ? "dark" : "light";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={styles.headerTitle}>Task Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Manage your daily priorities efficiently.
          </Text>
        </View>

        {/* Add Task Input Card */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Task Title..."
            placeholderTextColor={c.placeholder}
            value={title}
            onChangeText={setTitle}
            keyboardAppearance={keyboardAppearance}
          />
          <TextInput
            style={[styles.input, { height: 60 }]}
            placeholder="Description..."
            placeholderTextColor={c.placeholder}
            multiline
            value={desc}
            onChangeText={setDesc}
            keyboardAppearance={keyboardAppearance}
          />
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAddTask}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.addBtnText}>+ Add</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Task List */}
        <FlatList
          data={tasks}
          extraData={isDark}
          keyExtractor={(item) => item.SNo.toString()}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View
              style={[
                styles.taskCard,
                item.is_completed && styles.taskCardCompleted,
              ]}
            >
              <View style={styles.cardHeaderArea}>
                <View style={styles.textContainer}>
                  <Text
                    style={[
                      styles.taskTitle,
                      item.is_completed && styles.textLineThrough,
                    ]}
                  >
                    {item.title}
                  </Text>
                  {item.desc ? (
                    <Text
                      style={[
                        styles.taskDesc,
                        item.is_completed && styles.textLineThrough,
                      ]}
                    >
                      {item.desc}
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={() => handleToggleComplete(item.SNo)}
                  style={styles.checkboxTouchTarget}
                  disabled={toggleLoadingId === item.SNo}
                >
                  {toggleLoadingId === item.SNo ? (
                    <ActivityIndicator
                      size="small"
                      color={c.primaryIcon}
                      style={{ padding: 2 }}
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name={
                        item.is_completed
                          ? "checkbox-marked-circle"
                          : "checkbox-blank-circle-outline"
                      }
                      size={24}
                      color={item.is_completed ? c.success : c.primaryIcon}
                    />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.cardBottom}>
                <View>
                  <Text style={styles.dateText}>
                    Created: {formatDate(item.date_created)}
                  </Text>
                  {item.date_updated && (
                    <Text style={styles.dateText}>
                      Updated: {formatDate(item.date_updated)}
                    </Text>
                  )}
                </View>
                <View style={styles.actionGroup}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingTask({
                        sno: item.SNo,
                        title: item.title,
                        desc: item.desc,
                      });
                      setEditModalVisible(true);
                    }}
                    disabled={item.is_completed}
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={20}
                      color={item.is_completed ? c.editDisabled : c.edit}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.SNo)}
                    style={styles.iconBtn}
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={20}
                      color={c.danger}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons
                name="clipboard-text-outline"
                size={60}
                color={c.emptyIcon}
              />
              <Text style={styles.emptyText}>No tasks yet. Add one above!</Text>
            </View>
          }
        />

        {/* Edit Task Modal */}
        <Modal visible={isEditModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Update Task</Text>
              <TextInput
                style={styles.modalInput}
                value={editingTask.title}
                onChangeText={(text) =>
                  setEditingTask({ ...editingTask, title: text })
                }
                placeholder="Title"
                placeholderTextColor={c.placeholder}
                keyboardAppearance={keyboardAppearance}
              />
              <TextInput
                style={[styles.modalInput, { height: 80 }]}
                value={editingTask.desc}
                onChangeText={(text) =>
                  setEditingTask({ ...editingTask, desc: text })
                }
                placeholder="Description"
                placeholderTextColor={c.placeholder}
                multiline
                keyboardAppearance={keyboardAppearance}
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleUpdateSubmit}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}
