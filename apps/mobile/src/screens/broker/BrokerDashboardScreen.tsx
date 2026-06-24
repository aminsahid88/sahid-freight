import React from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { NotificationBell } from '../../components/NotificationBell';

// Broker design language (P3a foundation — real content lands in P3b):
//   bg light neutral, cards white with subtle border + soft shadow,
//   navy (#0A1F44) reserved for text + ONE hero per screen,
//   blue (#3D7BFF) only on primary action buttons.

const BG       = '#F8FAFC';
const NAVY     = '#0A1F44';
const TEXT     = '#0A1F44';
const MUTED    = '#64748B';
const SUBTLE   = '#94A3B8';
const CARD     = '#FFFFFF';
const BORDER   = '#E2E8F0';

export default function BrokerDashboardScreen({ navigation }: any) {
  return (
    <ScreenWrapper backgroundColor={BG}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top bar: title + bell. No fill — sits on the light background. */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Command Center</Text>
          <NotificationBell navigation={navigation} />
        </View>

        {/* HERO — the single navy element on this screen. */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>BROKER</Text>
          <Text style={styles.heroTitle}>Good day.</Text>
          <Text style={styles.heroBody}>
            Your dispatch board, pending loads, and live trips will live here.
          </Text>
        </View>

        {/* Placeholder card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>COMING NEXT</Text>
          <Text style={styles.cardTitle}>P3b — Dashboard content</Text>
          <Text style={styles.cardBody}>
            Live trips · pending dispatches awaiting a truck · today's matched volume · quick actions.
          </Text>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll:        { flex: 1, backgroundColor: BG },
  content:       { padding: 20, paddingBottom: 40 },

  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  topBarTitle:   { fontSize: 18, fontWeight: '600', color: TEXT, letterSpacing: -0.3 },

  hero:          { backgroundColor: NAVY, borderRadius: 16, padding: 24, marginBottom: 20 },
  heroEyebrow:   { fontSize: 11, fontWeight: '700', color: '#3D7BFF', letterSpacing: 1.5, marginBottom: 12 },
  heroTitle:     { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 8 },
  heroBody:      { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 22, maxWidth: 320 },

  card:          { backgroundColor: CARD, borderRadius: 14, padding: 22, borderWidth: 1, borderColor: BORDER, shadowColor: NAVY, shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  cardLabel:     { fontSize: 11, fontWeight: '700', color: SUBTLE, letterSpacing: 1.2, marginBottom: 8 },
  cardTitle:     { fontSize: 16, fontWeight: '600', color: TEXT, marginBottom: 8 },
  cardBody:      { fontSize: 14, color: MUTED, lineHeight: 22 },
});
