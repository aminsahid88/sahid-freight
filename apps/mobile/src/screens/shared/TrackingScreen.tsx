import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ActivityIndicator, Linking, Animated, Easing, ScrollView,
  Platform,
} from 'react-native';
// TODO: re-enable react-native-maps when paid Apple Developer account + static frameworks setup
// import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { StatusBadge } from '../../components/StatusBadge';

const TIMELINE = [
  { key: 'POSTED',   label: 'Load posted' },
  { key: 'ACCEPTED', label: 'Bid accepted' },
  { key: 'TRANSIT',  label: 'In transit' },
  { key: 'DONE',     label: 'Delivered' },
];

function getTimelineStep(status: string) {
  if (!status) return 0;
  if (status === 'OPEN' || status === 'BOOKED') return 1;
  if (status === 'ACCEPTED') return 1;
  if (status === 'IN_TRANSIT') return 2;
  if (status === 'DELIVERED' || status === 'COMPLETED') return 3;
  return 0;
}

function PulsingDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.5, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.dot, styles.dotActive, { transform: [{ scale: anim }] }]} />
  );
}

function openInMaps(lat?: number | null, lng?: number | null, address?: string | null) {
  let url: string;
  if (lat && lng) {
    url = Platform.OS === 'ios'
      ? `maps://?daddr=${lat},${lng}`
      : `geo:0,0?q=${lat},${lng}`;
  } else if (address) {
    url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${encodeURIComponent(address)}`
      : `geo:0,0?q=${encodeURIComponent(address)}`;
  } else {
    return;
  }
  Linking.openURL(url);
}

export default function TrackingScreen({ route, navigation }: any) {
  const { bookingId } = route.params || {};
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBooking = async () => {
    if (!bookingId) { setLoading(false); return; }
    try {
      const res = await api.get(`/bookings/${bookingId}`);
      setBooking(res.data?.booking || res.data);
    } catch (e) {
      console.warn('Tracking fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking();
    pollRef.current = setInterval(fetchBooking, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [bookingId]);

  const step = getTimelineStep(booking?.status);
  const driver = booking?.driver;
  const driverPhone = driver?.phone || booking?.truck?.driver?.phone;
  const load = booking?.load;

  const deliveryLat = load?.deliveryLat ? Number(load.deliveryLat) : null;
  const deliveryLng = load?.deliveryLng ? Number(load.deliveryLng) : null;
  const canOpenMaps = !!(deliveryLat && deliveryLng) || !!load?.deliveryCity;

  return (
    <ScreenWrapper edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live tracking</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : !booking ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Booking not found</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Route card (replaces embedded MapView) */}
          {/* TODO: re-enable react-native-maps when paid Apple Developer account + static frameworks setup */}
          <View style={styles.mapPlaceholder}>
            <View style={styles.mapPlaceholderInner}>
              <Text style={styles.mapIcon}>🗺️</Text>
              <Text style={styles.mapRouteText}>
                {load?.pickupCity || '—'}  →  {load?.deliveryCity || '—'}
              </Text>
              {booking.status === 'IN_TRANSIT' && (
                <View style={styles.liveChip}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>IN TRANSIT</Text>
                </View>
              )}
            </View>

            <View style={styles.mapButtonRow}>
              <TouchableOpacity
                style={[styles.mapBtn, styles.mapBtnPrimary, !canOpenMaps && styles.mapBtnDisabled]}
                onPress={() => openInMaps(deliveryLat, deliveryLng, load?.deliveryCity)}
                disabled={!canOpenMaps}
              >
                <Text style={styles.mapBtnPrimaryText}>Open in Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapBtn, styles.mapBtnSecondary, !driverPhone && styles.mapBtnDisabled]}
                onPress={() => driverPhone && Linking.openURL('tel:' + driverPhone)}
                disabled={!driverPhone}
              >
                <Text style={styles.mapBtnSecondaryText}>📞 Contact Driver</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Route card */}
          <View style={styles.routeCard}>
            <Text style={styles.routeText}>
              {load?.pickupCity || '—'} → {load?.deliveryCity || '—'}
            </Text>
            <StatusBadge status={booking.status} />
          </View>

          {/* Timeline */}
          <View style={styles.timeline}>
            {TIMELINE.map((item, idx) => {
              const done = idx < step;
              const current = idx === step;
              return (
                <View key={item.key} style={styles.timelineRow}>
                  <View style={styles.timelineLine}>
                    {done ? (
                      <View style={[styles.dot, styles.dotDone]}><Text style={styles.dotCheck}>✓</Text></View>
                    ) : current ? (
                      <PulsingDot />
                    ) : (
                      <View style={[styles.dot, styles.dotPending]} />
                    )}
                    {idx < TIMELINE.length - 1 && (
                      <View style={[styles.connector, done && styles.connectorDone]} />
                    )}
                  </View>
                  <Text style={[styles.timelineLabel, done && styles.timelineLabelDone, current && styles.timelineLabelCurrent]}>
                    {item.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Driver info */}
          {(driver || booking.truck) && (
            <View style={styles.driverCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverLabel}>DRIVER</Text>
                <Text style={styles.driverName}>{driver?.fullName || 'Assigned'}</Text>
                <Text style={styles.truckPlate}>{booking.truck?.plateNumber} · {booking.truck?.truckType?.replace(/_/g,' ')}</Text>
              </View>
              {driverPhone && (
                <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL('tel:' + driverPhone)}>
                  <Text style={styles.callBtnText}>📞 Call</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Call button */}
          {driverPhone && (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.callLargeBtn} onPress={() => Linking.openURL('tel:' + driverPhone)}>
                <Text style={styles.callLargeBtnText}>📞 Call driver</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:              { backgroundColor: theme.bg, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: theme.border },
  backBtn:             { paddingVertical: 4 },
  backText:            { color: theme.accent, fontSize: 15, fontWeight: '500' },
  headerTitle:         { color: theme.text, fontSize: 15, fontWeight: '500' },
  center:              { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText:           { color: theme.textSecondary, fontSize: 15 },

  // Route placeholder (replaces MapView)
  mapPlaceholder:      { margin: 16, marginBottom: 0, backgroundColor: theme.surface, borderRadius: 14, overflow: 'hidden' },
  mapPlaceholderInner: { paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 10, backgroundColor: 'rgba(151,196,89,0.04)' },
  mapIcon:             { fontSize: 32 },
  mapRouteText:        { fontSize: 15, fontWeight: '600', color: theme.text, textAlign: 'center' },
  liveChip:            { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(11,15,14,0.85)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 },
  liveDot:             { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent },
  liveText:            { fontSize: 11, fontWeight: '500', color: theme.accent, letterSpacing: 1 },
  mapButtonRow:        { flexDirection: 'row', gap: 10, padding: 14 },
  mapBtn:              { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  mapBtnPrimary:       { backgroundColor: theme.accent },
  mapBtnPrimaryText:   { color: theme.darkGreen, fontSize: 13, fontWeight: '600' },
  mapBtnSecondary:     { backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border },
  mapBtnSecondaryText: { color: theme.text, fontSize: 13, fontWeight: '500' },
  mapBtnDisabled:      { opacity: 0.4 },

  routeCard:           { margin: 16, backgroundColor: theme.surface, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeText:           { fontSize: 15, fontWeight: '500', color: theme.text, flex: 1 },
  timeline:            { paddingHorizontal: 24, paddingVertical: 8 },
  timelineRow:         { flexDirection: 'row', alignItems: 'flex-start' },
  timelineLine:        { alignItems: 'center', width: 28 },
  dot:                 { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dotDone:             { backgroundColor: theme.accent },
  dotActive:           { backgroundColor: theme.accent, opacity: 0.9 },
  dotPending:          { backgroundColor: theme.surface2, borderWidth: 1.5, borderColor: theme.border },
  dotCheck:            { fontSize: 12, color: theme.darkGreen, fontWeight: '500' },
  connector:           { width: 2, height: 32, backgroundColor: theme.border, marginVertical: 2 },
  connectorDone:       { backgroundColor: theme.accent },
  timelineLabel:       { fontSize: 14, color: theme.textMuted, paddingLeft: 14, paddingTop: 2, paddingBottom: 34 },
  timelineLabelDone:   { color: theme.textSecondary },
  timelineLabelCurrent:{ color: theme.text, fontWeight: '500' },
  driverCard:          { margin: 16, marginTop: 4, backgroundColor: theme.surface, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center' },
  driverLabel:         { fontSize: 11, color: theme.textMuted, fontWeight: '500', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.9 },
  driverName:          { fontSize: 15, fontWeight: '500', color: theme.text },
  truckPlate:          { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  callBtn:             { backgroundColor: theme.accentDim, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  callBtnText:         { fontSize: 13, fontWeight: '500', color: theme.accent },
  footer:              { padding: 16, paddingTop: 8, paddingBottom: 32 },
  callLargeBtn:        { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  callLargeBtnText:    { fontSize: 13, fontWeight: '500', color: theme.darkGreen },
});
