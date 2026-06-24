import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { NotificationBell } from '../../components/NotificationBell';
import { useAuthStore } from '../../store/auth';
import api from '../../lib/api';
import { formatPrice } from '../../lib/constants';

// Broker design language — locked palette. All values hardcoded so the broker
// surface stays light/airy regardless of theme changes elsewhere.
const BG       = '#F8FAFC';
const NAVY     = '#0A1F44';
const BLUE     = '#3D7BFF';
const TEXT     = '#0A1F44';
const MUTED    = '#64748B';
const SUBTLE   = '#94A3B8';
const CARD     = '#FFFFFF';
const BORDER   = '#E2E8F0';
const AMBER_BG = '#FFF7ED';
const AMBER_FG = '#C2791A';
const AMBER_BD = '#FED7AA';
const TEAL_BG  = '#ECFDF5';
const TEAL_FG  = '#047857';
const TEAL_BD  = '#A7F3D0';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function isUrgent(scheduledDate?: string | Date | null): boolean {
  if (!scheduledDate) return false;
  const d = new Date(scheduledDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d.getTime() <= today.getTime();
}

export default function BrokerDashboardScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const firstName = (user?.fullName || 'Broker').split(' ')[0];

  const [openLoads, setOpenLoads] = useState<any[]>([]);
  const [trucksAvailable, setTrucksAvailable] = useState<number>(0);
  const [inTransit, setInTransit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [loadsRes, trucksRes, inTransitRes] = await Promise.all([
        api.get('/loads').catch(() => ({ data: { loads: [] } })),
        api.get('/trucks?available=true').catch(() => ({ data: { trucks: [] } })),
        // STOPGAP: /bookings/broker/my doesn't exist yet (P3 backend follow-up).
        // Wired optimistically — the section will light up the moment the endpoint lands.
        api.get('/bookings/broker/my').catch(() => ({ data: { bookings: [] } })),
      ]);
      setOpenLoads(loadsRes.data?.loads || []);
      setTrucksAvailable((trucksRes.data?.trucks || []).length);
      const bookings = inTransitRes.data?.bookings || [];
      setInTransit(bookings.filter((b: any) => b.status === 'IN_TRANSIT'));
    } catch (e) {
      console.warn('Broker dashboard fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const summaryLine =
    openLoads.length === 0 && inTransit.length === 0
      ? 'No active dispatches today.'
      : `${openLoads.length} load${openLoads.length === 1 ? '' : 's'} need a truck · ${inTransit.length} in transit`;

  return (
    <ScreenWrapper backgroundColor={BG}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Command Center</Text>
          <NotificationBell navigation={navigation} />
        </View>

        {/* HERO — single navy element */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>{formatDate(new Date()).toUpperCase()}</Text>
          <Text style={styles.heroTitle}>{greeting()}, {firstName}.</Text>
          <Text style={styles.heroBody}>{summaryLine}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>OPEN LOADS</Text>
            {loading ? <SkeletonBar w={48} h={28} /> : <Text style={styles.statValue}>{openLoads.length}</Text>}
            <Text style={styles.statHint}>waiting for a truck</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TRUCKS AVAILABLE</Text>
            {loading ? <SkeletonBar w={48} h={28} /> : <Text style={styles.statValue}>{trucksAvailable}</Text>}
            <Text style={styles.statHint}>across the network</Text>
          </View>
        </View>

        {/* Needs a truck */}
        <SectionHeader title="Needs a truck" count={openLoads.length} />
        {loading ? (
          <CardSkeleton />
        ) : openLoads.length === 0 ? (
          <EmptyCard emoji="✓" title="All loads matched" body="Nothing waiting. New loads will appear here." />
        ) : (
          openLoads.map((load) => (
            <View key={load.id} style={styles.loadCard}>
              <View style={styles.loadHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.loadTitle} numberOfLines={1}>{load.title}</Text>
                  <Text style={styles.loadRoute}>{load.pickupCity} → {load.deliveryCity}</Text>
                </View>
                {isUrgent(load.scheduledDate) && (
                  <View style={styles.urgentBadge}>
                    <Text style={styles.urgentText}>URGENT</Text>
                  </View>
                )}
              </View>

              <View style={styles.loadMeta}>
                <MetaPill label={`${load.weightTons}t`} />
                <MetaPill label={(load.truckTypeNeeded || '').replace(/_/g, ' ') || 'Any truck'} />
                {load.scheduledDate && (
                  <MetaPill label={new Date(load.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                )}
              </View>

              <View style={styles.loadFooter}>
                <Text style={styles.loadPrice}>{formatPrice(load.offeredPrice, load.currency || 'ETB')}</Text>
                <TouchableOpacity
                  style={styles.findBtn}
                  onPress={() => navigation.navigate('FindTruck', { loadId: load.id })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.findBtnText}>Find a truck ↗</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* In transit */}
        <SectionHeader title="In transit" count={inTransit.length} />
        {loading ? (
          <CardSkeleton />
        ) : inTransit.length === 0 ? (
          <EmptyCard emoji="—" title="Nothing in transit" body="Dispatches you make will appear here while on the road." />
        ) : (
          inTransit.map((b: any) => (
            <View key={b.id} style={styles.transitCard}>
              <View style={styles.transitHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.loadTitle} numberOfLines={1}>{b.load?.title || 'Load'}</Text>
                  <Text style={styles.loadRoute}>
                    {b.load?.pickupCity} → {b.load?.deliveryCity}
                  </Text>
                </View>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>
              <View style={styles.transitRow}>
                <Text style={styles.transitLabel}>Driver</Text>
                <Text style={styles.transitValue}>
                  {b.driver?.fullName || b.truck?.driver?.fullName || 'Unassigned'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.trackBtn}
                onPress={() => navigation.navigate('Tracking', { bookingId: b.id })}
                activeOpacity={0.85}
              >
                <Text style={styles.trackBtnText}>Track shipment ↗</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

/* ── inline sub-components (light/airy design language) ───────────────── */

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count > 0 && <Text style={styles.sectionCount}>{count}</Text>}
    </View>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

function EmptyCard({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function CardSkeleton() {
  return (
    <View style={styles.skelCard}>
      <SkeletonBar w={'70%' as any} h={14} />
      <View style={{ height: 8 }} />
      <SkeletonBar w={'50%' as any} h={12} />
      <View style={{ height: 16 }} />
      <SkeletonBar w={'100%' as any} h={36} />
    </View>
  );
}

function SkeletonBar({ w, h }: { w: number | string; h: number }) {
  return <View style={{ width: w as any, height: h, backgroundColor: '#F1F5F9', borderRadius: 6 }} />;
}

/* ── styles ───────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  scroll:        { flex: 1, backgroundColor: BG },
  content:       { padding: 20, paddingBottom: 40 },

  /* top bar */
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  topBarTitle:   { fontSize: 18, fontWeight: '600', color: TEXT, letterSpacing: -0.3 },

  /* hero */
  hero:          { backgroundColor: NAVY, borderRadius: 16, padding: 24, marginBottom: 20 },
  heroEyebrow:   { fontSize: 11, fontWeight: '700', color: BLUE, letterSpacing: 1.5, marginBottom: 12 },
  heroTitle:     { fontSize: 26, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 8 },
  heroBody:      { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22 },

  /* stats */
  statsRow:      { flexDirection: 'row', gap: 12, marginBottom: 28 },
  statCard:      { flex: 1, backgroundColor: CARD, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: BORDER, shadowColor: NAVY, shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  statLabel:     { fontSize: 10, fontWeight: '700', color: SUBTLE, letterSpacing: 1.2, marginBottom: 10 },
  statValue:     { fontSize: 28, fontWeight: '700', color: TEXT, letterSpacing: -0.5, marginBottom: 4 },
  statHint:      { fontSize: 12, color: MUTED },

  /* sections */
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, marginTop: 8 },
  sectionTitle:  { fontSize: 16, fontWeight: '600', color: TEXT, letterSpacing: -0.2 },
  sectionCount:  { fontSize: 13, fontWeight: '600', color: MUTED },

  /* load card (needs-a-truck) */
  loadCard:      { backgroundColor: CARD, borderRadius: 14, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: BORDER, shadowColor: NAVY, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  loadHeader:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  loadTitle:     { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 3 },
  loadRoute:     { fontSize: 13, color: MUTED },
  urgentBadge:   { backgroundColor: AMBER_BG, borderColor: AMBER_BD, borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  urgentText:    { fontSize: 10, fontWeight: '700', color: AMBER_FG, letterSpacing: 1 },
  loadMeta:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  metaPill:      { backgroundColor: BG, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  metaPillText:  { fontSize: 11, color: MUTED, fontWeight: '500' },
  loadFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loadPrice:     { fontSize: 16, fontWeight: '700', color: TEXT, letterSpacing: -0.3 },
  findBtn:       { backgroundColor: BLUE, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  findBtnText:   { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  /* transit card */
  transitCard:   { backgroundColor: CARD, borderRadius: 14, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: BORDER, shadowColor: NAVY, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  transitHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  liveBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TEAL_BG, borderColor: TEAL_BD, borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  liveDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL_FG },
  liveText:      { fontSize: 10, fontWeight: '700', color: TEAL_FG, letterSpacing: 1 },
  transitRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER, marginBottom: 14 },
  transitLabel:  { fontSize: 12, color: SUBTLE, fontWeight: '500' },
  transitValue:  { fontSize: 13, color: TEXT, fontWeight: '500' },
  trackBtn:      { backgroundColor: BG, borderColor: BORDER, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  trackBtnText:  { color: NAVY, fontSize: 13, fontWeight: '600' },

  /* empty + skeleton */
  emptyCard:     { backgroundColor: CARD, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  emptyEmoji:    { fontSize: 32, marginBottom: 10, color: SUBTLE },
  emptyTitle:    { fontSize: 14, fontWeight: '600', color: TEXT, marginBottom: 4 },
  emptyBody:     { fontSize: 13, color: MUTED, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  skelCard:      { backgroundColor: CARD, borderRadius: 14, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
});
