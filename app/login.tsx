import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { registerForPushNotifications } from '../utils/pushNotifications';

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();

  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

  useEffect(() => {
    if (params.sessionExpired === 'true') {
      Alert.alert(
        'Session Expired',
        'Session expired or Logged out successfully. Please login again.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.setParams({});
            },
          },
        ],
        { cancelable: false }
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
        "Accept": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.status === "success") {
      // ✅ Login successful.
      // Register push notification before navigating to dashboard.
      const tryRegister = async (attempt = 0) => {
        try {
          const token = await registerForPushNotifications();

          if (token) {
            console.log(
              "[login] push token registered on attempt",
              attempt
            );

            // ✅ Push token successfully registered
            // Now navigate to dashboard.
            router.replace("/dashboard");
            return;
          }
        } catch (e) {
          console.log(
            "[login] push registration error (attempt " + attempt + "):",
            e
          );
        }

        // ✅ Retry up to 4 total attempts
        if (attempt < 3) {
          console.log(
            "[login] Retrying push registration...",
            attempt + 1
          );

          setTimeout(() => {
            tryRegister(attempt + 1);
          }, 800);
        } else {
          // ✅ Don't keep the user stuck on login forever.
          // Navigate even if push registration failed.
          console.log(
            "[login] Push registration failed after retries"
          );

          router.replace("/dashboard");
        }
      };

      // ✅ Start push registration
      tryRegister();

    } else {
      Alert.alert(
        "Error",
        data.message || "Invalid email or password"
      );
    }
  } catch (e) {
    Alert.alert(
      "Connection Error",
      "Check your server connection."
    );
  } finally {
    setLoading(false);
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back!</Text>

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

      <TouchableOpacity onPress={() => router.push("/signup")} disabled={loading}>
        <Text style={styles.linkText}>New here? Sign Up</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/forgot-password")} disabled={loading}>
        <Text style={styles.forgotlinkText}>Forgot Password? Reset now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", backgroundColor: "#faf3f3" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20, textAlign: "center", color: "#2C3E50" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 8, marginBottom: 15, color: "#000" },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: "#ccc", borderRadius: 8, marginBottom: 15 },
  passwordInput: { flex: 1, padding: 12, color: "#000" },
  eyeIcon: { padding: 10 },
  button: {
    backgroundColor: "#3498db",
    padding: 15,
    borderRadius: 8,
    height: 55,
    justifyContent: 'center'
  },
  disabledButton: { backgroundColor: "#95a5a6" },
  btnText: { color: "white", textAlign: "center", fontWeight: "bold" },
  linkText: {
    color: "#3498db",
    textAlign: "center",
    marginTop: 20
  },
  forgotlinkText: {
    color: "#fc2a2a",
    textAlign: "center",
    marginTop: 10
  },
});