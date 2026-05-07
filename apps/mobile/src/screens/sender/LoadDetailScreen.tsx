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

export default function LoadDetailScreen({ route, navigation }: any) {
  const { loadId } = route.params;
  const [load, setLoad] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const [loadRes, bidsRes] = await Promise.all([
        api.get(`/loads/${loadId}`),
        api.get(`/bids/load/${loadId}`),
      ]);
      setLoad(loadRes.data?.load || loadRes.data);
      setBids(bidsRes.data?.bids || bidsRes.data || []);
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

        {/* Track button if in transit */}
        {(load.status === 'IN_TRANSIT' || load.status === 'BOOKED') && activeBooking && (
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => navigation.navigate('Tracking', { bookingId: activeBooking.id })}
          >
            <Text style={styles.trackBtnText}>Track Shipment</Text>
          </TouchableOpacity>
        )}

        {/* BIDS */}
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
  bidCard:      { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  bidHeader:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  bidOwner:     { fontSize: 14, fontWeight: '500', color: theme.text },
  bidTruck:     { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  bidMeta:      { gap: 4 },
  bidPrice:     { fontSize: 15, fontWeight: '500', color: theme.accent },
  bidNote:      { fontSize: 13, color: theme.textMuted, fontStyle: 'italic' },
  bidActions:   { flexDirection: 'row', gap: 10, marginTop: 14 },
  rejectBtn:    { flex: 1, backgroundColor: 'rgba(226,75,74,0.12)', borderWidth: 0.5, borderColor: 'rgba(226,75,74,0.35)', borderRadius: 10, padding: 10, alignItems: 'center' },
  rejectText:   { color: theme.danger, fontSize: 13, fontWeight: '500' },
  acceptBtn:    { flex: 1, backgroundColor: theme.accent, borderRadius: 10, padding: 10, alignItems: 'center' },
  acceptText:   { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
  rateLabel:    { fontSize: 13, color: theme.textMuted, marginBottom: 6 },
  callBtn:      { backgroundColor: theme.accentDim, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(151,196,89,0.35)' },
  callBtnText:  { fontSize: 11, fontWeight: '500', color: theme.accent },
  msgBtn:       { backgroundColor: 'rgba(55,138,221,0.12)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(55,138,221,0.35)' },
  msgBtnText:   { fontSize: 11, fontWeight: '500', color: theme.blue },
});
