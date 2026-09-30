import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import {
  getPermissionsAsync,
  isAvailableAsync,
  PermissionStatus,
  requestPermissionsAsync,
} from "expo-pedometer";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
const TREADMILL_MODE_KEY = "@taskcare360_treadmill_mode";
const BATTERY_PROMPT_KEY = "@taskcare360_battery_prompt_shown"; // ✅ ADDED

export default function StepsScreen() {
  const [walkingSteps, setWalkingSteps] = useState(0);
  const [treadmillSteps, setTreadmillSteps] = useState(0);
  const [targetSteps, setTargetSteps] = useState(5000);
  const [isTreadmillMode, setIsTreadmillMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [modalVisible, setModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState("5000");
  const [updatingGoal, setUpdatingGoal] = useState(false);

  const blinkAnim = useRef(new Animated.Value(1)).current;
  const treadmillModeRef = useRef(isTreadmillMode);
  const isCheckingPermissions = useRef(false);
  const router = useRouter();

  // Helper function to handle session expiration - just redirect
  const handleSessionExpired = useCallback(() => {
    router.replace("/login?sessionExpired=true");
  }, [router]);

  const [hasNetError, setHasNetError] = useState(false);

  const handlePermissionCheck = async (): Promise<boolean> => {
    if (isCheckingPermissions.current) return false;
    isCheckingPermissions.current = true;

    try {
      const available = await isAvailableAsync();
      if (!available) {
        isCheckingPermissions.current = false;
        return false;
      }

      const existing = await getPermissionsAsync();

      if (existing.status === PermissionStatus.GRANTED) {
        isCheckingPermissions.current = false;
        return true;
      }

      if (existing.canAskAgain) {
        const requested = await requestPermissionsAsync();
        if (requested.status === PermissionStatus.GRANTED) {
          isCheckingPermissions.current = false;
          return true;
        }

        const updated = await getPermissionsAsync();
        if (!updated.canAskAgain) {
          isCheckingPermissions.current = false;
          // Fall through to the alert below
        }
      }

      Alert.alert(
        "Physical Activity Permission Required",
        "Required to track your steps.\n\n" +
          "How to enable:\n" +
          "1. Tap 'Open Settings' below.\n" +
          "2. Select 'Permissions'.\n" +
          "3. Tap 'Physical activity' (or 'Motion').\n" +
          "4. Choose 'Allow'.",
        [
          {
            text: "Open Settings",
            onPress: async () => {
              isCheckingPermissions.current = false;
              await Linking.openSettings();
            },
          },
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              isCheckingPermissions.current = false;
            },
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            isCheckingPermissions.current = false;
          },
        },
      );

      return false;
    } catch (e) {
      console.log("Permission check error:", e);
      isCheckingPermissions.current = false;
      return false;
    }
  };

  // ✅ NEW: Show battery optimization prompt (once per install)
  const maybeShowBatteryPrompt = async () => {
    if (Platform.OS !== "android") return;

    const alreadyShown = await AsyncStorage.getItem(BATTERY_PROMPT_KEY);
    if (alreadyShown === "true") return;

    setTimeout(() => {
      Alert.alert(
        "Enable Background Tracking",
        "For the most accurate step tracking, please allow TaskCare 360 to run in the background:\n\n" +
          "1. Tap 'Open Settings' below\n" +
          "2. Find TaskCare 360\n" +
          "3. Set Battery to 'Unrestricted'\n" +
          "4. Enable 'Autostart' (if available)",
        [
          {
            text: "Open Settings",
            onPress: async () => {
              await AsyncStorage.setItem(BATTERY_PROMPT_KEY, "true");
              Linking.openSettings();
            },
          },
          {
            text: "Later",
            style: "cancel",
            onPress: async () => {
              await AsyncStorage.setItem(BATTERY_PROMPT_KEY, "true");
            },
          },
        ],
      );
    }, 800);
  };

  const fetchCloudMetrics = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const savedMode = await AsyncStorage.getItem(TREADMILL_MODE_KEY);
      const isTreadmill = savedMode !== null ? JSON.parse(savedMode) : false;
      setIsTreadmillMode(isTreadmill);
      treadmillModeRef.current = isTreadmill;

      // Read pending queue from the new tracker instead of the old buffer
      const { getPendingQueue } = require("../utils/stepTracker");
      const pendingEvents = await getPendingQueue();
      const localBufferWalking = pendingEvents
        .filter((e: any) => e.mode === "walking")
        .reduce((sum: number, e: any) => sum + e.delta, 0);
      const localBufferTreadmill = pendingEvents
        .filter((e: any) => e.mode === "treadmill")
        .reduce((sum: number, e: any) => sum + e.delta, 0);

      const activeParam = isTreadmill ? "treadmill" : "walking";
      const response = await fetch(
        `${API_BASE}/steps/data?mode=${activeParam}`,
        {
          credentials: "include",
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (response.status === 401) {
        handleSessionExpired();
        return;
      }

      if (!response.ok) throw new Error(`Server status: ${response.status}`);

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response.");
      }

      const data = await response.json();
      if (data.status === "success") {
        setTargetSteps(data.target_steps);

        // Cache the target so the notification module can read it
        await AsyncStorage.setItem(
          "@taskcare360_cached_target",
          String(data.target_steps),
        );

        const freshWalking = data.walking_steps + localBufferWalking;
        const freshTreadmill = data.treadmill_steps + localBufferTreadmill;

        setWalkingSteps((prev) => Math.max(prev, freshWalking));
        setTreadmillSteps((prev) => Math.max(prev, freshTreadmill));

        setHasNetError(false);
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.log("Cloud pull failure handled safely:", e);
      setHasNetError(true);
    } finally {
      setLoading(false);
    }
  };

  const toggleTreadmillMode = async () => {
    try {
      const nextMode = !isTreadmillMode;
      setIsTreadmillMode(nextMode);
      treadmillModeRef.current = nextMode;
      await AsyncStorage.setItem(TREADMILL_MODE_KEY, JSON.stringify(nextMode));
    } catch (error) {
      console.error("Configuration toggle write error:", error);
    }
  };

  const handleUpdateGoal = async () => {
    const parsedGoal = parseInt(goalInput, 10);
    if (isNaN(parsedGoal) || parsedGoal <= 0) {
      Alert.alert("Input Error", "Please enter a valid number greater than 0.");
      return;
    }

    setUpdatingGoal(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${API_BASE}/steps/update-target`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({ target: parsedGoal }),
      });

      if (response.status === 401) {
        clearTimeout(timeoutId);
        handleSessionExpired();
        return;
      }

      if (!response.ok) throw new Error("Update target endpoint error");

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid format received");
      }

      const data = await response.json();
      clearTimeout(timeoutId);

      if (data.status === "success") {
        setTargetSteps(parsedGoal);

        await AsyncStorage.setItem(
          "@taskcare360_cached_target",
          String(parsedGoal),
        );

        setModalVisible(false);
      } else {
        Alert.alert("Error", data.error || "Failed to update target goal.");
      }
    } catch (error) {
      clearTimeout(timeoutId);
      Alert.alert(
        "Connection Error",
        "TaskCare360 needs a live network link to update your step target metrics. Please check your internet connection or restart the app.",
      );
    } finally {
      setUpdatingGoal(false);
    }
  };

  useEffect(() => {
    handlePermissionCheck();
    fetchCloudMetrics();
    maybeShowBatteryPrompt(); // ✅ ADDED

    const syncListener = DeviceEventEmitter.addListener(
      "SYNC_COMPLETED",
      fetchCloudMetrics,
    );

    const stepTakeListener = DeviceEventEmitter.addListener(
      "REALTIME_STEP_TAKEN",
      (event) => {
        if (treadmillModeRef.current) {
          setTreadmillSteps((prev) => prev + event.delta);
        } else {
          setWalkingSteps((prev) => prev + event.delta);
        }
      },
    );

    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      syncListener.remove();
      stepTakeListener.remove();
      clearInterval(timer);
    };
  }, []);

  if (loading)
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: "#1a1a2e", justifyContent: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#4ecca3" />
      </View>
    );

  if (hasNetError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#1a1a2e" }}>
        <LinearGradient
          colors={["#1a1a2e", "#16213e"]}
          style={[
            styles.container,
            {
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 30,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="cloud-off-outline"
            size={80}
            color="#ff6b35"
            style={{ marginBottom: 20 }}
          />
          <Text
            style={{
              color: "#ffffff",
              fontSize: 22,
              fontWeight: "800",
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            Sync Connection Error
          </Text>
          <Text
            style={{
              color: "#a4b0be",
              fontSize: 15,
              textAlign: "center",
              lineHeight: 22,
              marginBottom: 30,
            }}
          >
            Could not load the data. The server may be busy, offline, or taking
            too long to respond. Please check your internet connection or
            restart the app to access and update your step milestones.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: "#4ecca3",
              paddingVertical: 14,
              paddingHorizontal: 36,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
            onPress={() => {
              setLoading(true);
              fetchCloudMetrics();
            }}
          >
            <MaterialCommunityIcons name="refresh" size={20} color="#1a1a2e" />
            <Text
              style={{ color: "#1a1a2e", fontWeight: "bold", fontSize: 15 }}
            >
              Retry Connection
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const activeDisplaySteps = isTreadmillMode ? treadmillSteps : walkingSteps;
  const distanceKm = (activeDisplaySteps * 0.000762).toFixed(2);
  const caloriesBurned = (
    activeDisplaySteps * (isTreadmillMode ? 0.0575 : 0.04)
  ).toFixed(1);

  const remainingSteps = Math.max(0, targetSteps - activeDisplaySteps);
  const progress = Math.min(activeDisplaySteps / targetSteps, 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }}>
      <LinearGradient colors={["#000000", "#111111"]} style={styles.container}>
        <View style={styles.header}>
          <View style={styles.liveBadge}>
            <Animated.View style={[styles.liveDot, { opacity: blinkAnim }]} />
            <Text style={styles.liveText}>
              {isTreadmillMode ? "TREADMILL MODE" : "WALKING MODE"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Background Settings",
                  "For accurate step tracking:\n\n" +
                    "1. Open Settings\n" +
                    "2. Find TaskCare 360\n" +
                    "3. Set Battery to 'Unrestricted'",
                  [
                    {
                      text: "Open Settings",
                      onPress: () => Linking.openSettings(),
                    },
                    { text: "Cancel", style: "cancel" },
                  ],
                );
              }}
            >
              <Ionicons
                name="battery-charging-outline"
                size={22}
                color="#4ecca3"
              />
            </TouchableOpacity>
            <Text style={styles.timeText}>
              {currentTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>

        <View style={styles.mainProgressArea}>
          <MaterialCommunityIcons
            name={isTreadmillMode ? "run-fast" : "walk"}
            size={60}
            color="#4ecca3"
          />
          <Text style={styles.stepCount}>
            {activeDisplaySteps.toLocaleString()}
          </Text>
          <Text style={styles.stepLabel}>STEPS TODAY</Text>
          <View style={styles.progressBarBg}>
            <View
              style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
            />
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Ionicons name="location" size={24} color="#4ecca3" />
            <Text style={styles.statVal}>{distanceKm}</Text>
            <Text style={styles.statLabel}>KM</Text>
          </View>

          <View
            style={[
              styles.statItem,
              {
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: "#ffffff20",
              },
            ]}
          >
            <MaterialCommunityIcons name="fire" size={24} color="#ff6b35" />
            <Text style={[styles.statVal, { color: "#ff6b35" }]}>
              {caloriesBurned}
            </Text>
            <Text style={styles.statLabel}>CALORIES</Text>
          </View>

          <View
            style={[
              styles.statItem,
              {
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: "#ffffff20",
              },
            ]}
          >
            <Ionicons name="flag" size={24} color="#4ecca3" />
            <Text style={styles.statVal}>
              {remainingSteps.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>LEFT</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="trending-up" size={24} color="#4ecca3" />
            <Text style={styles.statVal}>{targetSteps.toLocaleString()}</Text>
            <Text style={styles.statLabel}>GOAL</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.treadmillBtn,
              isTreadmillMode && styles.treadmillBtnActive,
            ]}
            onPress={toggleTreadmillMode}
          >
            <MaterialCommunityIcons
              name="run"
              size={20}
              color={isTreadmillMode ? "#000000" : "#4ecca3"}
            />
            <Text
              style={[
                styles.treadmillBtnText,
                isTreadmillMode && styles.treadmillBtnTextActive,
              ]}
            >
              {isTreadmillMode
                ? "Switch to Walking Mode"
                : "Switch to Treadmill Mode"}
            </Text>
          </TouchableOpacity>

          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => {
                setGoalInput(targetSteps.toString());
                setModalVisible(true);
              }}
            >
              <Ionicons name="create-outline" size={20} color="#4ecca3" />
              <Text style={styles.outlineBtnText}>Edit Goal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => router.push("/history")}
            >
              <Ionicons name="bar-chart" size={20} color="#4ecca3" />
              <Text style={styles.outlineBtnText}>History</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            if (!updatingGoal) setModalVisible(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.popupCard}>
              <Text style={styles.popupTitle}>Update Daily Step Goal</Text>
              <TextInput
                style={styles.popupInput}
                keyboardType="number-pad"
                value={goalInput}
                onChangeText={setGoalInput}
                editable={!updatingGoal}
                maxLength={6}
              />
              <View
                style={{
                  width: "100%",
                  height: 1,
                  backgroundColor: "#ffffff15",
                  marginVertical: 15,
                }}
              />
              <View style={styles.popupActions}>
                <TouchableOpacity
                  style={[styles.popupBtn, styles.cancelBtn]}
                  onPress={() => setModalVisible(false)}
                  disabled={updatingGoal}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.popupBtn, styles.saveBtn]}
                  onPress={handleUpdateGoal}
                  disabled={updatingGoal}
                >
                  {updatingGoal ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Goal</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 15 },
  header: {
    marginTop: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff10",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2ecc71",
    marginRight: 6,
  },
  liveText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  timeText: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  mainProgressArea: {
    marginVertical: 25,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
    borderRadius: 20,
    paddingVertical: 25,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#ffffff15",
  },
  stepCount: {
    fontSize: 44,
    fontWeight: "900",
    color: "#fff",
    marginVertical: 2,
  },
  stepLabel: {
    color: "#4ecca3",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  progressBarBg: {
    height: 8,
    width: "100%",
    backgroundColor: "#ffffff15",
    borderRadius: 10,
    marginTop: 20,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#4ecca3",
    borderRadius: 10,
  },
  statsGrid: {
    flexDirection: "row",
    backgroundColor: "#ffffff08",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 5,
    marginBottom: 20,
    justifyContent: "space-between",
  },
  statItem: { flex: 1, alignItems: "center", paddingHorizontal: 2 },
  statVal: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 4,
    textAlign: "center",
  },
  statLabel: {
    color: "#95a5a6",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  buttonContainer: { marginBottom: 20, paddingHorizontal: 5 },
  treadmillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff08",
    borderWidth: 1.5,
    borderColor: "#4ecca360",
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  treadmillBtnActive: { backgroundColor: "#4ecca3", borderColor: "#4ecca3" },
  treadmillBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  treadmillBtnTextActive: { color: "#000000" },
  outlineBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#4ecca360",
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  outlineBtnText: { color: "#fcfcfc", fontWeight: "600", fontSize: 14 },
  secondaryRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-around",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },
  popupCard: {
    backgroundColor: "#111111",
    width: "100%",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffffff15",
    elevation: 10,
  },
  popupTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 18,
  },
  popupInput: {
    backgroundColor: "#ffffff08",
    width: "60%",
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4ecca3",
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  popupActions: { flexDirection: "row", gap: 12, width: "100%" },
  popupBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtn: { backgroundColor: "#ffffff10" },
  cancelBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  saveBtn: { backgroundColor: "#4ecca3" },
  saveBtnText: { color: "#000000", fontWeight: "bold", fontSize: 15 },
});
