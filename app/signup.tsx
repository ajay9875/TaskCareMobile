// app/signup.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LoadingOverlay from "../components/LoadingOverlay";
import { useTheme } from "../context/ThemeContext";

export default function Signup() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cemail, setCemail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

  const handleSignup = async () => {
    if (isSubmitting) return;

    // ─── Client-side validation ─────────────────────────────
    if (!name.trim() || !email.trim() || !cemail.trim() || !password) {
      Alert.alert("Error", "All fields are required!");
      return;
    }
    if (name.trim().length < 2) {
      Alert.alert("Error", "Name must be at least 2 characters long.");
      return;
    }
    if (email.trim().toLowerCase() !== cemail.trim().toLowerCase()) {
      Alert.alert("Error", "Email addresses do not match.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters long.");
      return;
    }

    // ─── Send to backend ───────────────────────────────────
    setIsSubmitting(true);
    const startTime = Date.now(); // ⏱️ START TIMER

    try {
      const response = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          cemail: cemail.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (response.status === 201 || data.status === "success") {
        Alert.alert("Success", "Account created successfully!", [
          { text: "Login Now", onPress: () => router.push("/login") },
        ]);
      } else {
        Alert.alert("Signup Failed", data.message || "Something went wrong");
      }
    } catch (e) {
      console.error(e);
      Alert.alert(
        "Connection Error",
        "Please check your internet connection and try again.",
      );
    } finally {
      // ⏱️ ENFORCE 2-SECOND MINIMUM DELAY
      const elapsedTime = Date.now() - startTime;
      const minDelay = 2000;
      const remainingTime = Math.max(0, minDelay - elapsedTime);

      setTimeout(() => {
        setIsSubmitting(false);
      }, remainingTime);
    }
  };

  const phColor = isDark ? "#64748B" : "#666";

  return (
    <>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          isDark && styles.containerDark,
        ]}
        style={isDark ? { backgroundColor: "#0F172A" } : undefined}
      >
        <View style={styles.pageHeaderBlock}>
          <MaterialCommunityIcons
            name="account-plus"
            size={40}
            color={isDark ? "#818CF8" : "#0300a8"}
          />
          <Text style={[styles.pageHeaderTitle, isDark && styles.textLight]}>
            Create Account
          </Text>
          <Text style={[styles.pageHeaderSubtitle, isDark && styles.textMuted]}>
            Join FitWisely to organize your life.
          </Text>
        </View>

        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="Full Name"
          placeholderTextColor={phColor}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          editable={!isSubmitting}
        />

        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="Email Address"
          placeholderTextColor={phColor}
          value={email}
          keyboardType="email-address"
          autoCapitalize="none"
          onChangeText={setEmail}
          editable={!isSubmitting}
        />

        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="Confirm Email"
          placeholderTextColor={phColor}
          value={cemail}
          keyboardType="email-address"
          autoCapitalize="none"
          onChangeText={setCemail}
          editable={!isSubmitting}
        />

        <View
          style={[
            styles.passwordContainer,
            isDark && styles.passwordContainerDark,
          ]}
        >
          <TextInput
            style={[styles.passwordInput, isDark && { color: "#fff" }]}
            placeholder="Password"
            placeholderTextColor={phColor}
            secureTextEntry={!isPasswordVisible}
            value={password}
            onChangeText={setPassword}
            editable={!isSubmitting}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            disabled={isSubmitting}
          >
            <MaterialCommunityIcons
              name={isPasswordVisible ? "eye-off" : "eye"}
              size={24}
              color={isDark ? "#94A3B8" : "#666"}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/login")}
          disabled={isSubmitting}
        >
          <Text style={styles.linkText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ✅ Overlay handles its own text internally */}
      <LoadingOverlay visible={isSubmitting} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  containerDark: { backgroundColor: "#0F172A" },
  textLight: { color: "#fff" },
  textMuted: { color: "#94A3B8" },
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
    backgroundColor: "#FFFFFF",
    color: "#000000",
  },
  inputDark: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    color: "#fff",
  },
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
  passwordInput: { flex: 1, padding: 12, color: "#000000" },
  eyeIcon: { padding: 10 },
  button: {
    backgroundColor: "#0300a8",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonDisabled: { backgroundColor: "#020075", opacity: 0.9 },
  btnText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  linkText: { color: "#3498db", textAlign: "center", marginTop: 20 },
});
