import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl, Alert, ActivityIndicator, Linking, Modal,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { StatusBadge } from '../../components/StatusBadge';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { StarRating } from '../../components/StarRating';
import { AppInput } from '../../components/AppInput';
import { formatPrice } from '../../lib/constants';
import { formatApiError } from '../../lib/errors';
import { useAuthStore } from '../../store/auth';

export default function BookingDetailScreen({ navigation, route }: any) {
  const { user } = useAuthStore();
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Assign-driver modal state
  const [assignOpen, setAssignOpen] = useState(false);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);

  // Rating form state
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  const fetchBooking = useCallback(async () => {
    try {
      const res = await api.get(`/bookings/${bookingId}`);
      setBooking(res.data?.booking || res.data);
    } catch (e) {
      console.warn('Booking fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  const onRefresh = () => { setRefreshing(true); fetchBooking(); };

  const doPatch = async (key: string, url: string, body?: any) => {
    setActionLoading(key);
    try {
      await api.patch(url, body);
      await fetchBooking();
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e, 'Could not complete action.'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = () => doPatch('accept', `/bookings/${bookingId}/accept`);

  const handleReject = () => {
    Alert.alert('Reject Booking', 'Are you sure you want to reject this booking?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => doPatch('reject', `/bookings/${bookingId}/reject`) },
    ]);
  };

  const handleStart = () => doPatch('start', `/bookings/${bookingId}/start`);

  const handleDeliver = () => {
    Alert.alert('Mark Delivered', 'Confirm cargo has been delivered.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Delivered', onPress: () => doPatch('deliver', `/bookings/${bookingId}/deliver`) },
    ]);
  };

  const openAssign = async () => {
    setAssignOpen(true);
    setDriversLoading(true);
    try {
      const res = await api.get('/drivers');
      setDrivers(res.data?.drivers || []);
    } catch {
      setDrivers([]);
    } finally {
      setDriversLoading(false);
    }
  };

  const handleAssign = (driverId: string) => {
    setAssignOpen(false);
    doPatch('assign', `/bookings/${bookingId}/assign-driver`, { driverId });
  };

  const handleRate = () => {
    if (ratingValue < 1) {
      Alert.alert('Rating required', 'Please tap a star (1–5) before submitting.');
      return;
    }
    doPatch('rate', `/bookings/${bookingId}/rate`, {
      rating: ratingValue,
      comment: ratingComment.trim() || undefined,
    });
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
        <SkeletonList count={4} />
      </ScreenWrapper>
    );
  }

  if (!booking) {
    return (
      <ScreenWrapper>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
        <EmptyState emoji="📋" title="Booking not found" subtitle="This booking may have been removed." />
      </ScreenWrapper>
    );
  }

  const isSender = user?.id === booking.senderId;
  const isOwner  = user?.id === booking.ownerId;
  const isDriver = user?.id === booking.driverId;
  const status   = booking.status;

  // Counterparty phones — sender sees owner/driver; owner/driver sees sender
  const callTargets: { label: string; phone: string }[] = [];
  if (isSender) {
    if (booking.owner?.phone)  callTargets.push({ label: 'Call Owner',  phone: booking.owner.phone });
    if (booking.driver?.phone) callTargets.push({ label: 'Call Driver', phone: booking.driver.phone });
  } else if (isOwner || isDriver) {
    if (booking.sender?.phone) callTargets.push({ label: 'Call Sender', phone: booking.sender.phone });
  }

  // Rating eligibility — mirror backend rules in booking.controller.ts:rateBooking
  const canRateAsSender = isSender && status === 'COMPLETED' && !booking.senderRatedAt;
  const canRateAsOwner  = isOwner  && status === 'COMPLETED' && !booking.ownerRatedAt;
  const canRate = canRateAsSender || canRateAsOwner;
  const existingMyRating  = isSender ? booking.senderRating  : isOwner ? booking.ownerRating  : null;
  const existingMyComment = isSender ? booking.senderComment : isOwner ? booking.ownerComment : null;
  const showRatingSection = canRate || existingMyRating != null;

  // Action availability — must match the backend's status + role checks exactly
  const showAcceptReject = isSender && status === 'PENDING';
  const showStart        = (isOwner || isDriver) && status === 'ACCEPTED';
  const showAssignDriver = isOwner && status === 'ACCEPTED';
  const showDeliver      = (isOwner || isDriver) && status === 'IN_TRANSIT';

  const anyActionLoading = actionLoading !== null;

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking</Text>
        <StatusBadge status={status} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        {/* Load info */}
        <View style={styles.card}>
          <Text style={styles.loadTitle}>{booking.load?.title || 'Load'}</Text>
          <Text style={styles.route}>{booking.load?.pickupCity} → {booking.load?.deliveryCity}</Text>
          <View style={styles.divider} />
          <Row label="Weight"     value={`${booking.load?.weightTons ?? '—'}t`} />
          <Row label="Truck Type" value={booking.load?.truckTypeNeeded?.replace(/_/g, ' ') || '—'} />
          <Row label="Truck"      value={booking.truck?.plateNumber || '—'} />
          <Row label="Price"      value={formatPrice(booking.agreedPrice, booking.currency)} accent />
          {booking.driver?.fullName && <Row label="Driver" value={booking.driver.fullName} />}
        </View>

        {/* Contact */}
        {callTargets.length > 0 && (
          <View style={styles.callRow}>
            {callTargets.map(t => (
              <TouchableOpacity
                key={t.phone}
                style={styles.callBtn}
                onPress={() => Linking.openURL('tel:' + t.phone)}
              >
                <Text style={styles.callBtnText}>📞 {t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Payment — only when the API returned one */}
        {booking.payment && (
          <>
            <Text style={styles.sectionLabel}>PAYMENT</Text>
            <View style={styles.card}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentAmount}>
                  {formatPrice(booking.payment.amount, booking.payment.currency)}
                </Text>
                <StatusBadge status={booking.payment.status} />
              </View>
              {booking.payment.method && (
                <Row label="Method" value={String(booking.payment.method).replace(/_/g, ' ')} />
              )}
              {booking.payment.paidAt && (
                <Row label="Paid" value={new Date(booking.payment.paidAt).toLocaleString()} />
              )}
            </View>
          </>
        )}

        {/* Timeline */}
        <Text style={styles.sectionLabel}>TIMELINE</Text>
        <View style={styles.card}>
          <TimelineStep
            label="Booking created"
            timestamp={booking.createdAt}
            done
          />
          <TimelineStep
            label="Accepted"
            done={['ACCEPTED','IN_TRANSIT','COMPLETED','DELIVERED'].includes(status)}
          />
          <TimelineStep
            label="In transit"
            timestamp={booking.pickedUpAt}
            done={['IN_TRANSIT','COMPLETED','DELIVERED'].includes(status)}
          />
          <TimelineStep
            label="Delivered"
            timestamp={booking.deliveredAt}
            done={['COMPLETED','DELIVERED'].includes(status)}
            last
          />
        </View>

        {/* Track (kept from prior implementation) */}
        {(status === 'ACCEPTED' || status === 'IN_TRANSIT') && (
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => navigation.navigate('Tracking', { bookingId })}
          >
            <Text style={styles.trackBtnText}>Track Shipment →</Text>
          </TouchableOpacity>
        )}

        {/* Sender: Accept / Reject */}
        {showAcceptReject && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.rejectBtn, anyActionLoading && { opacity: 0.5 }]}
              onPress={handleReject}
              disabled={anyActionLoading}
            >
              {actionLoading === 'reject'
                ? <ActivityIndicator size="small" color={theme.danger} />
                : <Text style={styles.rejectText}>Reject</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptBtn, anyActionLoading && { opacity: 0.5 }]}
              onPress={handleAccept}
              disabled={anyActionLoading}
            >
              {actionLoading === 'accept'
                ? <ActivityIndicator size="small" color={theme.darkGreen} />
                : <Text style={styles.acceptText}>Accept</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Owner/Driver: Start Journey */}
        {showStart && (
          <TouchableOpacity
            style={[styles.primaryBtn, anyActionLoading && { opacity: 0.5 }]}
            onPress={handleStart}
            disabled={anyActionLoading}
          >
            {actionLoading === 'start'
              ? <ActivityIndicator size="small" color={theme.darkGreen} />
              : <Text style={styles.primaryBtnText}>Start Journey</Text>}
          </TouchableOpacity>
        )}

        {/* Owner: Assign / Reassign Driver */}
        {showAssignDriver && (
          <TouchableOpacity
            style={[styles.secondaryBtn, anyActionLoading && { opacity: 0.5 }]}
            onPress={openAssign}
            disabled={anyActionLoading}
          >
            {actionLoading === 'assign'
              ? <ActivityIndicator size="small" color={theme.accent} />
              : (
                <Text style={styles.secondaryBtnText}>
                  {booking.driver?.fullName ? 'Reassign Driver' : 'Assign Driver'}
                </Text>
              )}
          </TouchableOpacity>
        )}

        {/* Owner/Driver: Mark Delivered */}
        {showDeliver && (
          <TouchableOpacity
            style={[styles.primaryBtn, anyActionLoading && { opacity: 0.5 }]}
            onPress={handleDeliver}
            disabled={anyActionLoading}
          >
            {actionLoading === 'deliver'
              ? <ActivityIndicator size="small" color={theme.darkGreen} />
              : <Text style={styles.primaryBtnText}>Mark Delivered</Text>}
          </TouchableOpacity>
        )}

        {/* Rating — form when eligible, read-only when already submitted */}
        {showRatingSection && (
          <>
            <Text style={styles.sectionLabel}>{canRate ? 'RATE THIS DELIVERY' : 'YOUR RATING'}</Text>
            <View style={styles.card}>
              <View style={styles.ratingStarsWrap}>
                <StarRating
                  value={canRate ? ratingValue : (existingMyRating || 0)}
                  onChange={canRate ? setRatingValue : undefined}
                  size={28}
                />
              </View>
              {canRate ? (
                <>
                  <AppInput
                    placeholder="Optional comment"
                    value={ratingComment}
                    onChangeText={setRatingComment}
                    multiline
                    style={styles.ratingInput}
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtn, styles.ratingSubmit, anyActionLoading && { opacity: 0.5 }]}
                    onPress={handleRate}
                    disabled={anyActionLoading}
                  >
                    {actionLoading === 'rate'
                      ? <ActivityIndicator size="small" color={theme.darkGreen} />
                      : <Text style={styles.primaryBtnText}>Submit Rating</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                existingMyComment ? <Text style={styles.commentText}>"{existingMyComment}"</Text> : null
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Assign Driver modal */}
      <Modal
        visible={assignOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Driver</Text>
              <TouchableOpacity onPress={() => setAssignOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {driversLoading ? (
              <SkeletonList count={3} />
            ) : drivers.length === 0 ? (
              <EmptyState
                emoji="🚛"
                title="No drivers available"
                subtitle="Invite drivers to your fleet first."
                buttonLabel="Manage Drivers"
                onButton={() => { setAssignOpen(false); navigation.navigate('Drivers'); }}
              />
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                {drivers.map(d => (
                  <TouchableOpacity key={d.id} style={styles.driverRow} onPress={() => handleAssign(d.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverName}>{d.fullName || '—'}</Text>
                      <Text style={styles.driverMeta}>
                        {d.phone}{d.licenseNumber ? ` · ${d.licenseNumber}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.driverChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={rowS.row}>
      <Text style={rowS.label}>{label}</Text>
      <Text style={[rowS.value, accent && { color: theme.accent }]}>{value}</Text>
    </View>
  );
}

function TimelineStep({
  label, timestamp, done, last,
}: { label: string; timestamp?: string | null; done: boolean; last?: boolean }) {
  return (
    <View style={tlS.step}>
      <View style={tlS.dotCol}>
        <View style={[tlS.dot, done && tlS.dotDone]} />
        {!last && <View style={[tlS.line, done && tlS.lineDone]} />}
      </View>
      <View style={tlS.labelCol}>
        <Text style={[tlS.label, done && tlS.labelDone]}>{label}</Text>
        {done && timestamp && (
          <Text style={tlS.timestamp}>{new Date(timestamp).toLocaleString()}</Text>
        )}
      </View>
    </View>
  );
}

const rowS = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  label: { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  value: { fontSize: 13, color: theme.text, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
});

const tlS = StyleSheet.create({
  step:      { flexDirection: 'row', alignItems: 'flex-start' },
  dotCol:    { width: 20, alignItems: 'center', marginRight: 10 },
  dot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.border, marginTop: 2 },
  dotDone:   { backgroundColor: theme.accent },
  line:      { width: 2, flex: 1, minHeight: 24, backgroundColor: theme.surface2, marginVertical: 2 },
  lineDone:  { backgroundColor: theme.accentDim },
  labelCol:  { flex: 1, paddingBottom: 14 },
  label:     { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  labelDone: { color: theme.text, fontWeight: '500' },
  timestamp: { fontSize: 11, color: theme.textMuted, marginTop: 2, fontWeight: '400' },
});

const styles = StyleSheet.create({
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backText:         { fontSize: 15, color: theme.accent, fontWeight: '500' },
  headerTitle:      { fontSize: 15, fontWeight: '500', color: theme.text },
  content:          { padding: 16, paddingBottom: 40 },
  card:             { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 16 },
  loadTitle:        { fontSize: 15, fontWeight: '500', color: theme.text, marginBottom: 4 },
  route:            { fontSize: 13, color: theme.textMuted, marginBottom: 12, fontWeight: '400' },
  divider:          { height: 0.5, backgroundColor: theme.border, marginBottom: 8 },
  sectionLabel:     { fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10, marginLeft: 4 },

  callRow:          { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  callBtn:          { backgroundColor: theme.accentDim, borderWidth: 0.5, borderColor: theme.accentBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, flexGrow: 1, alignItems: 'center' },
  callBtnText:      { fontSize: 13, fontWeight: '500', color: theme.accent },

  paymentHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  paymentAmount:    { fontSize: 18, fontWeight: '600', color: theme.text },

  trackBtn:         { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 16 },
  trackBtnText:     { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },

  actionRow:        { flexDirection: 'row', gap: 10, marginBottom: 16 },
  rejectBtn:        { flex: 1, backgroundColor: theme.dangerDim, borderWidth: 0.5, borderColor: theme.danger, borderRadius: 10, padding: 12, alignItems: 'center' },
  rejectText:       { color: theme.danger, fontSize: 13, fontWeight: '500' },
  acceptBtn:        { flex: 1, backgroundColor: theme.accent, borderRadius: 10, padding: 12, alignItems: 'center' },
  acceptText:       { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },

  primaryBtn:       { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 12 },
  primaryBtnText:   { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
  secondaryBtn:     { backgroundColor: theme.accentDim, borderWidth: 0.5, borderColor: theme.accentBorder, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 16 },
  secondaryBtnText: { color: theme.accent, fontSize: 13, fontWeight: '500' },

  ratingStarsWrap:  { alignItems: 'center', marginBottom: 14 },
  ratingInput:      { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  ratingSubmit:     { marginTop: 12, marginBottom: 0 },
  commentText:      { fontSize: 13, color: theme.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },

  modalBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:        { backgroundColor: theme.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 32, maxHeight: '85%' },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle:       { fontSize: 16, fontWeight: '500', color: theme.text },
  modalClose:       { fontSize: 20, color: theme.textMuted, paddingHorizontal: 6 },

  driverRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  driverName:      { fontSize: 14, fontWeight: '500', color: theme.text },
  driverMeta:      { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  driverChevron:   { fontSize: 22, color: theme.textMuted, marginLeft: 8 },
});
