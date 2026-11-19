import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { recoverMissedSteps, updateNativeTarget } from "../utils/stepTracker";

let ExpoPedometer: any = null;
try {
  ExpoPedometer = require("expo-pedometer");
} catch (e) {
  console.log("ExpoPedometer not found in Expo Go");
}

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
const BATTERY_PROMPT_KEY = "@taskcare360_battery_prompt_shown";

export default function StepsScreen() {
  const [walkingSteps, setWalkingSteps] = useState(0);
  const [targetSteps, setTargetSteps] = useState(5000);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [modalVisible, setModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState("5000");
  const [updatingGoal, setUpdatingGoal] = useState(false);

  const blinkAnim = useRef(new Animated.Value(1)).current;
  const isCheckingPermissions = useRef(false);
  const router = useRouter();

  const handleSessionExpired = useCallback(() => {
    router.replace("/login?sessionExpired=true");
  }, [router]);

  const [hasNetError, setHasNetError] = useState(false);

  const handlePermissionCheck = async (): Promise<boolean> => {
    if (!ExpoPedometer) {
      isCheckingPermissions.current = false;
      return false;
    }
    if (isCheckingPermissions.current) return false;
    isCheckingPermissions.current = true;

    try {
      const available = await ExpoPedometer.isAvailableAsync();
      if (!available) {
        isCheckingPermissions.current = false;
        return false;
      }
      const existing = await ExpoPedometer.getPermissionsAsync();
      if (existing.status === ExpoPedometer.PermissionStatus.GRANTED) {
        isCheckingPermissions.current = false;
        return true;
      }
      if (existing.canAskAgain) {
        const requested = await ExpoPedometer.requestPermissionsAsync();
        if (requested.status === ExpoPedometer.PermissionStatus.GRANTED) {
          isCheckingPermissions.current = false;
          return true;
        }
        const updated = await ExpoPedometer.getPermissionsAsync();
        if (!updated.canAskAgain) {
          isCheckingPermissions.current = false;
        }
      }
      Alert.alert(
        "Physical Activity Permission Required",
        "Required to track your steps.",
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

  const maybeShowBatteryPrompt = async () => {
    if (Platform.OS !== "android") return;
    const alreadyShown = await AsyncStorage.getItem(BATTERY_PROMPT_KEY);
    if (alreadyShown === "true") return;

    setTimeout(() => {
      Alert.alert(
        "Enable Background Tracking",
        "For the most accurate step tracking, please allow FitWisely to run in the background.",
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

  const fetchCloudMetrics = useCallback(async () => {
    if (!API_BASE) {
      setHasNetError(true);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${API_BASE}/steps/data?mode=walking`, {
        credentials: "include",
        signal: controller.signal,
      });

      if (response.status === 401) {
        handleSessionExpired();
        return;
      }

      if (!response.ok) {
        throw new Error(`Server status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "success") {
        const dbWalking = Math.max(0, Number(data.walking_steps) || 0);
        const dbTarget = Math.max(1, Number(data.target_steps) || 5000);

        setTargetSteps(dbTarget);

        await AsyncStorage.setItem(
          "@taskcare360_cached_target",
          String(dbTarget),
        );
        await updateNativeTarget(dbTarget);

        // Keep optimistic hardware updates if an older response arrives late.
        setWalkingSteps((previous) => Math.max(previous, dbWalking));
        setHasNetError(false);
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        console.log("[Steps] Cloud metrics fetch failed:", error);
        setHasNetError(true);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, [handleSessionExpired]);

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

      const data = await response.json();
      clearTimeout(timeoutId);

      if (data.status === "success") {
        setTargetSteps(parsedGoal);
        await AsyncStorage.setItem(
          "@taskcare360_cached_target",
          String(parsedGoal),
        );
        await updateNativeTarget(parsedGoal);
        setModalVisible(false);
      } else {
        Alert.alert("Error", data.error || "Failed to update target goal.");
      }
    } catch (error) {
      clearTimeout(timeoutId);
      Alert.alert(
        "Connection Error",
        "FitWisely needs a live network link to update your step target metrics.",
      );
    } finally {
      setUpdatingGoal(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const syncSteps = async () => {
        await recoverMissedSteps();
        if (isActive) {
          await fetchCloudMetrics();
        }
      };

      syncSteps();

      return () => {
        isActive = false;
      };
    }, [fetchCloudMetrics]),
  );

  useEffect(() => {
    let isMounted = true;
    let pollRunning = false;
    let syncRefreshTimer: ReturnType<typeof setTimeout> | null = null;

    void handlePermissionCheck();
    void maybeShowBatteryPrompt();

    const initializeSteps = async () => {
      try {
        await recoverMissedSteps();
        if (isMounted) {
          await fetchCloudMetrics();
        }
      } catch (error) {
        console.log("[Steps] Initial synchronization failed:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void initializeSteps();

    const syncListener = DeviceEventEmitter.addListener(
      "SYNC_COMPLETED",
      () => {
        // Let REALTIME_STEP_TAKEN update the optimistic count first. This
        // avoids a fast DB refresh followed by the same event being added again.
        if (syncRefreshTimer) {
          clearTimeout(syncRefreshTimer);
        }
        syncRefreshTimer = setTimeout(() => {
          if (isMounted) {
            void fetchCloudMetrics();
          }
        }, 250);
      },
    );

    const stepTakeListener = DeviceEventEmitter.addListener(
      "REALTIME_STEP_TAKEN",
      (event: { delta?: number }) => {
        const delta = Number(event?.delta) || 0;
        if (isMounted && delta > 0) {
          setWalkingSteps((previous) => previous + Math.floor(delta));
        }
      },
    );

    const pulseAnimation = Animated.loop(
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
    );
    pulseAnimation.start();

    const clockTimer = setInterval(() => {
      if (isMounted) {
        setCurrentTime(new Date());
      }
    }, 1000);

    // Read hardware and refresh cloud data at the configured 5-second cadence.
    const dataPollTimer = setInterval(async () => {
      if (pollRunning || !isMounted) return;

      pollRunning = true;
      try {
        const NetInfo = require("@react-native-community/netinfo").default;
        const netState = await NetInfo.fetch();

        if (netState.isConnected && netState.isInternetReachable !== false) {
          await recoverMissedSteps();
          if (isMounted) {
            await fetchCloudMetrics();
          }
        }
      } catch (error) {
        console.log("[Steps] Periodic synchronization failed:", error);
      } finally {
        pollRunning = false;
      }
    }, 5000);

    return () => {
      isMounted = false;
      syncListener.remove();
      stepTakeListener.remove();
      clearInterval(clockTimer);
      clearInterval(dataPollTimer);
      if (syncRefreshTimer) {
        clearTimeout(syncRefreshTimer);
        syncRefreshTimer = null;
      }
      pulseAnimation.stop();
    };
  }, [blinkAnim, fetchCloudMetrics]);

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
            Could not load the data.
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

  const activeDisplaySteps = walkingSteps;
  const distanceKm = (activeDisplaySteps * 0.000762).toFixed(2);
  const caloriesBurned = (activeDisplaySteps * 0.04).toFixed(1);

  const remainingSteps = Math.max(0, targetSteps - activeDisplaySteps);
  const progress = Math.min(activeDisplaySteps / targetSteps, 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }}>
      <LinearGradient colors={["#000000", "#111111"]} style={styles.container}>
        <View style={styles.pageHeaderBlock}>
          <Text style={styles.pageHeaderTitle}>Fitness Tracker</Text>
          <Text style={styles.pageHeaderSubtitle}>
            Track your daily movement accurately.
          </Text>
        </View>
        <View style={styles.header}>
          <View style={styles.liveBadge}>
            <Animated.View style={[styles.liveDot, { opacity: blinkAnim }]} />
            <Text style={styles.liveText}>WALKING MODE</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Background Settings",
                  "For accurate step tracking:\n\n1. Open Settings\n2. Find FitWisely 360\n3. Set Battery to 'Unrestricted'",
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
                second: "2-digit",
              })}
            </Text>
          </View>
        </View>

        <View style={styles.centeredContent}>
          <View style={styles.mainProgressArea}>
            <MaterialCommunityIcons name="walk" size={60} color="#4ecca3" />
            <Text style={styles.stepCount}>
              {activeDisplaySteps.toLocaleString()}
            </Text>
            <Text style={styles.stepLabel}>STEPS TODAY</Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progress * 100}%` },
                ]}
              />
              <Text style={styles.progressBarText}>
                {Math.round(progress * 100)}%
              </Text>
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
        </View>

        <View style={styles.buttonContainer}>
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
  container: { flex: 1, paddingHorizontal: 15, justifyContent: "center" },
  centeredContent: { flex: 0, justifyContent: "center", gap: 0 },
  pageHeaderBlock: { alignItems: "center", marginTop: 0, marginBottom: 10 },
  pageHeaderTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 8,
    letterSpacing: -0.5,
  },
  pageHeaderSubtitle: {
    fontSize: 13,
    color: "#a4b0be",
    marginTop: 4,
    fontWeight: "500",
  },
  header: {
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
  timeText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
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
    fontWeight: "300",
    color: "#ffffff",
    marginVertical: 4,
    letterSpacing: -1.5,
    textShadowColor: "rgba(78, 204, 163, 0.4)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  stepLabel: {
    color: "#4ecca3",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  progressBarBg: {
    height: 16,
    width: "100%",
    backgroundColor: "#ffffff15",
    borderRadius: 8,
    marginTop: 20,
    overflow: "hidden",
    justifyContent: "center",
    position: "relative",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#4ecca3",
    borderRadius: 8,
  },
  progressBarText: {
    position: "absolute",
    alignSelf: "center",
    color: "#000000",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
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
