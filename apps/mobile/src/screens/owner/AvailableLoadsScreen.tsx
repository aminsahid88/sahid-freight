import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, TextInput,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { TRUCK_TYPES } from '../../lib/constants';
import { LoadCard } from '../../components/LoadCard';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { NotificationBell } from '../../components/NotificationBell';
import { theme } from '../../theme';

export default function AvailableLoadsScreen({ navigation }: any) {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [truckFilter, setTruckFilter] = useState('ALL');

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/loads');
      setLoads(res.data?.loads || res.data || []);
    } catch (e) {
      console.warn('Fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const onRefresh = () => { setRefreshing(true); fetch(); };

  const filtered = loads.filter(l => {
    const matchSearch = !search.trim() ||
      l.title?.toLowerCase().includes(search.toLowerCase()) ||
      l.pickupCity?.toLowerCase().includes(search.toLowerCase()) ||
      l.deliveryCity?.toLowerCase().includes(search.toLowerCase());
    const matchTruck = truckFilter === 'ALL' || l.truckTypeNeeded === truckFilter;
    return matchSearch && matchTruck && l.status === 'OPEN';
  });

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <View style={styles.header}>
        <Text style={styles.title}>Available Loads</Text>
        <NotificationBell navigation={navigation} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search loads, cities..."
          placeholderTextColor={theme.textMuted}
        />
      </View>

      {/* Truck type filter */}
      <View style={styles.filterWrap}>
        <FlatList
          horizontal
          data={['ALL', ...TRUCK_TYPES]}
          keyExtractor={i => i}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, truckFilter === item && styles.chipActive]}
              onPress={() => setTruckFilter(item)}
            >
              <Text style={[styles.chipText, truckFilter === item && styles.chipTextActive]}>
                {item.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No loads found"
          subtitle="Try adjusting your search or filters. Check back later for new loads."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          renderItem={({ item }) => (
            <LoadCard
              load={item}
              onPress={() => navigation.navigate('LoadBid', { loadId: item.id })}
            />
          )}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:         { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:          { fontSize: 22, fontWeight: '500', color: theme.text },
  searchWrap:     { paddingHorizontal: 16, marginBottom: 10 },
  searchInput:    { backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: theme.text },
  filterWrap:     { height: 52, justifyContent: 'center', marginBottom: 4 },
  filterRow:      { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip:           { height: 36, borderRadius: 999, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  chipActive:     { backgroundColor: theme.accent },
  chipText:       { fontSize: 13, fontWeight: '500', color: theme.textMuted },
  chipTextActive: { color: theme.darkGreen, fontWeight: '500' },
  list:           { padding: 16, paddingTop: 4 },
});
