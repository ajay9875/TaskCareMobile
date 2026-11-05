import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type Props = {
  size?: number;
  ringColor?: string;
  dotColor?: string;
  ringCount?: number;
};

export default function PulseRingSpinner({
  size = 120,
  ringColor = "#0300a8", // ← Brand Logo Color for rings
  dotColor = "#00c8ff",  // ← Bright Cyan for the center dot
  ringCount = 4,
}: Props) {
  const rings = useRef(
    Array.from({ length: ringCount }, () => new Animated.Value(0)),
  ).current;
  const dot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ringAnimations = rings.map((ring, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 250),
          Animated.timing(ring, {
            toValue: 1,
            duration: 1200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ring, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    const dotAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(dot, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dot, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    ringAnimations.forEach((a) => a.start());
    dotAnimation.start();

    return () => {
      ringAnimations.forEach((a) => a.stop());
      dotAnimation.stop();
    };
  }, []);

  const ringStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 0], // Fade out
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.3, 1],
        }),
      },
    ],
  });

  const dotScale = dot.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.1],
  });

  const glowScale = dot.interpolate({
    inputRange: [0, 1],
    outputRange: [2.5, 3.0],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Glow halo */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 0.25,
            height: size * 0.25,
            borderRadius: (size * 0.25) / 2,
            backgroundColor: dotColor,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Rings */}
      {rings.map((ringValue, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: ringColor,
              borderWidth: 1.5,
            },
            ringStyle(ringValue),
          ]}
        />
      ))}

      {/* Center dot */}
      <Animated.View
        style={[
          styles.dot,
          {
            width: size * 0.25,
            height: size * 0.25,
            borderRadius: (size * 0.25) / 2,
            backgroundColor: dotColor,
            transform: [{ scale: dotScale }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: "center", alignItems: "center" },
  ring: { position: "absolute" },
  dot: { position: "absolute" },
  glow: { position: "absolute", opacity: 0.35 },
});