import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Alert, ActivityIndicator, Linking,
} from 'react-native';
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
        'Complete your verification',
        'You need to upload all required documents and have them approved before you can accept a bid.',
        [
          { text: 'Go to Verification', onPress: () => navigation.navigate('Verification') },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    setActionLoading(bidId + '-accept');
    try {
      await api.patch(`/bids/${bidId}/accept`);
      await fetch();
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e, 'Could not accept bid.'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (bidId: string) => {
    Alert.alert('Reject Bid', 'Are you sure you want to reject this bid?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          setActionLoading(bidId + '-reject');
          try {
            await api.patch(`/bids/${bidId}/reject`);
            await fetch();
          } catch (e: any) {
            Alert.alert('Error', formatApiError(e, 'Could not reject bid.'));
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
      Alert.alert('Error', formatApiError(e, 'Could not submit rating.'));
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
        <EmptyState emoji="❌" title="Load not found" subtitle="This load may have been deleted." />
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
          <Text style={styles.backText}>‹ Back</Text>
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
          <Row label="Truck Type" value={load.truckTypeNeeded?.replace(/_/g, ' ')} />
          <Row label="Pickup Country" value={load.pickupCountry} />
          <Row label="Delivery Country" value={load.deliveryCountry} />
          <Row label="Offered Price" value={formatPrice(load.offeredPrice, load.currency)} bold />
          {load.description && <Row label="Notes" value={load.description} />}
        </View>

        {/* Sender-facing dispatch status card (broker-pivot replacement for the bids panel) */}
        {isLookingForTruck && (
          <View style={styles.statusCard}>
            <Text style={styles.statusEmoji}>🔍</Text>
            <Text style={styles.statusTitle}>Finding you a truck</Text>
            <Text style={styles.statusBody}>
              A broker is matching your load with the right truck. You'll be notified as soon as one is dispatched.
            </Text>
          </View>
        )}

        {dispatchedBooking && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusEmoji}>🚛</Text>
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
                <Text style={styles.statusLabel}>Owner</Text>
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
                    >
                      <Text style={styles.callBtnText}>📞</Text>
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
            <Text style={styles.trackBtnText}>Track Shipment</Text>
          </TouchableOpacity>
        )}

        {/* BIDS — hidden during broker pivot (P2). Section renders only when BIDDING_ENABLED. */}
        {BIDDING_ENABLED && (<>
        <Text style={styles.sectionLabel}>BIDS ({bids.length})</Text>

        {bids.length === 0 ? (
          <EmptyState emoji="🤝" title="No bids yet" subtitle="Truck owners will place bids on this load." />
        ) : (
          bids.map(bid => (
            <View key={bid.id} style={styles.bidCard}>
              <View style={styles.bidHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bidOwner}>{bid.truckOwner?.fullName || 'Owner'}</Text>
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
                      <Text style={styles.callBtnText}>📞 Call</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Chat', {
                      userId: bid.truckOwner?.id,
                      userName: bid.truckOwner?.fullName || 'Owner',
                      phone: bid.truckOwner?.phone,
                    })}
                    style={styles.msgBtn}
                  >
                    <Text style={styles.msgBtnText}>💬 Message</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.bidMeta}>
                <Text style={styles.bidPrice}>{formatPrice(bid.price, load.currency)}</Text>
                {bid.message && <Text style={styles.bidNote}>{bid.message}</Text>}
              </View>

              {/* Actions for pending bids */}
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
                      : <Text style={styles.acceptText}>Accept</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}

              {/* Rating once the delivery booking is complete */}
              {bid.status === 'ACCEPTED' && load.status === 'DELIVERED' && activeBooking && !activeBooking.senderRating && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.rateLabel}>Rate this delivery:</Text>
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
  back:         { padding: 4 },
  backText:     { fontSize: 15, color: theme.accent, fontWeight: '500' },
  content:      { padding: 16, paddingBottom: 40 },
  title:        { fontSize: 22, fontWeight: '500', color: theme.text, marginBottom: 4 },
  route:        { fontSize: 14, color: theme.textMuted, marginBottom: 16 },
  card:         { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 12, marginTop: 8 },
  trackBtn:     { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 20 },
  trackBtnText: { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
  statusCard:   { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: theme.border },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  statusEmoji:  { fontSize: 22 },
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
  callBtn:      { backgroundColor: theme.accentDim, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 0.5, borderColor: theme.accentBorder },
  callBtnText:  { fontSize: 11, fontWeight: '500', color: theme.accent },
  msgBtn:       { backgroundColor: theme.blueDim, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 0.5, borderColor: theme.blue },
  msgBtnText:   { fontSize: 11, fontWeight: '500', color: theme.blue },
});
