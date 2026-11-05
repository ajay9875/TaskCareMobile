import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, StyleSheet, Text, View } from "react-native";
import PulseRingSpinner from "./PulseRingSpinner";

type Props = {
  visible: boolean;
};

// 20 Professional texts with similar meaning
const LOADING_TEXTS = [
  "Processing...",
  "Securing your request...",
  "Just a moment...",
  "Preparing your workspace...",
  "Syncing data safely...",
  "Connecting to servers...",
  "Optimizing your experience...",
  "Verifying details...",
  "Almost there...",
  "Wrapping things up...",
  "Finalizing the process...",
  "Handling securely...",
  "Retrieving information...",
  "Setting things up...",
  "Executing request...",
  "Communicating with server...",
  "Loading your data...",
  "Please bear with us...",
  "Working in the background...",
  "Completing tasks..."
];

export default function LoadingOverlay({ visible }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [currentText, setCurrentText] = useState("Processing...");

  // 1. Pick a random text whenever the overlay becomes visible
  useEffect(() => {
    if (visible) {
      const randomIndex = Math.floor(Math.random() * LOADING_TEXTS.length);
      setCurrentText(LOADING_TEXTS[randomIndex]);
    }
  }, [visible]);

  // 2. Fade in/out animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}} // Blocks Android back button
    >
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        {/* The Spinner matches the image (floating on dark background) */}
        <PulseRingSpinner size={140} />

        {/* The randomly selected text */}
        <Text style={styles.professionalText}>{currentText}</Text>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#0a1428", // Exact dark navy from the image
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  professionalText: {
    color: "#E2E8F0", // Very light gray/blue for premium look
    fontSize: 16,
    fontWeight: "600",
    marginTop: 40, // Distance below the spinner
    letterSpacing: 0.5, // Slight spacing for professional feel
    textAlign: "center",
  },
});