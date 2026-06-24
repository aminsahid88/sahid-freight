import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, RefreshControl, Linking, Platform, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import ScreenWrapper from '../../components/ScreenWrapper';
import { NotificationBell } from '../../components/NotificationBell';
import { useAuthStore } from '../../store/auth';
import api from '../../lib/api';
import { formatApiError } from '../../lib/errors';

// Light/airy palette — locked, matches the broker surface for consistency
// across both roles (low cognitive load when drivers + brokers coordinate).
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
const DANGER   = '#DC2626';
const DANGER_BG = '#FEF2F2';

export default function DriverActiveScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const firstName = (user?.fullName || 'Driver').split(' ')[0];

  // ── core state ──────────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(false);            // driver's manual availability toggle
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);                 // mid-start / mid-deliver lockout

  const locationWatcher = useRef<Location.LocationSubscription | null>(null);
  const lastPushRef = useRef<number>(0);

  // The driver does ONE job at a time. IN_TRANSIT wins; else first ACCEPTED.
  const primary =
    bookings.find((b: any) => b.status === 'IN_TRANSIT') ||
    bookings.find((b: any) => b.status === 'ACCEPTED') ||
    null;

  // ── fetches ─────────────────────────────────────────────────────────
  const fetchBookings = useCallback(async () => {
    try {
      const res = await api.get('/bookings/driver/my');
      const all = res.data?.bookings || res.data || [];
      const active = all.filter((b: any) => b.status === 'ACCEPTED' || b.status === 'IN_TRANSIT');
      setBookings(active);
    } catch (e) {
      console.warn('Driver fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // ── online toggle (the driver's ONE primary action) ─────────────────
  const goOnline = async () => {
    if (locationAllowed) {
      setIsOnline(true);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationAllowed(true);
      setIsOnline(true);
    } else {
      Alert.alert(
        'Location permission needed',
        'To go online and share your trip with the cargo sender, allow location access in your phone settings.',
        [{ text: 'OK' }],
      );
    }
  };

  const goOffline = () => {
    if (primary?.status === 'IN_TRANSIT') {
      Alert.alert(
        'You have a trip in progress',
        'Going offline will stop sharing your location with the sender. Continue?',
        [
          { text: 'Stay online', style: 'cancel' },
          { text: 'Go offline', style: 'destructive', onPress: () => setIsOnline(false) },
        ],
      );
      return;
    }
    setIsOnline(false);
  };

  const toggleOnline = () => (isOnline ? goOffline() : goOnline());

  // ── location watcher: only runs when ONLINE + permission + IN_TRANSIT ──
  useEffect(() => {
    const shouldWatch = isOnline && locationAllowed && primary?.status === 'IN_TRANSIT';
    if (!shouldWatch) {
      locationWatcher.current?.remove();
      locationWatcher.current = null;
      return;
    }
    const startWatching = async () => {
      locationWatcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        async (loc) => {
          const now = Date.now();
          if (now - lastPushRef.current >= 10000) {
            lastPushRef.current = now;
            try {
              await api.patch(`/bookings/${primary.id}/location`, {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              });
            } catch (e) {
              console.warn('Location push failed', e);
            }
          }
        },
      );
    };
    startWatching();
    return () => { locationWatcher.current?.remove(); locationWatcher.current = null; };
  }, [isOnline, locationAllowed, primary?.id, primary?.status]);

  // ── actions ─────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!primary) return;
    if (!user?.isVerified) {
      Alert.alert(
        'Account not verified',
        'You need verified documents before starting a trip.',
        [
          { text: 'Go to Verification', onPress: () => navigation.navigate('Verification') },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    if (primary.truck && !primary.truck.isVerified) {
      Alert.alert('Truck not verified', "This truck's documents need verification before it can be used.");
      return;
    }
    if (!locationAllowed || !isOnline) {
      Alert.alert(
        'Go online first',
        'You need to be online (sharing your location) before starting a trip.',
        [{ text: 'OK' }],
      );
      return;
    }
    Alert.alert('Start the trip?', 'Live tracking will begin.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: async () => {
          setActing(true);
          setBookings((prev) => prev.map((b) => b.id === primary.id ? { ...b, status: 'IN_TRANSIT' } : b));
          try {
            await api.patch(`/bookings/${primary.id}/start`);
            await fetchBookings();
          } catch (e: any) {
            Alert.alert('Could not start', formatApiError(e, 'Please try again.'));
            await fetchBookings();
          } finally { setActing(false); }
        },
      },
    ]);
  };

  const handleDeliver = () => {
    if (!primary) return;
    Alert.alert('Mark as delivered?', 'Confirm only after the cargo has been handed over.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, delivered',
        onPress: async () => {
          setActing(true);
          // Optimistic: remove from active list
          setBookings((prev) => prev.filter((b) => b.id !== primary.id));
          locationWatcher.current?.remove();
          locationWatcher.current = null;
          try {
            await api.patch(`/bookings/${primary.id}/deliver`);
            await fetchBookings();
          } catch (e: any) {
            Alert.alert('Could not mark delivered', formatApiError(e, 'Please try again.'));
            await fetchBookings();
          } finally { setActing(false); }
        },
      },
    ]);
  };

  const openMaps = (city: string) => {
    const q = encodeURIComponent(city);
    const url = Platform.select({ ios: `maps:?daddr=${q}`, android: `geo:0,0?q=${q}` })
      || `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`));
  };

  const onRefresh = useCallback(() => { setRefreshing(true); fetchBookings(); }, [fetchBookings]);

  // ── derived display ─────────────────────────────────────────────────
  const senderName = primary?.sender?.fullName || primary?.load?.sender?.fullName;
  const senderPhone = primary?.sender?.phone || primary?.load?.sender?.phone;
  const senderId = primary?.sender?.id || primary?.load?.sender?.id;

  /* ── render ─────────────────────────────────────────────────────── */

  return (
    <ScreenWrapper backgroundColor={BG}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header — minimal */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Hi, {firstName}</Text>
        <NotificationBell navigation={navigation} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />}
      >
        {/* ── BIG ONLINE TOGGLE — the centerpiece ────────────────────── */}
        <TouchableOpacity
          onPress={toggleOnline}
          activeOpacity={0.85}
          style={[styles.toggleCard, isOnline ? styles.toggleCardOn : styles.toggleCardOff]}
        >
          <View style={styles.toggleRow}>
            <View style={[styles.dot, isOnline ? styles.dotOn : styles.dotOff]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, isOnline ? styles.toggleTitleOn : styles.toggleTitleOff]}>
                {isOnline ? "You're online" : "You're offline"}
              </Text>
              <Text style={[styles.toggleSub, isOnline ? styles.toggleSubOn : styles.toggleSubOff]}>
                {isOnline
                  ? (primary?.status === 'IN_TRANSIT'
                      ? 'Sharing location with the sender'
                      : 'Waiting for a load')
                  : 'Tap to go online and share location'}
              </Text>
            </View>
            <View style={[styles.pill, isOnline ? styles.pillOn : styles.pillOff]}>
              <Text style={[styles.pillText, isOnline ? styles.pillTextOn : styles.pillTextOff]}>
                {isOnline ? 'ON' : 'OFF'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── JOB CARD or EMPTY STATE ─────────────────────────────── */}
        {loading ? (
          <View style={styles.skelCard}>
            <View style={styles.skelLine} />
            <View style={[styles.skelLine, { width: '60%', marginTop: 10 }]} />
            <View style={[styles.skelLine, { width: '100%', height: 48, marginTop: 24, borderRadius: 12 }]} />
          </View>
        ) : !primary ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🚛</Text>
            <Text style={styles.emptyTitle}>
              {isOnline ? 'No job yet' : 'Go online to receive loads'}
            </Text>
            <Text style={styles.emptyBody}>
              {isOnline
                ? "When a broker assigns you a load, it'll show up here."
                : 'Tap the toggle above. Loads come straight to this screen.'}
            </Text>
          </View>
        ) : (
          <View style={styles.jobCard}>
            {primary.status === 'IN_TRANSIT' && (
              <View style={styles.liveStrip}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE — TRIP IN PROGRESS</Text>
              </View>
            )}

            <Text style={styles.jobTitle} numberOfLines={2}>{primary.load?.title}</Text>
            <Text style={styles.jobRoute}>
              {primary.load?.pickupCity} → {primary.load?.deliveryCity}
            </Text>

            <View style={styles.metaRow}>
              {primary.load?.weightTons != null && (
                <View style={styles.metaPill}><Text style={styles.metaPillText}>{primary.load.weightTons}t</Text></View>
              )}
              {primary.truck?.plateNumber && (
                <View style={styles.metaPill}><Text style={styles.metaPillText}>{primary.truck.plateNumber}</Text></View>
              )}
            </View>

            {/* Contact + nav row — big, obvious */}
            {senderName && (
              <>
                <View style={styles.divider} />
                <Text style={styles.contactLabel}>Cargo sender</Text>
                <Text style={styles.contactName}>{senderName}</Text>
                <View style={styles.contactRow}>
                  {senderPhone && (
                    <TouchableOpacity
                      style={styles.contactBtn}
                      onPress={() => Linking.openURL('tel:' + senderPhone)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.contactBtnText}>📞  Call</Text>
                    </TouchableOpacity>
                  )}
                  {senderId && (
                    <TouchableOpacity
                      style={styles.contactBtnSecondary}
                      onPress={() => navigation.navigate('Chat', { userId: senderId, userName: senderName, phone: senderPhone })}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.contactBtnSecondaryText}>💬  Message</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {primary.load?.deliveryCity && (
                  <TouchableOpacity
                    onPress={() => openMaps(primary.load.deliveryCity)}
                    style={styles.mapsBtn}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.mapsBtnText}>🧭  Open delivery in maps</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* PRIMARY ACTION — big, obvious */}
            <View style={styles.divider} />
            {primary.status === 'ACCEPTED' && (
              <TouchableOpacity
                style={[styles.primaryBtn, acting && { opacity: 0.6 }]}
                onPress={handleStart}
                disabled={acting}
                activeOpacity={0.85}
              >
                {acting
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.primaryBtnText}>Start trip</Text>}
              </TouchableOpacity>
            )}
            {primary.status === 'IN_TRANSIT' && (
              <>
                <TouchableOpacity
                  style={[styles.primaryBtn, acting && { opacity: 0.6 }]}
                  onPress={handleDeliver}
                  disabled={acting}
                  activeOpacity={0.85}
                >
                  {acting
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.primaryBtnText}>Mark delivered</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.podBtn}
                  onPress={() => navigation.navigate('ProofOfDelivery', { bookingId: primary.id })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.podBtnText}>📷  Upload delivery photos</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Location-permission warning when toggle was tapped but never granted */}
        {!locationAllowed && isOnline && (
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              Location permission isn't granted. Open phone settings to enable it.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

/* ── styles ───────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  /* top bar */
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, backgroundColor: BG },
  topBarTitle:   { fontSize: 20, fontWeight: '700', color: TEXT, letterSpacing: -0.3 },

  content:       { padding: 20, paddingTop: 4, paddingBottom: 40 },

  /* TOGGLE — the centerpiece. Big, full-width tap target. */
  toggleCard:    { borderRadius: 18, padding: 22, marginBottom: 24, borderWidth: 1, shadowColor: NAVY, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  toggleCardOn:  { backgroundColor: TEAL_BG, borderColor: TEAL_BD },
  toggleCardOff: { backgroundColor: CARD, borderColor: BORDER },
  toggleRow:     { flexDirection: 'row', alignItems: 'center', gap: 16 },
  dot:           { width: 14, height: 14, borderRadius: 7 },
  dotOn:         { backgroundColor: TEAL_FG },
  dotOff:        { backgroundColor: SUBTLE },
  toggleTitle:   { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 2 },
  toggleTitleOn: { color: TEAL_FG },
  toggleTitleOff:{ color: TEXT },
  toggleSub:     { fontSize: 14, fontWeight: '500' },
  toggleSubOn:   { color: TEAL_FG, opacity: 0.85 },
  toggleSubOff:  { color: MUTED },
  pill:          { borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1 },
  pillOn:        { backgroundColor: TEAL_FG, borderColor: TEAL_FG },
  pillOff:       { backgroundColor: '#FFFFFF', borderColor: BORDER },
  pillText:      { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  pillTextOn:    { color: '#FFFFFF' },
  pillTextOff:   { color: SUBTLE },

  /* JOB CARD */
  jobCard:       { backgroundColor: CARD, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: BORDER, shadowColor: NAVY, shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  liveStrip:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TEAL_BG, borderColor: TEAL_BD, borderWidth: 1, borderRadius: 99, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, marginBottom: 14 },
  liveDot:       { width: 7, height: 7, borderRadius: 3.5, backgroundColor: TEAL_FG },
  liveText:      { fontSize: 10, fontWeight: '800', color: TEAL_FG, letterSpacing: 1.2 },
  jobTitle:      { fontSize: 19, fontWeight: '700', color: TEXT, letterSpacing: -0.3, marginBottom: 4 },
  jobRoute:      { fontSize: 15, color: MUTED, marginBottom: 14 },
  metaRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  metaPill:      { backgroundColor: BG, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  metaPillText:  { fontSize: 12, fontWeight: '600', color: MUTED },

  divider:       { height: 1, backgroundColor: BORDER, marginVertical: 18 },

  contactLabel:  { fontSize: 11, fontWeight: '700', color: SUBTLE, letterSpacing: 1.2, marginBottom: 4 },
  contactName:   { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 14 },
  contactRow:    { flexDirection: 'row', gap: 10, marginBottom: 10 },
  contactBtn:    { flex: 1, backgroundColor: BLUE, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  contactBtnText:{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  contactBtnSecondary:     { flex: 1, backgroundColor: BG, borderColor: BORDER, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  contactBtnSecondaryText: { color: NAVY, fontSize: 15, fontWeight: '600' },
  mapsBtn:       { backgroundColor: BG, borderColor: BORDER, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  mapsBtnText:   { color: NAVY, fontSize: 14, fontWeight: '600' },

  /* PRIMARY ACTION BUTTONS — large, obvious */
  primaryBtn:      { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 18, alignItems: 'center', shadowColor: BLUE, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  primaryBtnText:  { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  podBtn:          { marginTop: 12, backgroundColor: BG, borderColor: BORDER, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  podBtnText:      { color: NAVY, fontSize: 14, fontWeight: '600' },

  /* EMPTY + SKEL */
  emptyCard:     { backgroundColor: CARD, borderRadius: 16, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  emptyEmoji:    { fontSize: 52, marginBottom: 16 },
  emptyTitle:    { fontSize: 17, fontWeight: '600', color: TEXT, marginBottom: 8, textAlign: 'center' },
  emptyBody:     { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  skelCard:      { backgroundColor: CARD, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: BORDER },
  skelLine:      { height: 16, width: '80%', backgroundColor: '#F1F5F9', borderRadius: 6 },

  /* WARN */
  warnCard:      { marginTop: 16, backgroundColor: DANGER_BG, borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 14 },
  warnText:      { color: DANGER, fontSize: 13, lineHeight: 19 },
});
