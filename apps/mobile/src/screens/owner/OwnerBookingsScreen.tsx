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
import { FilterPill } from '../../components/FilterPill';
import { NotificationBell } from '../../components/NotificationBell';

const FILTERS = ['ALL', 'PENDING', 'ACCEPTED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED'];

export default function OwnerBookingsScreen({ navigation, route }: any) {
  const initialFilter = route?.params?.filter || 'ALL';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(initialFilter);

  const fetch = useCallback(async () => {
    try {
      const [bookRes, bidRes] = await Promise.all([
        api.get('/bookings/my').catch(() => ({ data: { bookings: [] } })),
        api.get('/bids/my').catch(() => ({ data: { bids: [] } })),
      ]);
      const bookings = (bookRes.data?.bookings || []).map((b: any) => ({ ...b, _isBid: false, price: b.agreedPrice }));
      const bids = (bidRes.data?.bids || []).map((b: any) => ({ ...b, _isBid: true, price: b.price, truck: b.truck ? { plateNumber: b.truck.plateNumber, truckType: b.truck.truckType } : null }));
      // Merge: bids that are PENDING/REJECTED, bookings for everything else
      const pendingBids = bids.filter((b: any) => b.status === 'PENDING' || b.status === 'REJECTED');
      setItems([...bookings, ...pendingBids].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.warn('Fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const onRefresh = () => { setRefreshing(true); fetch(); };

  // bookings is now items for backward compat in render
  const bookings = items;

  const filtered = filter === 'ALL' ? bookings : bookings.filter((b: any) => b.status === filter);

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Bookings</Text>
          <Text style={styles.subtitle}>Loads you've booked or accepted.</Text>
        </View>
        <NotificationBell navigation={navigation} />
      </View>

      {/* Filters */}
      <View style={styles.filterWrap}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={i => i}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <FilterPill
              label={item.replace(/_/g, ' ')}
              active={filter === item}
              onPress={() => setFilter(item)}
            />
          )}
        />
      </View>

      {loading ? (
        <SkeletonList count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title={filter === 'ALL' ? 'No bookings yet' : `No ${filter.toLowerCase().replace(/_/g, ' ')} bookings`}
          subtitle={filter === 'ALL'
            ? "When you book a load or a broker dispatches one to your truck, it'll show up here."
            : "Try a different filter to see other bookings."}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })} activeOpacity={0.8}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loadTitle} numberOfLines={1}>{item.load?.title}</Text>
                    <Text style={styles.loadRoute}>{item.load?.pickupCity} → {item.load?.deliveryCity}</Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.truckPlate}>{item.truck?.plateNumber}{item._isBid ? ' · Pending' : ''}</Text>
                  <Text style={styles.bidPrice}>{formatPrice(item.price, item.currency || item.load?.currency || 'ETB')}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:         { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title:          { fontSize: 22, fontWeight: '700', color: theme.text, fontFamily: 'Inter_700Bold' },
  subtitle:       { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  filterWrap:     { height: 52, justifyContent: 'center' },
  filterRow:      { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  list:           { padding: 16, paddingTop: 4 },
  card:           { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  cardTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  loadTitle:      { fontSize: 14, fontWeight: '500', color: theme.text },
  loadRoute:      { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  cardMeta:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: theme.border, paddingTop: 10 },
  truckPlate:     { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  bidPrice:       { fontSize: 15, fontWeight: '500', color: theme.accent },
});
