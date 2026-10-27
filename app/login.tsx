import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext"; // ✅ Add this
import { registerForPushNotifications } from "../utils/pushNotifications";
// Add these right below the other imports at the top of login.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateNativeTarget } from "../utils/stepTracker";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { checkSession } = useAuth(); // ✅ Add this

  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

  useEffect(() => {
    if (params.sessionExpired === "true") {
      Alert.alert(
        "Session Expired",
        "Session expired or Logged out successfully. Please login again.",
        [
          {
            text: "OK",
            onPress: () => {
              router.setParams({});
            },
          },
        ],
        { cancelable: false },
      );
    }
  }, [params.sessionExpired]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.status === "success") {
        // ✅ ADD THIS: Tell the notification to update the target right after login
        const cachedTarget = await AsyncStorage.getItem(
          "@taskcare360_cached_target",
        );
        if (cachedTarget) {
          await updateNativeTarget(parseInt(cachedTarget, 10));
        }

        // ✅ ADD THIS: Force the global header to update instantly!
        await checkSession();

        // ✅ 1. Navigate IMMEDIATELY — user shouldn't wait for push registration
        router.replace("/dashboard");

        // ✅ 2. Register push in background (non-blocking)
        registerPushTokenInBackground();
      } else {
        Alert.alert("Error", data.message || "Invalid email or password");
      }
    } catch (e) {
      Alert.alert("Connection Error", "Check your server connection.");
    } finally {
      setLoading(false);
    }
  };

  // Fire-and-forget: runs after navigation, retries up to 4 times
  const registerPushTokenInBackground = () => {
    const tryRegister = async (attempt = 0) => {
      try {
        const token = await registerForPushNotifications();

        if (token) {
          console.log("[login] ✅ push token registered on attempt", attempt);
          return;
        }
      } catch (e) {
        console.log(
          "[login] push registration error (attempt " + attempt + "):",
          e,
        );
      }

      if (attempt < 3) {
        console.log("[login] Retrying push registration...", attempt + 1);
        setTimeout(() => tryRegister(attempt + 1), 1200);
      } else {
        console.log(
          "[login] push registration failed after retries (non-fatal)",
        );
      }
    };

    // Small delay to let the session cookie land before registration
    setTimeout(() => tryRegister(0), 600);
  };

  return (
    <View style={styles.container}>

      {/* ✅ ADD THIS PROFESSIONAL HEADER */}
      <View style={styles.pageHeaderBlock}>
        <MaterialCommunityIcons name="shield-account" size={40} color="#3498db" />
        <Text style={styles.pageHeaderTitle}>Welcome Back</Text>
        <Text style={styles.pageHeaderSubtitle}>Sign in to continue your progress.</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#666"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor="#666"
          secureTextEntry={!isPasswordVisible}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          style={styles.eyeIcon}
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
        >
          <MaterialCommunityIcons
            name={isPasswordVisible ? "eye-off" : "eye"}
            size={24}
            color="#666"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.disabledButton]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.btnText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/signup")}
        disabled={loading}
      >
        <Text style={styles.linkText}>New here? Sign Up</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push("/forgot-password")}
        disabled={loading}
      >
        <Text style={styles.forgotlinkText}>Forgot Password? Reset now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#faf3f3",
  },
    pageHeaderBlock: {
    alignItems: "center",
    marginBottom: 30,
  },
  pageHeaderTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2C3E50",
    marginTop: 10,
    letterSpacing: -0.5,
  },
  pageHeaderSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "500",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#2C3E50",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    color: "#000",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 15,
  },
  passwordInput: { flex: 1, padding: 12, color: "#000" },
  eyeIcon: { padding: 10 },
  button: {
    backgroundColor: "#3498db",
    padding: 15,
    borderRadius: 8,
    height: 55,
    justifyContent: "center",
  },
  disabledButton: { backgroundColor: "#95a5a6" },
  btnText: { color: "white", textAlign: "center", fontWeight: "bold" },
  linkText: {
    color: "#3498db",
    textAlign: "center",
    marginTop: 20,
  },
  forgotlinkText: {
    color: "#fc2a2a",
    textAlign: "center",
    marginTop: 10,
  },
});
