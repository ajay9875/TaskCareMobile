// app/forgot-password.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

  const handleRequestOTP = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email.");
      return;
    }

    setLoading(true);
    const startTime = Date.now(); // ⏱️ START TIMER

    try {
      const response = await fetch(`${API_BASE}/forgot_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      const result = await response.json();

      if (result.status === "success") {
        router.push({
          pathname: "/verify_otp",
          params: { email: email.toLowerCase() },
        });
      } else {
        Alert.alert("Error", result.message || "Failed to send OTP");
      }
    } catch (error) {
      Alert.alert("Connection Error", "Check your internet connection.");
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
      <View style={styles.container}>
        <View style={styles.pageHeaderBlock}>
          <MaterialCommunityIcons name="lock-reset" size={40} color="#e74c3c" />
          <Text style={styles.pageHeaderTitle}>Reset Password</Text>
          <Text style={styles.pageHeaderSubtitle}>
            Enter your email to receive an OTP.
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />

        {/* ✅ Button is now clean — no spinner inside */}
        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={handleRequestOTP}
          disabled={loading}
        >
          <Text style={styles.btnText}>Send OTP</Text>
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
    backgroundColor: "#f9f9f9",
  },
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
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    elevation: 2,
    color: "#000",
    borderWidth: 1,
    borderColor: "#eee",
  },
  button: {
    backgroundColor: "#e74c3c",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  disabledButton: { backgroundColor: "#c0392b", opacity: 0.85 },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
