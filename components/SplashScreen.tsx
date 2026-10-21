// components/SplashScreen.tsx
import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

export default function SplashScreen({ onFinish }: { onFinish?: () => void }) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
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
      {/* Spinning Border tightly wrapping the logo */}
      <Animated.View
        style={[styles.spinnerBorder, { transform: [{ rotate: spin }] }]}
      />

      {/* App Logo inside the spinner */}
      <View style={styles.logoContainer}>
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Loading Text */}
      <Text style={styles.loadingText}>Loading...</Text>
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
  spinnerBorder: {
    width: 120, // ✅ Match the logo container size + a little padding
    height: 120,
    borderRadius: 60,
    borderWidth: 5, // ✅ Thicker border
    borderColor: "#4ecca3",
    borderTopColor: "transparent",
    position: "absolute",
  },
  logoContainer: {
    width: 100, // ✅ Slightly smaller than the border
    height: 100,
    borderRadius: 50,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logo: {
    width: 90, 
    height: 90,
  },
  loadingText: {
    marginTop: 30,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    letterSpacing: 1,
  },
});