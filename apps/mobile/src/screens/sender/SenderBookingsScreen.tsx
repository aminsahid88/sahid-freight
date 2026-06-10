import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { formatPrice } from '../../lib/constants';
import { StatusBadge } from '../../components/StatusBadge';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { NotificationBell } from '../../components/NotificationBell';

export default function SenderBookingsScreen({ navigation }: any) {
  const [loads, setLoads] = useState<any[]>([]);
  const [acceptedBookings, setAcceptedBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const [loadsRes, bookingsRes] = await Promise.allSettled([
        api.get('/loads/my'),
        api.get('/bookings/sender/my'),
      ]);
      if (loadsRes.status === 'fulfilled') {
        const allLoads = loadsRes.value.data?.loads || loadsRes.value.data || [];
        setLoads(allLoads.filter((l: any) => (l._count?.bids > 0) || ['BOOKED', 'IN_TRANSIT', 'DELIVERED'].includes(l.status)));
      }
      if (bookingsRes.status === 'fulfilled') {
        const all = bookingsRes.value.data?.bookings || [];
        setAcceptedBookings(all.filter((b: any) => ['ACCEPTED', 'IN_TRANSIT'].includes(b.status)));
      }
    } catch (e) {
      console.warn('Fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const onRefresh = () => { setRefreshing(true); fetch(); };

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <View style={styles.header}>
        <Text style={styles.title}>Bids & Bookings</Text>
        <NotificationBell navigation={navigation} />
      </View>

      {loading ? (
        <SkeletonList count={4} />
      ) : loads.length === 0 && acceptedBookings.length === 0 ? (
        <EmptyState
          emoji="🤝"
          title="No bids yet"
          subtitle="Once truck owners bid on your loads, you'll see them here."
        />
      ) : (
        <FlatList
          data={[
            ...acceptedBookings.map(b => ({ ...b, _type: 'booking' })),
            ...loads.map(l => ({ ...l, _type: 'load' })),
          ]}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          renderItem={({ item }) => {
            if (item._type === 'booking') {
              const pmt = item.payment;
              const isPaid = pmt?.status === 'COMPLETED';
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.load?.title}</Text>
                      <Text style={styles.cardRoute}>{item.load?.pickupCity} → {item.load?.deliveryCity}</Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.cardFooter}>
                    <Text style={styles.price}>{formatPrice(item.agreedPrice, item.currency || item.load?.currency || 'ETB')}</Text>
                    {isPaid ? (
                      <View style={styles.paidBadge}>
                        <Text style={styles.paidText}>✓ Paid</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.payBtn}
                        onPress={() => navigation.navigate('Payment', { bookingId: item.id })}
                      >
                        <Text style={styles.payBtnText}>💳 Make Payment</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {item.status === 'IN_TRANSIT' && (
                    <TouchableOpacity
                      style={styles.trackBtn}
                      onPress={() => navigation.navigate('Tracking', { bookingId: item.id })}
                    >
                      <Text style={styles.trackBtnText}>📍 Track Shipment</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('LoadDetail', { loadId: item.id })}
                activeOpacity={0.75}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.cardRoute}>{item.pickupCity} → {item.deliveryCity}</Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>
                <View style={styles.divider} />
                <View style={styles.cardFooter}>
                  <View style={styles.bidCountBadge}>
                    <Text style={styles.bidCountText}>
                      {item._count?.bids || 0} bid{item._count?.bids !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.price}>{formatPrice(item.offeredPrice, item.currency || 'ETB')}</Text>
                </View>
                {(item.status === 'IN_TRANSIT' || item.status === 'BOOKED') && (
                  <View style={styles.trackHint}>
                    <Text style={styles.trackHintText}>Tap to view details & track</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:         { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:          { fontSize: 22, fontWeight: '500', color: theme.text },
  list:           { padding: 16, paddingTop: 4 },
  card:           { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  cardHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle:      { fontSize: 14, fontWeight: '500', color: theme.text },
  cardRoute:      { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  divider:        { height: 0.5, backgroundColor: theme.border, marginVertical: 12 },
  cardFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bidCountBadge:  { backgroundColor: theme.warningDim, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: theme.warning },
  bidCountText:   { fontSize: 13, fontWeight: '500', color: theme.warning },
  price:          { fontSize: 15, fontWeight: '500', color: theme.accent },
  trackHint:      { marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: theme.border },
  trackHintText:  { fontSize: 13, color: theme.accent, fontWeight: '500', textAlign: 'center' },
  payBtn:         { backgroundColor: theme.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  payBtnText:     { fontSize: 13, fontWeight: '500', color: theme.darkGreen },
  paidBadge:      { backgroundColor: theme.accentDim, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 0.5, borderColor: theme.accentBorder },
  paidText:       { fontSize: 13, fontWeight: '500', color: theme.accent },
  trackBtn:       { marginTop: 10, backgroundColor: theme.blueDim, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: theme.blue },
  trackBtnText:   { color: theme.blue, fontSize: 14, fontWeight: '500' },
});
