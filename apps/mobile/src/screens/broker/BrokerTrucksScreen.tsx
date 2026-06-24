import React from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { NotificationBell } from '../../components/NotificationBell';

// Broker design language — see BrokerDashboardScreen header for the full rationale.
const BG     = '#F8FAFC';
const NAVY   = '#0A1F44';
const TEXT   = '#0A1F44';
const MUTED  = '#64748B';
const CARD   = '#FFFFFF';
const BORDER = '#E2E8F0';

export default function BrokerTrucksScreen({ navigation }: any) {
  return (
    <ScreenWrapper backgroundColor={BG}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.topBarTitle}>Truck Marketplace</Text>
            <Text style={styles.topBarSub}>Every available truck across owners</Text>
          </View>
          <NotificationBell navigation={navigation} />
        </View>

        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🚛</Text>
          <Text style={styles.emptyTitle}>The truck marketplace lives here</Text>
          <Text style={styles.emptyBody}>
            Live availability, owner, and the attached driver for every truck in the network. Coming next in P3d.
          </Text>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll:        { flex: 1, backgroundColor: BG },
  content:       { padding: 20, paddingBottom: 40 },

  topBar:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  topBarTitle:   { fontSize: 22, fontWeight: '700', color: TEXT, letterSpacing: -0.4 },
  topBarSub:     { fontSize: 13, color: MUTED, marginTop: 4, maxWidth: 280 },

  emptyCard:     { backgroundColor: CARD, borderRadius: 16, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: BORDER, shadowColor: NAVY, shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  emptyEmoji:    { fontSize: 44, marginBottom: 16 },
  emptyTitle:    { fontSize: 16, fontWeight: '600', color: TEXT, marginBottom: 8, textAlign: 'center' },
  emptyBody:     { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
});
