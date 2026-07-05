import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { StatusBadge } from '../../components/StatusBadge';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { formatPrice } from '../../lib/constants';

export default function DriverHistoryScreen({ navigation }: any) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/bookings/driver/my');
      const all = res.data?.bookings || res.data || [];
      const completed = all.filter((b: any) => b.status === 'COMPLETED' || b.status === 'DELIVERED' || b.status === 'CANCELLED');
      setBookings(completed);
    } catch (e) {
      console.warn('History fetch error', e);
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
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Trip history</Text>
          <Text style={styles.subtitle}>Every load you've delivered.</Text>
        </View>
        <Text style={styles.count}>{bookings.length} completed</Text>
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon="check-circle"
          title="No completed trips yet"
          subtitle="Trips you've delivered will show up here."
        />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
              activeOpacity={0.75}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.load?.title || 'Load'}</Text>
                  <Text style={styles.cardRoute}>{item.load?.pickupCity} → {item.load?.deliveryCity}</Text>
                </View>
                <StatusBadge status={item.status} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.cardBottom}>
                <Text style={styles.cardTruck}>{item.truck?.plateNumber}</Text>
                <Text style={styles.cardPrice}>{formatPrice(item.agreedPrice, item.currency)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  title:       { fontSize: 22, fontWeight: '500', color: theme.text },
  subtitle:    { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  count:       { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  list:        { padding: 16, paddingTop: 4 },
  card:        { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  cardTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  cardTitle:   { fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 3 },
  cardRoute:   { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  cardDivider: { height: 0.5, backgroundColor: theme.border, marginBottom: 10 },
  cardBottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTruck:   { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  cardPrice:   { fontSize: 15, fontWeight: '500', color: theme.accent },
});
