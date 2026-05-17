import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { formatPrice } from '../../lib/constants';
import { StatusBadge } from '../../components/StatusBadge';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { StarRating } from '../../components/StarRating';
import { NotificationBell } from '../../components/NotificationBell';
import { formatApiError } from '../../lib/errors';

const FILTERS = ['ALL', 'PENDING', 'ACCEPTED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED'];

export default function OwnerBookingsScreen({ navigation, route }: any) {
  const initialFilter = route?.params?.filter || 'ALL';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(initialFilter);
  const [expanded, setExpanded] = useState<string | null>(null);

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

  const handleRate = async (bookingId: string, rating: number) => {
    try {
      await api.patch(`/bookings/${bookingId}/rate`, { rating });
      await fetch();
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e, 'Could not submit rating.'));
    }
  };

  const filtered = filter === 'ALL' ? bookings : bookings.filter((b: any) => b.status === filter);

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
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
            <TouchableOpacity
              style={[styles.chip, filter === item && styles.chipActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>{item.replace(/_/g, ' ')}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <SkeletonList count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji="📋"
          title={filter === 'ALL' ? 'No bookings yet' : `No ${filter} bookings`}
          subtitle="Your bids and accepted bookings will appear here."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          renderItem={({ item }) => {
            const isExpanded = expanded === item.id;
            return (
              <View style={styles.card}>
                <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : item.id)} activeOpacity={0.8}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.loadTitle} numberOfLines={1}>{item.load?.title}</Text>
                      <Text style={styles.loadRoute}>{item.load?.pickupCity} → {item.load?.deliveryCity}</Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={styles.truckPlate}>{item.truck?.plateNumber}{item._isBid ? ' · Bid' : ''}</Text>
                    <Text style={styles.bidPrice}>{formatPrice(item.price, item.currency || item.load?.currency || 'ETB')}</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.expanded}>
                    {item.message && (
                      <View style={styles.noteBox}>
                        <Text style={styles.noteLabel}>Your note:</Text>
                        <Text style={styles.noteText}>{item.message}</Text>
                      </View>
                    )}

                    {/* ACCEPTED: show driver assignment state */}
                    {item.status === 'ACCEPTED' && !item._isBid && (
                      <View style={{ marginTop: 10 }}>
                        {!item.driverId ? (
                          <TouchableOpacity
                            style={styles.assignBtn}
                            onPress={() => navigation.navigate('Drivers', { bookingId: item.id })}
                          >
                            <Text style={styles.assignBtnText}>Assign Driver</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.awaitingBox}>
                            {item.driver?.fullName && (
                              <View style={styles.driverChip}>
                                <Text style={styles.driverChipText}>{item.driver.fullName}</Text>
                              </View>
                            )}
                            <Text style={styles.awaitingText}>Awaiting driver to start</Text>
                            <TouchableOpacity
                              style={styles.trackBtn}
                              onPress={() => navigation.navigate('Tracking', { bookingId: item.id })}
                            >
                              <Text style={styles.trackBtnText}>Track →</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}

                    {/* IN_TRANSIT: show live status + track */}
                    {item.status === 'IN_TRANSIT' && !item._isBid && (
                      <View style={{ marginTop: 10, gap: 10 }}>
                        {item.driver?.fullName && (
                          <View style={styles.driverChip}>
                            <Text style={styles.driverChipText}>{item.driver.fullName}</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.trackBtn}
                          onPress={() => navigation.navigate('Tracking', { bookingId: item.id })}
                        >
                          <Text style={styles.trackBtnText}>Track →</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Rate */}
                    {(item.status === 'COMPLETED' || item.status === 'DELIVERED') && !item.ownerRating && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.rateLabel}>Rate this cargo sender:</Text>
                        <StarRating value={0} onChange={r => handleRate(item.id, r)} />
                      </View>
                    )}
                    {item.ownerRating && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={styles.rateLabel}>Your rating:</Text>
                        <StarRating value={item.ownerRating} />
                      </View>
                    )}
                  </View>
                )}
              </View>
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
  filterWrap:     { height: 52, justifyContent: 'center' },
  filterRow:      { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip:           { height: 36, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface2 },
  chipActive:     { backgroundColor: theme.accent },
  chipText:       { fontSize: 13, fontWeight: '500', color: theme.textMuted },
  chipTextActive: { color: theme.darkGreen, fontWeight: '500' },
  list:           { padding: 16, paddingTop: 4 },
  card:           { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  cardTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  loadTitle:      { fontSize: 14, fontWeight: '500', color: theme.text },
  loadRoute:      { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  cardMeta:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: theme.border, paddingTop: 10 },
  truckPlate:     { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  bidPrice:       { fontSize: 15, fontWeight: '500', color: theme.accent },
  expanded:       { marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: theme.border },
  noteBox:        { backgroundColor: theme.surface2, borderRadius: 8, padding: 10 },
  noteLabel:      { fontSize: 11, color: theme.textMuted, fontWeight: '500', marginBottom: 4 },
  noteText:       { fontSize: 13, color: theme.text },
  trackBtn:       { backgroundColor: theme.blueDim, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: theme.blue },
  trackBtnText:   { color: theme.blue, fontSize: 14, fontWeight: '500' },
  assignBtn:      { backgroundColor: theme.warningDim, borderRadius: 10, padding: 13, alignItems: 'center', borderWidth: 0.5, borderColor: theme.warning },
  assignBtnText:  { color: theme.warning, fontSize: 14, fontWeight: '500' },
  awaitingBox:    { gap: 8, alignItems: 'center' },
  awaitingText:   { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  driverChip:     { backgroundColor: theme.blueDim, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
  driverChipText: { fontSize: 13, color: theme.blue, fontWeight: '500' },
  rateLabel:      { fontSize: 13, color: theme.textMuted, marginBottom: 6 },
});
