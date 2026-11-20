// app/login.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import StepTracker from "react-native-step-tracker-pro";
import LoadingOverlay from "../components/LoadingOverlay";
import { useAuth } from "../context/AuthContext";
import { registerForPushNotifications } from "../utils/pushNotifications";
import { getNativeSyncToken, updateNativeTarget } from "../utils/stepTracker";

// 1. IMPORT THE CAPTCHA LIBRARY
import Recaptcha, { RecaptchaRef } from "react-native-recaptcha-that-works";

// 2. ADD YOUR NEW V2 SITE KEY HERE (Make sure it's the v2 Checkbox key, not Enterprise)
const RECAPTCHA_SITE_KEY = "6LeaXyouAAAAADrXvmLw58CSALnKXGnLrx7tezvv";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // 3. CREATE A REF FOR THE CAPTCHA
  const recaptchaRef = useRef<RecaptchaRef | null>(null);

  const router = useRouter();
  const params = useLocalSearchParams();
  const { checkSession } = useAuth();

  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

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

  // 4. THIS IS NOW JUST A TRIGGER TO OPEN THE CAPTCHA
  const handleLoginPress = () => {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    // Open the visible checkbox modal
    recaptchaRef.current?.open();
  };

  // 5. THIS RUNS AFTER THE USER CHECKS THE BOX
  const handleCaptchaVerify = async (captchaToken: string) => {
    recaptchaRef.current?.close();
    await performLogin(captchaToken);
  };

  // 6. THIS IS YOUR EXISTING LOGIN LOGIC, NOW ACCEPTING THE TOKEN
  const performLogin = async (captchaToken: string) => {
    setLoading(true);
    const startTime = Date.now();

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          captcha_token: captchaToken, // Pass the token to your Flask backend
        }),
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
          }
        } catch (e) {
          console.log("[login] ❌ Native token refresh failed:", e);
        }

        router.replace("/steps");
        registerPushTokenInBackground();
      } else {
        Alert.alert("Error", data.message || "Invalid email or password");
      }
    } catch (e) {
      Alert.alert("Connection Error", "Check your server connection.");
    } finally {
      const elapsedTime = Date.now() - startTime;
      const minDelay = 2000;
      const remainingTime = Math.max(0, minDelay - elapsedTime);
      setTimeout(() => setLoading(false), remainingTime);
    }
  };

  const registerPushTokenInBackground = () => {
    const tryRegister = async (attempt = 0) => {
      try {
        const token = await registerForPushNotifications();
        if (token) return;
      } catch (e) {}
      if (attempt < 3) setTimeout(() => tryRegister(attempt + 1), 1200);
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

        {/* 7. UPDATE THE ONPRESS HERE */}
        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={handleLoginPress}
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

      <LoadingOverlay visible={loading} />

      {/* 8. ADD THE CAPTCHA MODAL AT THE BOTTOM */}
      <Recaptcha
        ref={recaptchaRef}
        siteKey={RECAPTCHA_SITE_KEY}
        baseUrl="https://taskcare360.pythonanywhere.com" // Your production domain
        onVerify={handleCaptchaVerify}
        onExpire={() => Alert.alert("Captcha Expired", "Please try again.")}
        onError={() =>
          Alert.alert("Captcha Error", "Could not load the challenge.")
        }
        enterprise={false}
        hideBadge={false}
      />
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
  forgotlinkText: { color: "#fc2a2a", textAlign: "center", marginTop: 10 },
});
