import React from "react";
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  SafeAreaView 
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function AboutScreen() {
  const router = useRouter();

  // Reusable Component for Core Values
  const ValueCard = ({ icon, title, desc }: { icon: any, title: string, desc: string }) => (
    <View style={styles.valueCard}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={28} color="#3498db" />
      </View>
      <View style={styles.valueTextContent}>
        <Text style={styles.valueTitle}>{title}</Text>
        <Text style={styles.valueDesc}>{desc}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>About TaskCare360</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Brand Section - Tightened to prevent stray string errors */}
        <View style={styles.heroSection}>
          <View style={styles.logoPlaceholder}>
            <Ionicons name="checkmark-done-circle" size={80} color="#0300a8" />
          </View>
          <Text style={styles.appName}>TaskCare360</Text>
          <Text style={styles.version}>Version 1.0.2</Text>
        </View>

        {/* Mission Statement */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>OUR MISSION</Text>
          <Text style={styles.missionText}>
            We believe that productivity shouldn't be stressful. TaskCare360 was 
            built to help individuals reclaim their time through simple, 
            intelligent task management and consistent daily reminders.
          </Text>
        </View>

        {/* Core Values */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WHY WE'RE DIFFERENT</Text>
          <ValueCard 
            icon="shield-checkmark-outline" 
            title="Privacy First" 
            desc="Your tasks are your business. We use secure encryption to ensure your data stays private."
          />
          <ValueCard 
            icon="notifications-outline" 
            title="Smart Reminders" 
            desc="Our backend system calculates the best time to nudge you so you never miss a deadline."
          />
          <ValueCard 
            icon="phone-portrait-outline" 
            title="Seamless Experience" 
            desc="Designed specifically for mobile users who need to manage life on the go."
          />
        </View>

        {/* Footer Info */}
        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>Made with ❤️ for Productive People</Text>
          <Text style={styles.copyright}>© 2026 TaskCare360 Team</Text>
        </View>
      </ScrollView>
    
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#333" },
  backButton: { padding: 5 },
  scrollContent: { paddingBottom: 40 },
  heroSection: { alignItems: "center", paddingVertical: 40, backgroundColor: "#fcfcfc" },
  logoPlaceholder: { marginBottom: 15 },
  appName: { fontSize: 28, fontWeight: "bold", color: "#2c3e50" },
  version: { color: "#95a5a6", fontSize: 14, marginTop: 5 },
  section: { paddingHorizontal: 25, marginTop: 30 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#3498db",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  missionText: { fontSize: 16, lineHeight: 24, color: "#555", textAlign: "left" },
  valueCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#ebf5fb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  valueTextContent: { flex: 1 },
  valueTitle: { fontSize: 16, fontWeight: "bold", color: "#333", marginBottom: 2 },
  valueDesc: { fontSize: 13, color: "#7f8c8d", lineHeight: 18 },
  footerInfo: { marginTop: 50, alignItems: "center" },
  footerText: { color: "#7f8c8d", fontSize: 14 },
  copyright: { color: "#bdc3c7", fontSize: 12, marginTop: 5 },
});