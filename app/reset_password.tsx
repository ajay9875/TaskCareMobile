// app/reset_password.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LoadingOverlay from "../components/LoadingOverlay"; // ← NEW
import { useTheme } from "../context/ThemeContext";

export default function ResetPassword() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [password, setPassword] = useState("");
  const [cpassword, setCpassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPVisible, setIsPVisible] = useState(false);
  const [isCPVisible, setIsCPVisible] = useState(false);

  const router = useRouter();
  const { email } = useLocalSearchParams();

  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

  const handleReset = async () => {
    if (!password || !cpassword) {
      return Alert.alert("Error", "Password fields cannot be empty.");
    }
    if (password !== cpassword) {
      return Alert.alert("Error", "Passwords do not match.");
    }

    setLoading(true);
    const startTime = Date.now(); // ⏱️ START TIMER

    try {
      const response = await fetch(`${API_BASE}/reset_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const result = await response.json();

      if (result.status === "success") {
        Alert.alert("Success", "Password reset successful.");
        router.replace("/login");
      } else {
        Alert.alert("Error", result.message);
      }
    } catch (error) {
      Alert.alert("Error", "Connection failed.");
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

  return (
    <>
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.pageHeaderBlock}>
          <MaterialCommunityIcons name="lock-open" size={40} color="#E74C3C" />
          <Text style={[styles.pageHeaderTitle, isDark && styles.textLight]}>
            New Password
          </Text>
          <Text style={[styles.pageHeaderSubtitle, isDark && styles.textMuted]}>
            Create a strong, secure password.
          </Text>
        </View>

        <View
          style={[
            styles.passwordContainer,
            isDark && styles.passwordContainerDark,
          ]}
        >
          <TextInput
            style={[styles.passwordInput, isDark && { color: "#fff" }]}
            placeholder="New Password"
            placeholderTextColor={isDark ? "#64748B" : "#666"}
            secureTextEntry={!isPVisible}
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setIsPVisible(!isPVisible)}
            disabled={loading}
          >
            <MaterialCommunityIcons
              name={isPVisible ? "eye-off" : "eye"}
              size={24}
              color={isDark ? "#94A3B8" : "#666"}
            />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.passwordContainer,
            isDark && styles.passwordContainerDark,
          ]}
        >
          <TextInput
            style={[styles.passwordInput, isDark && { color: "#fff" }]}
            placeholder="Confirm Password"
            placeholderTextColor={isDark ? "#64748B" : "#666"}
            secureTextEntry={!isCPVisible}
            value={cpassword}
            onChangeText={setCpassword}
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setIsCPVisible(!isCPVisible)}
            disabled={loading}
          >
            <MaterialCommunityIcons
              name={isCPVisible ? "eye-off" : "eye"}
              size={24}
              color={isDark ? "#94A3B8" : "#666"}
            />
          </TouchableOpacity>
        </View>

        {/* ✅ Button is now clean — no spinner inside */}
        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={handleReset}
          disabled={loading}
        >
          <Text style={styles.btnText}>Update Password</Text>
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
    padding: 25,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  containerDark: { backgroundColor: "#0F172A" },
  textLight: { color: "#fff" },
  textMuted: { color: "#94A3B8" },
  pageHeaderBlock: { alignItems: "center", marginBottom: 30 },
  pageHeaderTitle: {
    fontSize: 26,
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
    textAlign: "center",
  },
  button: {
    backgroundColor: "#E74C3C",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  disabledButton: { backgroundColor: "#c0392b", opacity: 0.85 },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: "#FFFFFF",
  },
  passwordContainerDark: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    color: "#000000",
  },
  eyeIcon: { padding: 10 },
});
