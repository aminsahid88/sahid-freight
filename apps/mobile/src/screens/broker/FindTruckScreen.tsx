import React from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';

// Broker design language — see BrokerDashboardScreen header for the full rationale.
const BG     = '#F8FAFC';
const NAVY   = '#0A1F44';
const BLUE   = '#3D7BFF';
const TEXT   = '#0A1F44';
const MUTED  = '#64748B';
const CARD   = '#FFFFFF';
const BORDER = '#E2E8F0';

export default function FindTruckScreen({ route, navigation }: any) {
  const loadId = route?.params?.loadId;

  return (
    <ScreenWrapper backgroundColor={BG}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Find a Truck</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🎯</Text>
          <Text style={styles.emptyTitle}>Match a truck to this load</Text>
          <Text style={styles.emptyBody}>
            {loadId
              ? `Trucks that fit load ${String(loadId).slice(0, 8)}… will appear here, pre-filtered by truck type, capacity, and route.`
              : 'Trucks that fit the load will appear here, pre-filtered by truck type, capacity, and route.'}
          </Text>
          <Text style={styles.emptyMeta}>Coming next in P3c.</Text>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: BORDER },
  back:          { fontSize: 15, color: BLUE, fontWeight: '600', minWidth: 60 },
  topBarTitle:   { fontSize: 16, fontWeight: '600', color: TEXT },

  content:       { padding: 20, paddingBottom: 40 },
  emptyCard:     { backgroundColor: CARD, borderRadius: 16, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: BORDER, shadowColor: NAVY, shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  emptyEmoji:    { fontSize: 44, marginBottom: 16 },
  emptyTitle:    { fontSize: 16, fontWeight: '600', color: TEXT, marginBottom: 8, textAlign: 'center' },
  emptyBody:     { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  emptyMeta:     { fontSize: 12, color: MUTED, marginTop: 16, fontStyle: 'italic' },
});
