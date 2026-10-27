// components/AuthDialog.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React from "react";

import {
    Alert,
    Linking,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type AuthDialogProps = {
  visible: boolean;
  onClose: () => void;
};

export default function AuthDialog({ visible, onClose }: AuthDialogProps) {
  const router = useRouter();

  const handleSupport = async () => {
    const email = "taskcare360@gmail.com";
    const mailUrl = `mailto:${email}?subject=${encodeURIComponent("Support Request")}&body=${encodeURIComponent("Hello Support Team,")}`;
    try {
      await Linking.openURL(mailUrl);
      onClose();
    } catch (error) {
      Alert.alert(
        "Support Unavailable",
        "No email client found. Copy our support email?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Copy Email",
            onPress: async () => {
              await Clipboard.setStringAsync(email);
              Alert.alert("Success", "Email address copied to clipboard!");
              onClose();
            },
          },
        ],
      );
    }
  };

  const navigateTo = (path: string) => {
    onClose();
    router.push(path as any);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.dialogBox}>
          <Text style={styles.dialogTitle}>Welcome to TaskCare360</Text>
          <Text style={styles.dialogSub}>
            Sign in to sync your steps and tasks.
          </Text>

          <TouchableOpacity
            style={styles.dialogPrimaryBtn}
            onPress={() => navigateTo("/signup")}
          >
            <Ionicons name="person-add-outline" size={20} color="#fff" />
            <Text style={styles.btnText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dialogSecondaryBtn}
            onPress={() => navigateTo("/login")}
          >
            <Ionicons name="log-in-outline" size={20} color="#fff" />
            <Text style={styles.btnText}>Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dialogLinkBtn}
            onPress={() => navigateTo("/forgot-password")}
          >
            <Ionicons name="key-outline" size={18} color="#e74c3c" />
            <Text style={styles.dialogLinkText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dialogLinkBtn}
            onPress={handleSupport}
          >
            <Ionicons name="help-circle-outline" size={18} color="#3498db" />
            <Text style={[styles.dialogLinkText, { color: "#3498db" }]}>
              Contact Support
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialogBox: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 24, // Keep horizontal padding
    paddingVertical: 40, // ✅ Increased vertical padding for a taller, professional look
    alignItems: "center",
  },
  dialogTitle: {
    fontSize: 22, // Slightly bigger title
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10, // Slightly more space below title
    textAlign: "center",
  },
  dialogSub: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 32, // More space before the buttons start
    textAlign: "center",
  },
  dialogPrimaryBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2ecc71",
    padding: 16, // Slightly thicker buttons
    borderRadius: 12,
    gap: 8,
    marginBottom: 14, // More space between buttons
  },
  dialogSecondaryBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3498db",
    padding: 16, // Slightly thicker buttons
    borderRadius: 12,
    gap: 8,
    marginBottom: 14, // More space between buttons
  },
  dialogLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  dialogLinkText: { fontSize: 14, fontWeight: "600", color: "#e74c3c" },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 }, // Slightly bigger text
});
