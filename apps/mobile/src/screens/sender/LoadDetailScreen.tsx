import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { formatPrice } from '../../lib/constants';
import { StatusBadge } from '../../components/StatusBadge';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { StarRating } from '../../components/StarRating';
import { formatApiError } from '../../lib/errors';
import { useAuthStore } from '../../store/auth';

// P2: bidding flow hidden during broker-direct-assignment pivot.
// When true, the bids section + accept/reject buttons render and the bid fetch runs.
// Handlers (handleAccept, handleReject) are kept in place for easy revert.
const BIDDING_ENABLED = false;

export default function LoadDetailScreen({ route, navigation }: any) {
  const { user } = useAuthStore();
  const { loadId } = route.params;
  const [load, setLoad] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const [loadRes, bidsRes, bookingsRes] = await Promise.all([
        api.get(`/loads/${loadId}`),
        BIDDING_ENABLED
          ? api.get(`/bids/load/${loadId}`)
          : Promise.resolve({ data: { bids: [] } }),
        api.get(`/bookings/load/${loadId}`).catch(() => ({ data: { bookings: [] } })),
      ]);
      setLoad(loadRes.data?.load || loadRes.data);
      setBids(bidsRes.data?.bids || bidsRes.data || []);
      setBookings(bookingsRes.data?.bookings || []);
    } catch (e) {
      console.warn('Fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadId]);

  useEffect(() => { fetch(); }, [fetch]);

  const onRefresh = () => { setRefreshing(true); fetch(); };

  const handleAccept = async (bidId: string) => {
    if (!user?.isVerified) {
      Alert.alert(
        'Finish verification first',
        'Upload your documents and wait for approval before accepting a truck offer.',
        [
          { text: 'Go to verification', onPress: () => navigation.navigate('Verification') },
          { text: 'Not now', style: 'cancel' },
        ],
      );
      return;
    }
    setActionLoading(bidId + '-accept');
    try {
      await api.patch(`/bids/${bidId}/accept`);
      await fetch();
    } catch (e: any) {
      Alert.alert('Offer not accepted', formatApiError(e, "We couldn't accept this offer. Please try again.", 'booking'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (bidId: string) => {
    Alert.alert('Reject this offer?', "The truck owner will be notified and won't be dispatched to this load.", [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          setActionLoading(bidId + '-reject');
          try {
            await api.patch(`/bids/${bidId}/reject`);
            await fetch();
          } catch (e: any) {
            Alert.alert('Offer not rejected', formatApiError(e, "We couldn't reject this offer. Please try again.", 'booking'));
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleRate = async (bookingId: string, rating: number) => {
    try {
      await api.patch(`/bookings/${bookingId}/rate`, { rating });
      await fetch();
    } catch (e: any) {
      Alert.alert('Rating not saved', formatApiError(e, "We couldn't save your rating. Please try again.", 'booking'));
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
        <SkeletonList count={4} />
      </ScreenWrapper>
    );
  }

  if (!load) {
    return (
      <ScreenWrapper>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
        <EmptyState icon="alert-triangle" title="Load not found" subtitle="This load may have been deleted or is no longer available." />
      </ScreenWrapper>
    );
  }

  const activeBooking = (load?.bookings || []).find((b: any) =>
    ['ACCEPTED', 'IN_TRANSIT', 'COMPLETED', 'DELIVERED'].includes(b.status)
  );

  // Dispatched booking (from the broker-aware bookings fetch — has truck + owner + driver).
  // Used for the sender-facing status card. Read-only; no accept/reject here.
  const dispatchedBooking = bookings.find((b: any) =>
    ['ACCEPTED', 'IN_TRANSIT', 'COMPLETED'].includes(b.status)
  );
  const isLookingForTruck = load.status === 'OPEN' && bookings.length === 0;
  const dispatchTitle =
    dispatchedBooking?.status === 'IN_TRANSIT' ? 'In transit' :
    dispatchedBooking?.status === 'COMPLETED' ? 'Delivered' :
    'Truck assigned';

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Feather name="arrow-left" size={18} color={theme.accent} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <StatusBadge status={load.status} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>{load.title}</Text>
        <Text style={styles.route}>{load.pickupCity} → {load.deliveryCity}</Text>

        {/* Details card */}
        <View style={styles.card}>
          <Row label="Weight" value={`${load.weightTons} tons`} />
          <Row label="Truck type" value={load.truckTypeNeeded?.replace(/_/g, ' ')} />
          <Row label="Pickup country" value={load.pickupCountry} />
          <Row label="Delivery country" value={load.deliveryCountry} />
          <Row label="Offered price" value={formatPrice(load.offeredPrice, load.currency)} bold />
          {load.description && <Row label="Notes" value={load.description} />}
        </View>

        {/* Cargo-owner-facing dispatch status card (broker-pivot replacement for the bids panel) */}
        {isLookingForTruck && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusIcon}>
                <Feather name="search" size={20} color={theme.accent} />
              </View>
              <Text style={styles.statusTitle}>Finding you a truck</Text>
            </View>
            <Text style={styles.statusBody}>
              A broker is matching your load with the right truck. You'll be notified as soon as one is dispatched.
            </Text>
          </View>
        )}

        {dispatchedBooking && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusIcon}>
                <Feather name="truck" size={20} color={theme.accent} />
              </View>
              <Text style={styles.statusTitle}>{dispatchTitle}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Truck</Text>
              <Text style={styles.statusValue}>
                {dispatchedBooking.truck?.plateNumber}
                {dispatchedBooking.truck?.truckType ? ` · ${dispatchedBooking.truck.truckType.replace(/_/g, ' ')}` : ''}
              </Text>
            </View>
            {dispatchedBooking.owner?.fullName && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Truck owner</Text>
                <Text style={styles.statusValue}>{dispatchedBooking.owner.fullName}</Text>
              </View>
            )}
            {dispatchedBooking.truck?.driver?.fullName && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Driver</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.statusValue}>{dispatchedBooking.truck.driver.fullName}</Text>
                  {dispatchedBooking.truck.driver.phone && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL('tel:' + dispatchedBooking.truck.driver.phone)}
                      style={styles.callBtn}
                      accessibilityLabel="Call driver"
                    >
                      <Feather name="phone" size={12} color={theme.accent} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            <Text style={styles.statusAgreedPrice}>{formatPrice(dispatchedBooking.agreedPrice, dispatchedBooking.currency || load.currency)}</Text>
          </View>
        )}

        {/* Track button if in transit */}
        {(load.status === 'IN_TRANSIT' || load.status === 'BOOKED') && activeBooking && (
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => navigation.navigate('Tracking', { bookingId: activeBooking.id })}
          >
            <Feather name="map-pin" size={14} color={theme.darkGreen} />
            <Text style={styles.trackBtnText}>Track load</Text>
          </TouchableOpacity>
        )}

        {/* Bids — hidden during broker pivot (P2). Section renders only when BIDDING_ENABLED. */}
        {BIDDING_ENABLED && (<>
        <Text style={styles.sectionLabel}>Offers ({bids.length})</Text>

        {bids.length === 0 ? (
          <EmptyState icon="users" title="No offers yet" subtitle="Truck owners will send offers on this load." />
        ) : (
          bids.map(bid => (
            <View key={bid.id} style={styles.bidCard}>
              <View style={styles.bidHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bidOwner}>{bid.truckOwner?.fullName || 'Truck owner'}</Text>
                  <Text style={styles.bidTruck}>
                    {bid.truck?.plateNumber} · {bid.truck?.truckType?.replace(/_/g, ' ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <StatusBadge status={bid.status} />
                  {bid.truckOwner?.phone && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL('tel:' + bid.truckOwner.phone)}
                      style={styles.callBtn}
                    >
                      <Feather name="phone" size={12} color={theme.accent} />
                      <Text style={styles.callBtnText}>Call</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Chat', {
                      userId: bid.truckOwner?.id,
                      userName: bid.truckOwner?.fullName || 'Truck owner',
                      phone: bid.truckOwner?.phone,
                    })}
                    style={styles.msgBtn}
                  >
                    <Feather name="message-circle" size={12} color={theme.blue} />
                    <Text style={styles.msgBtnText}>Message</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.bidMeta}>
                <Text style={styles.bidPrice}>{formatPrice(bid.price, load.currency)}</Text>
                {bid.message && <Text style={styles.bidNote}>{bid.message}</Text>}
              </View>

              {/* Actions for pending offers */}
              {bid.status === 'PENDING' && load.status === 'OPEN' && (
                <View style={styles.bidActions}>
                  <TouchableOpacity
                    style={[styles.rejectBtn, actionLoading === bid.id + '-reject' && { opacity: 0.5 }]}
                    onPress={() => handleReject(bid.id)}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === bid.id + '-reject'
                      ? <ActivityIndicator size="small" color={theme.danger} />
                      : <Text style={styles.rejectText}>Reject</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.acceptBtn, actionLoading === bid.id + '-accept' && { opacity: 0.5 }]}
                    onPress={() => handleAccept(bid.id)}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === bid.id + '-accept'
                      ? <ActivityIndicator size="small" color={theme.darkGreen} />
                      : <Text style={styles.acceptText}>Accept offer</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}

              {/* Rating once the delivery booking is complete */}
              {bid.status === 'ACCEPTED' && load.status === 'DELIVERED' && activeBooking && !activeBooking.senderRating && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.rateLabel}>Rate this delivery</Text>
                  <StarRating value={0} onChange={rating => handleRate(activeBooking.id, rating)} />
                </View>
              )}
            </View>
          ))
        )}
        </>)}
      </ScrollView>
    </ScreenWrapper>
  );
}

function Row({ label, value, bold }: { label: string; value: any; bold?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, bold && { fontWeight: '500', color: theme.accent }]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  label: { fontSize: 13, color: theme.textMuted },
  value: { fontSize: 13, color: theme.text, fontWeight: '400', maxWidth: '60%', textAlign: 'right' },
});

const styles = StyleSheet.create({
  topBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.bg },
  back:         { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  backText:     { fontSize: 15, color: theme.accent, fontWeight: '500' },
  content:      { padding: 16, paddingBottom: 40 },
  title:        { fontSize: 22, fontWeight: '500', color: theme.text, marginBottom: 4 },
  route:        { fontSize: 14, color: theme.textMuted, marginBottom: 16 },
  card:         { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 12, marginTop: 8 },
  trackBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, marginBottom: 20 },
  trackBtnText: { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
  statusCard:   { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: theme.border },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  statusIcon:   { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accentDim, alignItems: 'center', justifyContent: 'center' },
  statusTitle:  { fontSize: 15, fontWeight: '500', color: theme.text },
  statusBody:   { fontSize: 13, color: theme.textMuted, marginTop: 6, lineHeight: 20 },
  statusRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: theme.border },
  statusLabel:  { fontSize: 12, color: theme.textMuted },
  statusValue:  { fontSize: 13, color: theme.text, fontWeight: '400' },
  statusAgreedPrice: { fontSize: 16, fontWeight: '500', color: theme.accent, marginTop: 12, textAlign: 'right' },
  bidCard:      { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  bidHeader:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  bidOwner:     { fontSize: 14, fontWeight: '500', color: theme.text },
  bidTruck:     { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  bidMeta:      { gap: 4 },
  bidPrice:     { fontSize: 15, fontWeight: '500', color: theme.accent },
  bidNote:      { fontSize: 13, color: theme.textMuted, fontStyle: 'italic' },
  bidActions:   { flexDirection: 'row', gap: 10, marginTop: 14 },
  rejectBtn:    { flex: 1, backgroundColor: theme.dangerDim, borderWidth: 0.5, borderColor: theme.danger, borderRadius: 10, padding: 10, alignItems: 'center' },
  rejectText:   { color: theme.danger, fontSize: 13, fontWeight: '500' },
  acceptBtn:    { flex: 1, backgroundColor: theme.accent, borderRadius: 10, padding: 10, alignItems: 'center' },
  acceptText:   { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
  rateLabel:    { fontSize: 13, color: theme.textMuted, marginBottom: 6 },
  callBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.accentDim, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 0.5, borderColor: theme.accentBorder },
  callBtnText:  { fontSize: 11, fontWeight: '500', color: theme.accent },
  msgBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.blueDim, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 0.5, borderColor: theme.blue },
  msgBtnText:   { fontSize: 11, fontWeight: '500', color: theme.blue },
});
