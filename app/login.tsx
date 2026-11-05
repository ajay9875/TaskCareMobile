// app/login.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
// app/login.tsx — top of file
import { useEffect, useRef, useState } from "react";   // ← add useRef
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import StepTracker from "react-native-step-tracker-pro";
import LoadingOverlay from "../components/LoadingOverlay"; // ← NEW
import { useAuth } from "../context/AuthContext";
import { registerForPushNotifications } from "../utils/pushNotifications";
import { getNativeSyncToken, updateNativeTarget } from "../utils/stepTracker";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { checkSession } = useAuth();

  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

// app/login.tsx — replace the existing useEffect with this expanded version

// app/login.tsx — inside the component, before the useEffect
const shownFlags = useRef<{ expired?: boolean; loggedOut?: boolean }>({});

useEffect(() => {
  if (params.sessionExpired === "true" && !shownFlags.current.expired) {
    shownFlags.current.expired = true;
    Alert.alert(
      "Access Denied",
      "Authentication Required. Please sign in to access this section.",
      [{ text: "OK", onPress: () => router.setParams({}) }],
      { cancelable: false },
    );
    return;
  }

  if (params.loggedOut === "true" && !shownFlags.current.loggedOut) {
    shownFlags.current.loggedOut = true;
    Alert.alert(
      "Logged Out",
      "You logged out successfully.",
      [{ text: "OK", onPress: () => router.setParams({}) }],
      { cancelable: false },
    );
  }
}, [params.sessionExpired, params.loggedOut]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    setLoading(true);
    const startTime = Date.now(); // ⏱️ START TIMER

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
        const cachedTarget = await AsyncStorage.getItem(
          "@taskcare360_cached_target",
        );
        if (cachedTarget) {
          await updateNativeTarget(parseInt(cachedTarget, 10));
        }

        await checkSession();

        try {
          const freshToken = await getNativeSyncToken();
          if (freshToken) {
            await StepTracker.updateConfig({
              remoteSyncHeaders: { Authorization: `Bearer ${freshToken}` },
            });
            await StepTracker.syncNow();
            console.log("[login] ✅ Native sync token refreshed");
          } else {
            console.log(
              "[login] ⚠️ getNativeSyncToken returned null — session not yet active",
            );
          }
        } catch (e) {
          console.log("[login] ❌ Native token refresh failed:", e);
        }

        router.replace("/dashboard");
        registerPushTokenInBackground();
      } else {
        Alert.alert("Error", data.message || "Invalid email or password");
      }
    } catch (e) {
      Alert.alert("Connection Error", "Check your server connection.");
    } finally {
      // ⏱️ ENFORCE 2-SECOND MINIMUM DELAY
      const elapsedTime = Date.now() - startTime;
      const minDelay = 2000;
      const remainingTime = Math.max(0, minDelay - elapsedTime);

      setTimeout(() => {
        setLoading(false);
      }, remainingTime);
    }
  };

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
    setTimeout(() => tryRegister(0), 600);
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.pageHeaderBlock}>
          <MaterialCommunityIcons
            name="shield-account"
            size={40}
            color="#3498db"
          />
          <Text style={styles.pageHeaderTitle}>Welcome Back</Text>
          <Text style={styles.pageHeaderSubtitle}>
            Sign in to continue your progress.
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          editable={!loading}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#666"
            secureTextEntry={!isPasswordVisible}
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            disabled={loading}
          >
            <MaterialCommunityIcons
              name={isPasswordVisible ? "eye-off" : "eye"}
              size={24}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        {/* ✅ Button is now clean — no spinner inside */}
        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>Login</Text>
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

      {/* ✅ Overlay handles its own text internally */}
      <LoadingOverlay visible={loading} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#faf3f3",
  },
  pageHeaderBlock: { alignItems: "center", marginBottom: 30 },
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
  linkText: { color: "#3498db", textAlign: "center", marginTop: 20 },
  forgotlinkText: {
    color: "#fc2a2a",
    textAlign: "center",
    marginTop: 10,
  },
});
