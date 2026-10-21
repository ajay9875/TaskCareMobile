// components/SplashScreen.tsx
import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

export default function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000, // Slightly faster spin for a better loading feel
        useNativeDriver: true,
      }),
    ).start();

    const timer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 2000);

    return () => clearTimeout(timer);
  }, [spinValue, onFinish]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      {/* App Logo on Top */}
      <Image
        source={require("../assets/images/icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Spinner and Loading Text Inline Below */}
      <View style={styles.loadingRow}>
        <Animated.View
          style={[styles.spinner, { transform: [{ rotate: spin }] }]}
        />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20, // Space between logo and the spinner row
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12, // Space between the spinner and the text
  },
  spinner: {
    width: 24, // Smaller, standard spinner size
    height: 24,
    borderRadius: 12,
    borderWidth: 3, // Thinner border for the small spinner
    borderColor: "#4ecca3", // Your theme green
    borderTopColor: "transparent",
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    letterSpacing: 0.5,
  },
});
