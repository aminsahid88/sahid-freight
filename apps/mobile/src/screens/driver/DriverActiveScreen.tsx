import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, RefreshControl, Linking, Platform,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import * as Location from 'expo-location';
import api from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { theme } from '../../theme';
import { formatPrice } from '../../lib/constants';
import { useAuthStore } from '../../store/auth';
import { StatusBadge } from '../../components/StatusBadge';
import { SlideButton } from '../../components/SlideButton';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { NotificationBell } from '../../components/NotificationBell';

export default function DriverActiveScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);
  const lastPushRef = useRef<number>(0);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await api.get('/bookings/driver/my');
      const all = res.data?.bookings || res.data || [];
      const active = all.filter((b: any) => b.status === 'ACCEPTED' || b.status === 'IN_TRANSIT');
      setBookings(active);
    } catch (e) {
      console.warn('Fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const requestLocationPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationAllowed(true);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    requestLocationPermission();
  }, [fetchBookings, requestLocationPermission]);

  // Pick the primary booking: IN_TRANSIT first, then first ACCEPTED
  const primary = bookings.find((b: any) => b.status === 'IN_TRANSIT')
    || bookings.find((b: any) => b.status === 'ACCEPTED')
    || null;
  const upNext = bookings.filter((b: any) => b.id !== primary?.id);

  // GPS tracking for in-transit booking
  useEffect(() => {
    if (!locationAllowed || !primary || primary.status !== 'IN_TRANSIT') {
      locationWatcher.current?.remove();
      locationWatcher.current = null;
      return;
    }

    const startWatching = async () => {
      locationWatcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        async (loc) => {
          const { latitude, longitude } = loc.coords;
          setCurrentLocation({ latitude, longitude });

          const now = Date.now();
          if (now - lastPushRef.current >= 10000) {
            lastPushRef.current = now;
            try {
              await api.patch(`/bookings/${primary.id}/location`, { latitude, longitude });
            } catch (e) {
              console.warn('Failed to push location', e);
            }
          }
        }
      );
    };

    startWatching();
    return () => {
      locationWatcher.current?.remove();
      locationWatcher.current = null;
    };
  }, [locationAllowed, primary?.id, primary?.status]);

  const onRefresh = () => { setRefreshing(true); fetchBookings(); };

  const handleStart = async (bookingId: string) => {
    if (!user?.isVerified) {
      Alert.alert(
        'Complete your verification',
        'You need to upload all required documents and have them approved before you can start a journey.',
        [
          { text: 'Go to Verification', onPress: () => navigation.navigate('Verification') },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    // Check truck verification
    const booking = bookings.find(b => b.id === bookingId);
    if (booking?.truck && !booking.truck.isVerified) {
      Alert.alert(
        'Truck not verified',
        "This truck's documents need verification before it can be used.",
        [{ text: 'OK' }],
      );
      return;
    }
    if (__DEV__) console.log('[DriverActive] handleStart called, bookingId:', bookingId);
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'IN_TRANSIT' } : b));
    try {
      if (__DEV__) console.log('[DriverActive] calling PATCH /bookings/start');
      const res = await api.patch(`/bookings/${bookingId}/start`);
      if (__DEV__) console.log('[DriverActive] API returned:', res.status, res.data?.message);
      await fetchBookings();
    } catch (e: any) {
      if (__DEV__) console.error('[DriverActive] startJourney failed:', e?.response?.status, e?.response?.data);
      Alert.alert('Could not start journey', formatApiError(e, 'Please try again.'));
      await fetchBookings();
    }
  };

  const handleDeliver = async (bookingId: string) => {
    if (__DEV__) console.log('[DriverActive] handleDeliver called, bookingId:', bookingId);
    setBookings(prev => prev.filter(b => b.id !== bookingId));
    locationWatcher.current?.remove();
    locationWatcher.current = null;
    try {
      const res = await api.patch(`/bookings/${bookingId}/deliver`);
      if (__DEV__) console.log('[DriverActive] deliver returned:', res.status, res.data?.message);
      await fetchBookings();
    } catch (e: any) {
      if (__DEV__) console.error('[DriverActive] deliver failed:', e?.response?.status, e?.response?.data);
      Alert.alert('Could not mark as delivered', formatApiError(e, 'Please try again.'));
      await fetchBookings();
    }
  };

  const openNavigation = (address: string) => {
    const encoded = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:?daddr=${encoded}`,
      android: `geo:0,0?q=${encoded}`,
    }) || `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`);
    });
  };

  const canAct = user?.role === 'DRIVER';

  const initials = (user?.fullName || 'D')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (loading) {
    return <ScreenWrapper><SkeletonList count={3} /></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.driverLabel}>Driver</Text>
            <Text style={styles.driverName}>{user?.fullName || 'Driver'}</Text>
          </View>
        </View>
        <NotificationBell navigation={navigation} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {!primary ? (
          <EmptyState
            emoji="🚛"
            title="No active trips"
            subtitle="You have no assigned or in-transit bookings right now. Pull to refresh."
          />
        ) : (
          <>
            {/* Live tracking card */}
            {primary.status === 'IN_TRANSIT' && (
              <View style={styles.trackingCard}>
                <View style={styles.trackingHeader}>
                  <View style={styles.trackingDot} />
                  <Text style={styles.trackingTitle}>Live tracking active</Text>
                </View>
                <Text style={styles.trackingRoute}>
                  {primary.load?.pickupCity} → {primary.load?.deliveryCity}
                </Text>
                {currentLocation ? (
                  <View style={styles.coordRow}>
                    <Text style={styles.coordLabel}>GPS</Text>
                    <Text style={styles.coordValue}>
                      {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.locatingBox}>
                    <Text style={styles.locatingText}>Getting your location...</Text>
                  </View>
                )}
                <Text style={styles.trackingHint}>
                  Your location is being shared with the cargo sender every 10 seconds.
                </Text>
              </View>
            )}

            {/* Primary booking card */}
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.loadTitle} numberOfLines={2}>{primary.load?.title}</Text>
                <View style={styles.cardTopActions}>
                  {primary.load?.deliveryCity && (
                    <TouchableOpacity
                      style={styles.navBtn}
                      onPress={() => openNavigation(primary.load.deliveryCity)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.navBtnEmoji}>🧭</Text>
                    </TouchableOpacity>
                  )}
                  <StatusBadge status={primary.status} />
                </View>
              </View>
              <Text style={styles.route}>{primary.load?.pickupCity} → {primary.load?.deliveryCity}</Text>

              <View style={styles.divider} />

              <Row label="Truck" value={primary.truck?.plateNumber} />
              <Row label="Cargo weight" value={`${primary.load?.weightTons}t`} />
              <Row label="Your pay" value={formatPrice(primary.agreedPrice, primary.load?.currency)} bold />
              {primary.load?.description && (
                <Row label="Notes" value={primary.load.description} />
              )}

              {(primary.sender?.phone || primary.load?.sender?.phone) && (
                <View style={styles.callSection}>
                  <Text style={styles.senderLabel}>
                    Cargo sender: {primary.sender?.fullName || primary.load?.sender?.fullName || 'Sender'}
                  </Text>
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => Linking.openURL('tel:' + (primary.sender?.phone || primary.load?.sender?.phone))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.callBtnText}>📞  Call sender</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Location permission warning */}
            {!locationAllowed && (
              <View style={styles.permWarn}>
                <Text style={styles.permWarnText}>
                  Location permission denied. Enable it in settings to share your live position.
                </Text>
                <TouchableOpacity onPress={requestLocationPermission} activeOpacity={0.7}>
                  <Text style={styles.permWarnLink}>Grant permission</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Action buttons */}
            {primary.status === 'ACCEPTED' && canAct && (
              <View style={styles.actions}>
                <Text style={styles.actionHint}>Ready to pick up the cargo? Start the journey to begin live tracking.</Text>
                <SlideButton
                  label="Slide to start journey"
                  color={theme.warning}
                  onConfirm={() => handleStart(primary.id)}
                  disabled={!locationAllowed}
                />
              </View>
            )}

            {primary.status === 'IN_TRANSIT' && canAct && (
              <View style={styles.actions}>
                <Text style={styles.actionHint}>Cargo is on the road. Update status as you go.</Text>
                <TouchableOpacity
                  style={styles.deliverBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    Alert.alert(
                      'Confirm delivery',
                      'Are you sure the cargo has been delivered?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Yes, delivered', onPress: () => handleDeliver(primary.id) },
                      ]
                    );
                  }}
                >
                  <Text style={styles.deliverBtnText}>Mark as delivered</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Up next section */}
        {upNext.length > 0 && (
          <View style={styles.upNextSection}>
            <Text style={styles.sectionLabel}>UP NEXT</Text>
            {upNext.map(b => (
              <View key={b.id} style={styles.upNextCard}>
                <View style={styles.upNextInfo}>
                  <Text style={styles.upNextTitle} numberOfLines={1}>{b.load?.title}</Text>
                  <Text style={styles.upNextRoute}>{b.load?.pickupCity} → {b.load?.deliveryCity}</Text>
                </View>
                <Text style={styles.upNextPrice}>{formatPrice(b.agreedPrice, b.load?.currency)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

function Row({ label, value, bold }: { label: string; value: any; bold?: boolean }) {
  return (
    <View style={rowS.row}>
      <Text style={rowS.label}>{label}</Text>
      <Text style={[rowS.value, bold && rowS.boldValue]}>{value}</Text>
    </View>
  );
}

const rowS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  label: {
    fontSize: 13,
    color: theme.textMuted,
    fontWeight: '400',
  },
  value: {
    fontSize: 13,
    color: theme.text,
    fontWeight: '400',
    maxWidth: '60%',
    textAlign: 'right',
  },
  boldValue: {
    fontWeight: '600',
    color: theme.accent,
  },
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.accentText,
  },
  driverLabel: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginTop: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  trackingCard: {
    backgroundColor: theme.blueDim,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.accentBorder,
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  trackingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.accent,
  },
  trackingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.accent,
  },
  trackingRoute: {
    fontSize: 14,
    fontWeight: '400',
    color: theme.text,
    marginBottom: 12,
  },
  coordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: theme.accentBorder,
  },
  coordLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coordValue: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.text,
    fontVariant: ['tabular-nums'] as any,
  },
  trackingHint: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 16,
  },
  locatingBox: {
    backgroundColor: theme.warningDim,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: theme.warning,
  },
  locatingText: {
    fontSize: 13,
    color: theme.warning,
    fontWeight: '500',
  },
  card: {
    backgroundColor: theme.bg,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
    marginRight: 12,
  },
  route: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginBottom: 4,
  },
  callSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  senderLabel: {
    fontSize: 13,
    color: theme.textMuted,
    marginBottom: 10,
    fontWeight: '400',
  },
  callBtn: {
    backgroundColor: theme.accentDim,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.accentBorder,
  },
  callBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
  },
  permWarn: {
    backgroundColor: theme.dangerDim,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.danger,
    marginBottom: 16,
  },
  permWarnText: {
    fontSize: 13,
    color: theme.danger,
    lineHeight: 19,
  },
  permWarnLink: {
    fontSize: 13,
    color: theme.danger,
    fontWeight: '600',
    marginTop: 10,
    textDecorationLine: 'underline',
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  navBtnEmoji: {
    fontSize: 16,
  },
  actions: {
    gap: 12,
    marginBottom: 16,
  },
  actionHint: {
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 4,
  },
  deliverBtn: {
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  deliverBtnText: {
    color: theme.accentText,
    fontSize: 15,
    fontWeight: '600',
  },
  upNextSection: {
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  upNextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  upNextInfo: {
    flex: 1,
  },
  upNextTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  upNextRoute: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 3,
  },
  upNextPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.accent,
  },
});
