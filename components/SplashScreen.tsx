// components/SplashScreen.tsx
import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

export default function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
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
      {/* App Logo */}
      <Image
        source={require("../assets/images/icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Loading Row */}
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
    width: 80,
    height: 80,
    marginBottom: 2, // ✅ Added margin to match the gap in the native image
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  spinner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#4ecca3",
    borderTopColor: "transparent",
  },
  loadingText: {
    fontSize: 16, // ✅ Increased from 14 to 16 to match the native text size
    fontWeight: "bold",
    color: "#6b7280", // ✅ Changed to a lighter grey to match the native image
    letterSpacing: 0.5,
  },
});
