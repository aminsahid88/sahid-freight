// TODO: implement full booking detail with route map, timeline, documents, payment status
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { StatusBadge } from '../../components/StatusBadge';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { formatPrice } from '../../lib/constants';

export default function BookingDetailScreen({ navigation, route }: any) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/bookings/${bookingId}`);
        setBooking(res.data?.booking || res.data);
      } catch {
        console.warn('Could not load booking');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [bookingId]);

  if (loading) {
    return <ScreenWrapper><SkeletonList count={4} /></ScreenWrapper>;
  }

  if (!booking) {
    return (
      <ScreenWrapper>
        <EmptyState emoji="📋" title="Booking not found" subtitle="This booking may have been removed." />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking</Text>
        <StatusBadge status={booking.status} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Load info */}
        <View style={styles.card}>
          <Text style={styles.loadTitle}>{booking.load?.title || 'Load'}</Text>
          <Text style={styles.route}>{booking.load?.pickupCity} → {booking.load?.deliveryCity}</Text>
          <View style={styles.divider} />
          <Row label="Weight" value={`${booking.load?.weightTons || '—'}t`} />
          <Row label="Truck Type" value={booking.load?.truckTypeNeeded?.replace(/_/g, ' ') || '—'} />
          <Row label="Truck" value={booking.truck?.plateNumber || '—'} />
          <Row label="Price" value={formatPrice(booking.agreedPrice, booking.currency)} accent />
          {booking.driver?.fullName && <Row label="Driver" value={booking.driver.fullName} />}
        </View>

        {/* Timeline */}
        <Text style={styles.sectionLabel}>TIMELINE</Text>
        <View style={styles.card}>
          <TimelineStep label="Booking created" done />
          <TimelineStep label="Accepted" done={['ACCEPTED','IN_TRANSIT','COMPLETED','DELIVERED'].includes(booking.status)} />
          <TimelineStep label="In transit" done={['IN_TRANSIT','COMPLETED','DELIVERED'].includes(booking.status)} />
          <TimelineStep label="Delivered" done={['COMPLETED','DELIVERED'].includes(booking.status)} last />
        </View>

        {/* Actions */}
        {(booking.status === 'ACCEPTED' || booking.status === 'IN_TRANSIT') && (
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => navigation.navigate('Tracking', { bookingId })}
          >
            <Text style={styles.trackBtnText}>Track Shipment →</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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

function TimelineStep({ label, done, last }: { label: string; done: boolean; last?: boolean }) {
  return (
    <View style={tlS.step}>
      <View style={tlS.dotCol}>
        <View style={[tlS.dot, done && tlS.dotDone]} />
        {!last && <View style={[tlS.line, done && tlS.lineDone]} />}
      </View>
      <Text style={[tlS.label, done && tlS.labelDone]}>{label}</Text>
    </View>
  );
}

const rowS = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  label: { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  value: { fontSize: 13, color: theme.text, fontWeight: '500' },
});

const tlS = StyleSheet.create({
  step:      { flexDirection: 'row', alignItems: 'flex-start' },
  dotCol:    { width: 20, alignItems: 'center', marginRight: 10 },
  dot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 2 },
  dotDone:   { backgroundColor: theme.accent },
  line:      { width: 2, flex: 1, minHeight: 24, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 2 },
  lineDone:  { backgroundColor: theme.accentDim },
  label:     { fontSize: 13, color: theme.textMuted, fontWeight: '400', paddingBottom: 12 },
  labelDone: { color: theme.text, fontWeight: '500' },
});

const styles = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backText:    { fontSize: 15, color: theme.accent, fontWeight: '500' },
  headerTitle: { fontSize: 15, fontWeight: '500', color: theme.text },
  content:     { padding: 16, paddingBottom: 40 },
  card:        { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 16 },
  loadTitle:   { fontSize: 15, fontWeight: '500', color: theme.text, marginBottom: 4 },
  route:       { fontSize: 13, color: theme.textMuted, marginBottom: 12, fontWeight: '400' },
  divider:     { height: 0.5, backgroundColor: theme.border, marginBottom: 8 },
  sectionLabel:{ fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10, marginLeft: 4 },
  trackBtn:    { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  trackBtnText:{ color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
