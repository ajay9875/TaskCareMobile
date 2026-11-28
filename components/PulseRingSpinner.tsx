import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type Props = {
  size?: number;
  ringColor?: string;
  dotColor?: string;
  ringCount?: number;
};

// ⬇️ Copy these values from your CSS (.sp-12__ring / .sp-12__dot keyframes)
const RING_DURATION = 1200; // animation-duration of the ring
const RING_STAGGER = 250; // animation-delay step between rings
const RING_BORDER = 2; // border width of .sp-12__ring
const RING_START_SCALE = 0.3; // scale at 0%
const RING_START_OPACITY = 0.8; // opacity at 0%
const DOT_RATIO = 0.25; // dot size relative to the spinner size

export default function PulseRingSpinner({
  size = 120,
  ringColor = "#00c8ff",
  dotColor = "#00c8ff",
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
          Animated.delay(index * RING_STAGGER),
          Animated.timing(ring, {
            toValue: 1,
            duration: RING_DURATION,
            easing: Easing.out(Easing.ease),
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
      outputRange: [RING_START_OPACITY, 0],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [RING_START_SCALE, 1],
        }),
      },
    ],
  });

  const dotScale = dot.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.15],
  });

  const dotSize = size * DOT_RATIO;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
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
              borderWidth: RING_BORDER,
            },
            ringStyle(ringValue),
          ]}
        />
      ))}

      <Animated.View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
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
});
