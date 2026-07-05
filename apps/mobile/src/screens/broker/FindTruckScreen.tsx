import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { formatPrice } from '../../lib/constants';
import { formatApiError } from '../../lib/errors';

// Broker design language — locked light/airy palette.
const BG       = '#F8FAFC';
const NAVY     = '#0A1F44';
const BLUE     = '#3D7BFF';
const TEXT     = '#0A1F44';
const MUTED    = '#64748B';
const SUBTLE   = '#94A3B8';
const CARD     = '#FFFFFF';
const BORDER   = '#E2E8F0';
const TEAL_BG  = '#ECFDF5';
const TEAL_FG  = '#047857';
const TEAL_BD  = '#A7F3D0';
const AMBER_BG = '#FFF7ED';
const AMBER_FG = '#C2791A';
const AMBER_BD = '#FED7AA';
const DISABLED_BG = '#F1F5F9';

type FilterKey = 'available' | 'nearPickup' | 'capacity';

export default function FindTruckScreen({ route, navigation }: any) {
  const loadId: string | undefined = route?.params?.loadId;

  const [load, setLoad] = useState<any>(null);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    available: true, nearPickup: true, capacity: true,
  });

  const fetchAll = useCallback(async () => {
    if (!loadId) { setLoading(false); return; }
    try {
      // Always pull the load fresh — it may have just been dispatched by someone else
      // (sender posted to multiple brokers, etc.).
      const loadRes = await api.get(`/loads/${loadId}`);
      const loadData = loadRes.data?.load || loadRes.data;
      setLoad(loadData);

      const params = new URLSearchParams();
      if (filters.available) params.set('available', 'true');
      else params.set('available', 'all');
      if (filters.nearPickup && loadData?.pickupCity) params.set('city', loadData.pickupCity);
      const qs = params.toString();
      const trucksRes = await api.get(`/trucks${qs ? '?' + qs : ''}`);
      setTrucks(trucksRes.data?.trucks || []);
    } catch (err: any) {
      console.warn(formatApiError(err, "We couldn't load available trucks.", 'truck'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadId, filters.available, filters.nearPickup]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchAll(); }, [fetchAll]);

  const toggleFilter = (k: FilterKey) => setFilters((p) => ({ ...p, [k]: !p[k] }));

  // Per-truck eligibility flags + a sort key. Eligibility = the truck *can*
  // legally carry this load (capacity, available). Sort key floats best matches first.
  const enriched = useMemo(() => {
    if (!load) return [];
    const requiredTons = Number(load.weightTons || 0);
    return trucks.map((t: any) => {
      const capOk = !filters.capacity || (Number(t.capacityTons) >= requiredTons);
      const availOk = t.isAvailable === true;
      const near = !!t.currentCity && !!load.pickupCity &&
        t.currentCity.toLowerCase() === load.pickupCity.toLowerCase();
      const hasDriver = !!t.driver?.fullName;
      const eligible = capOk && availOk;
      // Sort score: lower = better. Eligible first, then near pickup, then has driver.
      const score = (eligible ? 0 : 100) + (near ? 0 : 1) + (hasDriver ? 0 : 1);
      return { ...t, _capOk: capOk, _availOk: availOk, _near: near, _hasDriver: hasDriver, _eligible: eligible, _score: score };
    }).sort((a, b) => a._score - b._score);
  }, [trucks, load, filters.capacity]);

  const handleDispatch = (truck: any) => {
    if (!load) return;
    Alert.alert(
      'Dispatch this truck?',
      `${truck.plateNumber} will be assigned to ${load.title} (${load.pickupCity} to ${load.deliveryCity}). The cargo owner and truck owner will be notified and the load will be marked as booked.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dispatch this truck',
          onPress: async () => {
            setDispatchingId(truck.id);
            try {
              await api.post('/bookings', {
                loadId: load.id,
                truckId: truck.id,
                agreedPrice: load.offeredPrice,
                currency: load.currency || 'ETB',
              });
              // Broker dispatch auto-accepts → load is BOOKED. Send the broker
              // back to the previous screen (load board / dashboard) where
              // the load now reflects "in transit / assigned" status.
              Alert.alert(
                'Dispatched',
                `${truck.plateNumber} is now assigned to this load — the cargo owner and truck owner have been notified.`,
                [{ text: 'Back to loads', onPress: () => navigation.goBack() }],
              );
            } catch (err: any) {
              const status = err?.response?.status;
              const msg = formatApiError(err, "We couldn't dispatch this truck.", 'booking');
              // 400 + the load-status message → load is already taken. Bounce back.
              if (status === 400 && /no longer available/i.test(msg)) {
                Alert.alert('Load already dispatched', msg, [
                  { text: 'Back to loads', onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert("Couldn't dispatch", msg);
              }
            } finally {
              setDispatchingId(null);
            }
          },
        },
      ],
    );
  };

  /* ── render ─────────────────────────────────────────────────────── */

  return (
    <ScreenWrapper backgroundColor={BG}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          style={styles.backBtn}
        >
          <Feather name="chevron-left" size={18} color={BLUE} />
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.topBarTitle}>Find a truck</Text>
          <Text style={styles.topBarSub} numberOfLines={1}>Choose a verified truck to dispatch.</Text>
        </View>
        <View style={{ width: 72 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />}
      >
        {/* Load context strip */}
        {load && (
          <View style={styles.loadContext}>
            <Text style={styles.loadContextLabel}>FOR</Text>
            <Text style={styles.loadContextTitle} numberOfLines={1}>{load.title}</Text>
            <Text style={styles.loadContextMeta}>
              {load.weightTons}t · {load.pickupCity} to {load.deliveryCity}
              {load.scheduledDate ? ` · ${new Date(load.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
            </Text>
          </View>
        )}

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <Chip
            label="Available now"
            active={filters.available}
            onPress={() => toggleFilter('available')}
          />
          <Chip
            label={load?.pickupCity ? `Near ${load.pickupCity}` : 'Near pickup'}
            active={filters.nearPickup}
            onPress={() => toggleFilter('nearPickup')}
          />
          <Chip
            label={load?.weightTons ? `${load.weightTons}t+ capacity` : 'Capacity'}
            active={filters.capacity}
            onPress={() => toggleFilter('capacity')}
          />
        </ScrollView>

        {/* List */}
        {loading ? (
          <>
            <Text style={styles.loadingHint}>Finding available trucks…</Text>
            <CardSkeleton />
          </>
        ) : enriched.length === 0 ? (
          <EmptyCard
            iconName="truck"
            title="No trucks match this load right now"
            body="Try relaxing the availability or capacity filters."
          />
        ) : (
          enriched.map((t: any, i: number) => (
            <TruckCard
              key={t.id}
              truck={t}
              isFirstEligible={t._eligible && enriched.findIndex((x: any) => x._eligible) === i}
              dispatching={dispatchingId === t.id}
              anyDispatching={dispatchingId !== null}
              onDispatch={() => handleDispatch(t)}
            />
          ))
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

/* ── sub-components ─────────────────────────────────────────────────── */

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TruckCard({
  truck, isFirstEligible, dispatching, anyDispatching, onDispatch,
}: {
  truck: any; isFirstEligible: boolean; dispatching: boolean; anyDispatching: boolean; onDispatch: () => void;
}) {
  const eligible = truck._eligible;
  const reason = !truck._availOk ? 'Truck is currently unavailable'
    : !truck._capOk ? `Capacity too low (${truck.capacityTons}t)`
    : null;

  return (
    <View style={[styles.truckCard, !eligible && styles.truckCardDisabled]}>
      {isFirstEligible && (
        <View style={styles.bestBadge}>
          <Text style={styles.bestBadgeText}>BEST MATCH</Text>
        </View>
      )}

      <View style={styles.truckHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.truckTitleRow}>
            <Text style={[styles.truckTitle, !eligible && styles.dimmed]} numberOfLines={1}>
              {(truck.truckType || '').replace(/_/g, ' ') || 'Truck'} · {truck.capacityTons}t
            </Text>
            {truck.isVerified && (
              <View style={styles.verifiedPill}>
                <Feather name="check-circle" size={10} color={TEAL_FG} style={{ marginRight: 3 }} />
                <Text style={styles.verifiedText}>VERIFIED</Text>
              </View>
            )}
          </View>
          <Text style={[styles.truckPlate, !eligible && styles.dimmed]}>{truck.plateNumber}</Text>
        </View>
      </View>

      <View style={styles.truckRow}>
        <Text style={styles.truckRowLabel}>Location</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {truck._near && (
            <View style={styles.nearPill}>
              <Text style={styles.nearPillText}>NEAR</Text>
            </View>
          )}
          <Text style={[styles.truckRowValue, !eligible && styles.dimmed]}>
            {truck.currentCity}{truck.currentCountry ? `, ${truck.currentCountry}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.truckRow}>
        <Text style={styles.truckRowLabel}>Driver</Text>
        <Text style={[styles.truckRowValue, !eligible && styles.dimmed]}>
          {truck.driver?.fullName
            ? `${truck.driver.fullName}${truck.driver.licenseNumber ? ` · #${truck.driver.licenseNumber}` : ''}`
            : 'No driver attached'}
        </Text>
      </View>

      <View style={styles.truckRow}>
        <Text style={styles.truckRowLabel}>Owner</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[styles.truckRowValue, !eligible && styles.dimmed]}>
            {truck.owner?.fullName || '—'}
          </Text>
          {truck.owner?.isVerified && (
            <Feather name="check-circle" size={12} color={TEAL_FG} />
          )}
        </View>
      </View>

      {!eligible && reason && (
        <View style={styles.reasonRow}>
          <Text style={styles.reasonText}>{reason}</Text>
        </View>
      )}

      {eligible ? (
        <TouchableOpacity
          style={[
            isFirstEligible ? styles.dispatchBtnPrimary : styles.dispatchBtnSecondary,
            anyDispatching && !dispatching && { opacity: 0.5 },
          ]}
          onPress={onDispatch}
          disabled={anyDispatching}
          activeOpacity={0.85}
        >
          {dispatching ? (
            <>
              <ActivityIndicator color={isFirstEligible ? '#FFFFFF' : NAVY} size="small" style={{ marginRight: 8 }} />
              <Text style={isFirstEligible ? styles.dispatchBtnPrimaryText : styles.dispatchBtnSecondaryText}>
                Dispatching…
              </Text>
            </>
          ) : (
            <>
              <Text style={isFirstEligible ? styles.dispatchBtnPrimaryText : styles.dispatchBtnSecondaryText}>
                Dispatch this truck
              </Text>
              <Feather
                name="arrow-up-right"
                size={14}
                color={isFirstEligible ? '#FFFFFF' : NAVY}
                style={{ marginLeft: 6 }}
              />
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.dispatchBtnDisabled}>
          <Text style={styles.dispatchBtnDisabledText}>Unavailable for this load</Text>
        </View>
      )}
    </View>
  );
}

function EmptyCard({ iconName, title, body }: { iconName: any; title: string; body: string }) {
  return (
    <View style={styles.emptyCard}>
      <Feather name={iconName} size={40} color={SUBTLE} style={{ marginBottom: 14 }} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function CardSkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <View key={i} style={styles.skelCard}>
          <SkelBar w={'60%' as any} h={16} />
          <View style={{ height: 8 }} />
          <SkelBar w={'40%' as any} h={12} />
          <View style={{ height: 16 }} />
          <SkelBar w={'100%' as any} h={36} />
        </View>
      ))}
    </>
  );
}
function SkelBar({ w, h }: { w: number | string; h: number }) {
  return <View style={{ width: w as any, height: h, backgroundColor: '#F1F5F9', borderRadius: 6 }} />;
}

/* ── styles ─────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  /* top bar */
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: BORDER },
  backBtn:       { flexDirection: 'row', alignItems: 'center', width: 72 },
  back:          { fontSize: 15, color: BLUE, fontWeight: '600', marginLeft: 2 },
  topBarTitle:   { fontSize: 16, fontWeight: '600', color: TEXT },
  topBarSub:     { fontSize: 11, color: MUTED, marginTop: 1 },
  loadingHint:   { fontSize: 12, color: MUTED, marginBottom: 12, fontWeight: '500' },

  content:       { padding: 20, paddingBottom: 40 },

  /* load context strip */
  loadContext:        { backgroundColor: CARD, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  loadContextLabel:   { fontSize: 10, fontWeight: '700', color: SUBTLE, letterSpacing: 1.2, marginBottom: 6 },
  loadContextTitle:   { fontSize: 16, fontWeight: '600', color: TEXT, marginBottom: 4 },
  loadContextMeta:    { fontSize: 13, color: MUTED },

  /* chips row */
  chipsRow:      { flexDirection: 'row', gap: 8, paddingBottom: 16, paddingRight: 4 },
  chip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD },
  chipActive:    { backgroundColor: NAVY, borderColor: NAVY },
  chipText:      { fontSize: 12, color: MUTED, fontWeight: '500' },
  chipTextActive:{ color: '#FFFFFF', fontWeight: '600' },

  /* truck card */
  truckCard:     { backgroundColor: CARD, borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: BORDER, shadowColor: NAVY, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  truckCardDisabled: { backgroundColor: DISABLED_BG, opacity: 0.85, shadowOpacity: 0 },
  dimmed:        { color: SUBTLE },

  bestBadge:     { alignSelf: 'flex-start', backgroundColor: TEAL_BG, borderColor: TEAL_BD, borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10 },
  bestBadgeText: { fontSize: 10, fontWeight: '700', color: TEAL_FG, letterSpacing: 1 },

  truckHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  truckTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 },
  truckTitle:    { fontSize: 15, fontWeight: '600', color: TEXT, textTransform: 'capitalize' },
  truckPlate:    { fontSize: 13, color: MUTED, fontFamily: 'monospace' },
  verifiedPill:  { flexDirection: 'row', alignItems: 'center', backgroundColor: TEAL_BG, borderColor: TEAL_BD, borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  verifiedText:  { fontSize: 9, fontWeight: '700', color: TEAL_FG, letterSpacing: 1 },

  truckRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: BORDER },
  truckRowLabel: { fontSize: 11, color: SUBTLE, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8 },
  truckRowValue: { fontSize: 13, color: TEXT, fontWeight: '500', maxWidth: '65%', textAlign: 'right' },
  nearPill:      { backgroundColor: AMBER_BG, borderColor: AMBER_BD, borderWidth: 1, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 },
  nearPillText:  { fontSize: 9, fontWeight: '700', color: AMBER_FG, letterSpacing: 0.8 },

  reasonRow:     { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER },
  reasonText:    { fontSize: 12, color: AMBER_FG, fontWeight: '500' },

  /* dispatch buttons */
  dispatchBtnPrimary:     { flexDirection: 'row', marginTop: 14, backgroundColor: BLUE, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  dispatchBtnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  dispatchBtnSecondary:   { flexDirection: 'row', marginTop: 14, backgroundColor: BG, borderColor: BORDER, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  dispatchBtnSecondaryText: { color: NAVY, fontSize: 14, fontWeight: '600' },
  dispatchBtnDisabled:    { marginTop: 14, backgroundColor: 'transparent', borderColor: BORDER, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  dispatchBtnDisabledText:{ color: SUBTLE, fontSize: 13, fontWeight: '500' },

  /* empty + skeleton */
  emptyCard:     { backgroundColor: CARD, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  emptyEmoji:    { fontSize: 40, marginBottom: 14 },
  emptyTitle:    { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 6, textAlign: 'center' },
  emptyBody:     { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  skelCard:      { backgroundColor: CARD, borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: BORDER },
});
