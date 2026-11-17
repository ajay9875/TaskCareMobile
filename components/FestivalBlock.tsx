import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

export default function FestivalBlock() {
  const [festival, setFestival] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!API_BASE) {
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/festival`)
      .then((res) => res.json())
      .then((data) => {
        if (data.active) {
          setFestival(data);
          setImageError(false);
        }
      })
      .catch((err) => console.log("Festival fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  if (!festival || !festival.gif_url || imageError) {
    return null;
  }

  return (
    <View style={styles.container}>
      {festival.name ? <Text style={styles.title}>{festival.name}</Text> : null}

      <View style={styles.row}>
        {/* Left Side: Image Container */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: festival.gif_url }}
            style={styles.gif}
            contentFit="contain"
            transition={500}
            onError={() => {
              console.log("❌ GIF failed to load, hiding festival block.");
              setImageError(true);
            }}
          />
        </View>

        {/* Right Side: Text Container */}
        {festival.message ? (
          <View style={styles.textContainer}>
            {/* 👇 UNIVERSAL DECORATIVE STICKERS */}
            <View style={styles.stickerTopRight}>
              <Text style={styles.stickerTextLarge}>✨</Text>
              <Text style={styles.stickerTextSmall}>🌟</Text>
            </View>

            <View style={styles.stickerBottomLeft}>
              <Text style={styles.stickerTextSmall}>✨</Text>
              <Text style={styles.stickerTextLarge}>🎉</Text>
            </View>
            {/* 👆 END STICKERS */}

            <Text style={styles.message}>{festival.message}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FED7AA",
    shadowColor: "#C2410C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#C2410C",
    marginBottom: 12,
    textAlign: "center",
    width: "100%",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    width: "100%",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 12,
  },
  imageContainer: {
    width: "45%",
    borderRadius: 12,
    overflow: "hidden",
  },
  gif: {
    width: "100%",
    aspectRatio: 0.75,
  },
  textContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    overflow: "hidden",
  },
  // 👇 UNIVERSAL STICKER STYLES
  stickerTopRight: {
    position: "absolute",
    top: 10,
    right: 10,
    opacity: 0.25,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  stickerBottomLeft: {
    position: "absolute",
    bottom: 10,
    left: 10,
    opacity: 0.25,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  stickerTextLarge: {
    fontSize: 24,
  },
  stickerTextSmall: {
    fontSize: 16,
    marginTop: 8, // Staggers the smaller emoji down slightly for a nice effect
  },
  message: {
    fontSize: 15,
    color: "#78350F",
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "600",
    zIndex: 1,
    // Add a tiny bit of padding so text doesn't overlap the stickers on very long messages
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
});
