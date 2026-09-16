import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Dimensions, TouchableOpacity } from "react-native";
import CircularProgress from 'react-native-circular-progress-indicator';
import { useRouter } from "expo-router";
import { LinearGradient } from 'expo-linear-gradient'; 
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [target, setTarget] = useState(5000);
  const [loading, setLoading] = useState(true);
  const [hasNetError, setHasNetError] = useState(false);

  const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
  const router = useRouter();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const dataRes = await fetch(`${API_BASE}/steps/data`, { 
        credentials: 'include', 
        signal: controller.signal 
      });
      
      if (dataRes.status === 401) {
        clearTimeout(timeoutId);
        return router.replace("/login");
      }
      if (!dataRes.ok) throw new Error("Target endpoint error");

      const targetContentType = dataRes.headers.get("content-type");
      if (!targetContentType || !targetContentType.includes("application/json")) {
        throw new Error("Invalid format received");
      }
      const dataJson = await dataRes.json();
      if (dataJson.status === "success") setTarget(dataJson.target_steps);

      const res = await fetch(`${API_BASE}/steps/performance`, { 
        credentials: 'include', 
        signal: controller.signal 
      });
      
      if (res.status === 401) {
        clearTimeout(timeoutId);
        return router.replace("/login");
      }
      if (!res.ok) throw new Error("Performance endpoint error");

      const perfContentType = res.headers.get("content-type");
      if (!perfContentType || !perfContentType.includes("application/json")) {
        throw new Error("Invalid performance format");
      }

      const json = await res.json();
      if (json.status === "success") {
        // Only keep entries that exist from DB (prevents injecting false 0-value filler days)
        const activeHistory = (json.history || []).filter(item => item && item.date);
        setHistory(activeHistory.reverse()); 
        setHasNetError(false);
      }
      
      clearTimeout(timeoutId);

    } catch (e) {
      clearTimeout(timeoutId);
      console.log("Fetch history parsing failed:", e);
      setHistory(prev => prev);
      setHasNetError(true);
    } finally {
      setLoading(false);
    }
  };

  // --- Calculate 30-Day Totals Dynamic Summary ---
  const aggregateTotals = history.reduce((acc, item) => {
    const wSteps = item.walking_steps !== undefined ? item.walking_steps : item.steps || 0;
    const tSteps = item.treadmill_steps !== undefined ? item.treadmill_steps : 0;
    
    acc.walkSteps += wSteps;
    acc.treadSteps += tSteps;
    return acc;
  }, { walkSteps: 0, treadSteps: 0 });

  const totalWalkKm = (aggregateTotals.walkSteps * 0.000762).toFixed(2);
  const totalWalkCal = (aggregateTotals.walkSteps * 0.04).toFixed(0);

  const totalTreadKm = (aggregateTotals.treadSteps * 0.000762).toFixed(2);
  const totalTreadCal = (aggregateTotals.treadSteps * 0.0575).toFixed(0);

  const totalCombinedSteps = aggregateTotals.walkSteps + aggregateTotals.treadSteps;
  const totalCombinedKm = (totalCombinedSteps * 0.000762).toFixed(2);
  const totalCombinedCal = (parseInt(totalWalkCal) + parseInt(totalTreadCal)).toString();

// Header Block Component
const renderHeaderSummary = () => {
  if (history.length === 0) return null;

  return (
    <View style={styles.summaryCard}>
      {/* Title Row with Icon */}
      <View style={styles.summaryTitleRow}>
        <View style={styles.summaryIconWrapper}>
          <MaterialCommunityIcons name="trophy-outline" size={20} color="#4ecca3" />
        </View>
        <View style={styles.summaryTitleTextContainer}>
          <Text style={styles.summaryTitleText}>
            {history.length === 1 ? "TODAY'S SUMMARY" : `${history.length}-DAY OVERALL PERFORMANCE`}
          </Text>
          <Text style={styles.summaryTitleSubtext}>Your Complete Fitness Journey</Text>
        </View>
      </View>

      {/* Walk vs Treadmill Quick Columns */}
      <View style={styles.summarySplitRow}>
        {/* Walking Column */}
        <View style={styles.summaryColumn}>
          <View style={styles.summaryColHeader}>
            <MaterialCommunityIcons name="walk" size={14} color="#4ecca3" />
            <Text style={styles.summaryColLabel}>WALKING</Text>
          </View>
          <Text style={styles.summaryColVal}>
            {aggregateTotals.walkSteps.toLocaleString()} <Text style={styles.unitText}>STEPS</Text>
          </Text>
          <Text style={styles.summarySubVal}>
            {totalWalkKm} KM • {totalWalkCal} CAL
          </Text>
        </View>

        {/* Treadmill Column */}
        <View style={[styles.summaryColumn, styles.summaryColumnDivider]}>
          <View style={styles.summaryColHeader}>
            <MaterialCommunityIcons name="run-fast" size={14} color="#ff6b35" />
            <Text style={[styles.summaryColLabel, { color: '#ff6b35' }]}>TREADMILL</Text>
          </View>
          <Text style={styles.summaryColVal}>
            {aggregateTotals.treadSteps.toLocaleString()} <Text style={styles.unitText}>STEPS</Text>
          </Text>
          <Text style={styles.summarySubVal}>
            {totalTreadKm} KM • {totalTreadCal} CAL
          </Text>
        </View>
      </View>

      {/* Total Aggregate Strip */}
      <View style={styles.summaryTotalStrip}>
        <View style={styles.stripMetric}>
          <MaterialCommunityIcons name="shoe-print" size={16} color="#ffffff" />
          <Text style={styles.stripLabel}>TOTAL STEPS</Text>
          <Text style={styles.stripVal}>{totalCombinedSteps.toLocaleString()}</Text>
        </View>

        <View style={styles.stripMetricDivider} />

        <View style={styles.stripMetric}>
          <MaterialCommunityIcons name="map-marker-distance" size={16} color="#ffffff" />
          <Text style={styles.stripLabel}>DISTANCE</Text>
          <Text style={styles.stripVal}>{totalCombinedKm} <Text style={styles.unitText}>KM</Text></Text>
        </View>

        <View style={styles.stripMetricDivider} />

        <View style={styles.stripMetric}>
          <MaterialCommunityIcons name="fire" size={16} color="#ff6b35" />
          <Text style={styles.stripLabel}>ENERGY</Text>
          <Text style={[styles.stripVal, { color: '#ff6b35' }]}>{totalCombinedCal} <Text style={styles.unitText}>CAL</Text></Text>
        </View>
      </View>
    </View>
  );
};

  const renderEmptyHistory = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No History Yet</Text>
      <Text style={styles.emptySubtitle}>
        Your performance history will appear here once you start syncing your steps to the cloud.
      </Text>
    </View>
  );

  const renderDayBlock = ({ item }) => {
    const dayTarget = item.target_steps || target || 5000;

    const walkSteps = item.walking_steps !== undefined ? item.walking_steps : item.steps || 0;
    const treadSteps = item.treadmill_steps !== undefined ? item.treadmill_steps : 0;

    const walkKm = (walkSteps * 0.000762).toFixed(2);
    const walkCal = (walkSteps * 0.04).toFixed(0);

    const treadKm = (treadSteps * 0.000762).toFixed(2);
    const treadCal = (treadSteps * 0.0575).toFixed(0);

    const combinedSteps = walkSteps + treadSteps;
    const combinedKm = (combinedSteps * 0.000762).toFixed(2);
    const combinedCal = (parseInt(walkCal) + parseInt(treadCal)).toString();
    const stepsLeft = Math.max(0, dayTarget - combinedSteps);
    const percentage = Math.min(100, (combinedSteps / dayTarget) * 100);
    
    return (
      <View style={styles.card}>
        <Text style={styles.dateText}>{item.date}</Text>

        <View style={styles.modeSplitRow}>
          {/* Walking Column */}
          <View style={styles.modeColumn}>
            <View style={styles.columnHeadingRow}>
              <MaterialCommunityIcons name="walk" size={18} color="#4ecca3" />
              <Text style={styles.columnHeading}>WALKING</Text>
            </View>
            <View style={styles.modeStatBlock}>
              <Text style={styles.modeStatVal}>{walkSteps.toLocaleString()}</Text>
              <Text style={styles.modeStatLabel}>STEPS</Text>
              <Text style={styles.modeStatVal}>{walkKm} <Text style={styles.unitText}>KM</Text></Text>
              <Text style={styles.modeStatLabel}>DISTANCE</Text>
              <Text style={[styles.modeStatVal, { color: '#ff6b35' }]}>{walkCal} <Text style={styles.unitText}>CAL</Text></Text>
              <Text style={styles.modeStatLabel}>ENERGY</Text>
            </View>
          </View>

          {/* Treadmill Column */}
          <View style={[styles.modeColumn, { borderLeftWidth: 1, borderColor: '#ffffff15', paddingLeft: 15 }]} >
            <View style={styles.columnHeadingRow}>
              <MaterialCommunityIcons name="run-fast" size={18} color="#4ecca3" />
              <Text style={styles.columnHeading}>TREADMILL</Text>
            </View>
            <View style={styles.modeStatBlock}>
              <Text style={styles.modeStatVal}>{treadSteps.toLocaleString()}</Text>
              <Text style={styles.modeStatLabel}>STEPS</Text>
              <Text style={styles.modeStatVal}>{treadKm} <Text style={styles.unitText}>KM</Text></Text>
              <Text style={styles.modeStatLabel}>DISTANCE</Text>
              <Text style={[styles.modeStatVal, { color: '#ff6b35' }]}>{treadCal} <Text style={styles.unitText}>CAL</Text></Text>
              <Text style={styles.modeStatLabel}>ENERGY</Text>
            </View>
          </View>
        </View>

        {/* Combined Performance Summary Row */}
        <View style={styles.combinedDivider} />
        <Text style={styles.combinedHeading}>COMBINED PERFORMANCE</Text>

        <View style={styles.combinedContent}>
          <View style={styles.combinedMetrics}>
            <View style={styles.stepMetricItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4ecca3" />
              <View style={styles.textDataContainer}>
                <Text style={styles.stepText}>{combinedSteps.toLocaleString()}</Text>
                <Text style={styles.stepMetricLabel}>TOTAL STEPS</Text>
              </View>
            </View>

            <View style={[styles.stepMetricItem, { marginTop: 12 }]}>
              <Ionicons name="flag" size={20} color={stepsLeft === 0 ? "#4ecca3" : "#a4b0be"} />
              <View style={styles.textDataContainer}>
                <Text style={[styles.stepText, stepsLeft === 0 && { color: '#4ecca3' }]}>
                  {stepsLeft.toLocaleString()}
                </Text>
                <Text style={styles.stepMetricLabel}>STEPS REMAINING</Text>
              </View>
            </View>

            <View style={[styles.stepMetricItem, { marginTop: 12 }]}>
              <Ionicons name="trending-up" size={20} color="#4ecca3" />
              <View style={styles.textDataContainer}>
                <Text style={styles.stepText}>{dayTarget.toLocaleString()}</Text>
                <Text style={styles.stepMetricLabel}>DAILY GOAL</Text>
              </View>
            </View>
          </View>

          {/* Right Progress Ring */}
          <View style={styles.imageRingContainer}>
            <CircularProgress
              value={percentage}
              radius={42}
              duration={1000}
              progressValueColor={'#ffffff'}
              activeStrokeColor={'#4ecca3'}
              inActiveStrokeColor={'#ffffff15'}
              inActiveStrokeOpacity={1}
              inActiveStrokeWidth={6}
              activeStrokeWidth={6}
              title={`${percentage.toFixed(0)}%`}          
              titleStyle={{ fontSize: 16, fontWeight: '800', color: '#ffffff' }}
              showProgressValue={false}
            />

            <View style={styles.imageSeparatorLine} />

            <View style={styles.imageMetricsArea}>
              <View style={styles.imageMetricBadgeRow}>
                <Ionicons name="location" size={18} color="#4ecca3" style={{ marginRight: 4 }} />
                <Text style={styles.imageStatText}>{combinedKm} <Text style={styles.imageLabelText}>KM</Text></Text>
              </View>

              <View style={[styles.imageMetricBadgeRow, { marginTop: 6 }]}>
                <MaterialCommunityIcons name="fire" size={18} color="#ff6b35" style={{ marginRight: 4 }} />
                <Text style={[styles.imageStatText, { color: '#ff6b35' }]}>{combinedCal} <Text style={styles.imageLabelText}>CAL</Text></Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: '#1a1a2e' }]}>
        <ActivityIndicator size="large" color="#4ecca3" />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.container}>
    <Text style={styles.headerTitle}>📊 Your Fitness Overview</Text>

      {hasNetError ? (
        <View style={{ flex: 0.8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
          <MaterialCommunityIcons name="wifi-strength-alert-outline" size={70} color="#ff6b35" style={{ marginBottom: 16 }} />
          <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>Could Not Load History</Text>
          <Text style={{ color: '#a4b0be', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
            TaskCare360 needs a live network link to load your historical performance data. Please check your internet connection or restart the app.         
          </Text>
          <TouchableOpacity 
            style={{ borderColor: '#4ecca3', borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            onPress={() => {
              setLoading(true);
              fetchHistory();
            }}
          >
            <MaterialCommunityIcons name="refresh" size={18} color="#4ecca3" />
            <Text style={{ color: '#4ecca3', fontWeight: '700', fontSize: 14 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.date}
          renderItem={renderDayBlock}
          ListHeaderComponent={renderHeaderSummary}
          ListEmptyComponent={renderEmptyHistory}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 25, backgroundColor: '#0f0f0f' },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    textAlign: 'center', 
    marginBottom: 16, 
    color: '#ffffff', 
    letterSpacing: 0.5,
    textShadowColor: 'rgba(78, 204, 163, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  listPadding: { paddingHorizontal: 16, paddingBottom: 30, flexGrow: 1 },

  /* 30-Day Overall Summary Block */
  summaryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#4ecca340',
    elevation: 5,
    shadowColor: '#4ecca3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  
  /* Summary Title */
  summaryTitleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4ecca320',
  },
  summaryIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#4ecca315',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  summaryTitleTextContainer: { flex: 1 },
  summaryTitleText: { 
    color: '#4ecca3', 
    fontSize: 16, 
    fontWeight: '800', 
    letterSpacing: 1,
  },
  summaryTitleSubtext: { 
    color: '#a4b0be', 
    fontSize: 11, 
    marginTop: 2, 
    fontWeight: '500',
  },

  /* Walk vs Treadmill Split */
  summarySplitRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 16 
  },
  summaryColumn: { 
    flex: 1, 
    paddingRight: 10 
  },
  summaryColumnDivider: { 
    borderLeftWidth: 1, 
    borderLeftColor: '#4ecca320', 
    paddingLeft: 14 
  },
  summaryColHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 5, 
    marginBottom: 4 
  },
  summaryColLabel: { 
    color: '#4ecca3', 
    fontSize: 10, 
    fontWeight: '800', 
    letterSpacing: 1 
  },
  summaryColVal: { 
    color: '#ffffff', 
    fontSize: 18, 
    fontWeight: '800', 
    marginTop: 4,
    letterSpacing: 0.5,
  },
  summarySubVal: { 
    color: '#a4b0be', 
    fontSize: 11, 
    marginTop: 4,
    fontWeight: '500',
  },

  /* Total Strip */
  summaryTotalStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#00000040',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ffffff10',
  },
  stripMetric: { 
    alignItems: 'center', 
    flex: 1,
    gap: 2,
  },
  stripMetricDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#ffffff15',
  },
  stripLabel: { 
    color: '#a4b0be', 
    fontSize: 9, 
    fontWeight: '800', 
    letterSpacing: 0.8,
    marginTop: 4,
  },
  stripVal: { 
    color: '#ffffff', 
    fontSize: 16, 
    fontWeight: '800', 
    marginTop: 4,
  },

  /* Daily Card Styles - KEEP UNTOUCHED */
  card: {
    backgroundColor: '#ffffff09',
    padding: 18,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#ffffff15'
  },
  dateText: { fontSize: 17, color: '#ffffff', fontWeight: '800', marginBottom: 16, letterSpacing: 0.3 },
  
  modeSplitRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  modeColumn: { flex: 1, paddingRight: 5 },
  columnHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  columnHeading: { color: '#4ecca3', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  modeStatBlock: { backgroundColor: '#ffffff04', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#ffffff08' },
  modeStatVal: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  modeStatLabel: { color: '#a4b0be', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  unitText: { fontSize: 11, color: '#a4b0be', fontWeight: '500' },

  combinedDivider: { height: 1.5, backgroundColor: '#ffffff15', marginVertical: 16 },
  combinedHeading: { color: '#4ecca3', fontSize: 13, fontWeight: '800', letterSpacing: 1.2, marginBottom: 14, textAlign: 'left' },
  combinedContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  combinedMetrics: { flex: 1.1, paddingRight: 5 },
  
  stepMetricItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textDataContainer: { flexDirection: 'column' },
  stepText: { fontSize: 20, fontWeight: '800', color: '#ffffff', lineHeight: 24 },
  stepMetricLabel: { color: '#a4b0be', fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginTop: 2 },
  
  imageRingContainer: {
    flex: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 10
  },
  imageSeparatorLine: {
    width: '85%',
    height: 1,
    backgroundColor: '#ffffff15',
    marginVertical: 14
  },
  imageMetricsArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  imageMetricBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  imageStatText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700'
  },
  imageLabelText: {
    color: '#a4b0be',
    fontSize: 14,
    fontWeight: '600'
  },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 10 },
  emptySubtitle: { fontSize: 15, color: '#a4b0be', textAlign: 'center', lineHeight: 22 }
});