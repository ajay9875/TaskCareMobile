import { useRouter } from "expo-router";
import React, { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons"; // Added Icons

import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false); // New state for password visibility toggle
  const router = useRouter();
const API_BASE = process.env.EXPO_PUBLIC_BASE_API; // Fallback to localhost for development

const handleSignup = async () => {
    // Basic validation before calling the API
    if (!name || !email || !password) {
      Alert.alert("Error", "All fields are required!");
      return;
    }

    try {
      // Corrected IP to match your current Flask server
      const response = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.status === 201 || data.status === "success") {
        Alert.alert("Success", "Account created successfully!", [
          { text: "Login Now", onPress: () => router.push("/login") }
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
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
            {/* ✅ ADD THIS PROFESSIONAL HEADER */}
      <View style={styles.pageHeaderBlock}>
        <MaterialCommunityIcons name="account-plus" size={40} color="#2ecc71" />
        <Text style={styles.pageHeaderTitle}>Create Account</Text>
        <Text style={styles.pageHeaderSubtitle}>Join TaskCare360 to organize your life.</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email Address"
        placeholderTextColor="#666"
        value={email}
        keyboardType="email-address"
        onChangeText={setEmail}
      />
{/* Password Container with Eye Button */}
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor="#666"
          secureTextEntry={!isPasswordVisible} // Toggles visibility
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

      <TouchableOpacity style={styles.button} onPress={handleSignup}>
        <Text style={styles.btnText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/login")}>
        <Text style={styles.linkText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#FFFFFF", // Forced White Background
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
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#2C3E50",           // ✅ FIXED: Changed from #FFFFFF to Dark Blue/Grey
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: "#FFFFFF", // Ensure box is white
    color: "#000000",           // ✅ FIXED: Forces typed text to be BLACK
  },
  button: {
    backgroundColor: "#2ecc71", // Nice "Success" Green
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  btnText: { 
    color: "#FFFFFF",           // White text on green button looks great
    textAlign: "center", 
    fontWeight: "bold" 
  },
  linkText: { 
    color: "#3498db", 
    textAlign: "center", 
    marginTop: 20 
  },
  // Added shared password styles
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: "#FFFFFF",
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    color: "#000000",
  },
  eyeIcon: {
    padding: 10,
  },
});