import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, TextInput, Modal, Pressable, ScrollView,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { TRUCK_TYPES, COUNTRIES } from '../../lib/constants';
import { LoadCard } from '../../components/LoadCard';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { NotificationBell } from '../../components/NotificationBell';
import { theme } from '../../theme';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_desc', label: 'Highest paying' },
  { value: 'price_asc', label: 'Lowest price' },
  { value: 'departing_soonest', label: 'Departing soonest' },
];

export default function AvailableLoadsScreen({ navigation }: any) {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [truckFilter, setTruckFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [minWeight, setMinWeight] = useState('');
  const [maxWeight, setMaxWeight] = useState('');

  const fetchLoads = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (truckFilter !== 'ALL') params.truckType = truckFilter;
      if (countryFilter !== 'ALL') params.country = countryFilter;
      if (minWeight) params.minWeight = minWeight;
      if (maxWeight) params.maxWeight = maxWeight;
      if (sortBy !== 'newest') params.sort = sortBy;
      const res = await api.get('/loads', { params });
      setLoads(res.data?.loads || res.data || []);
    } catch (e) {
      console.warn('Fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [truckFilter, countryFilter, minWeight, maxWeight, sortBy]);

  useEffect(() => { fetchLoads(); }, [fetchLoads]);

  const onRefresh = () => { setRefreshing(true); fetchLoads(); };

  const filtered = loads.filter(l => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      l.title?.toLowerCase().includes(s) ||
      l.pickupCity?.toLowerCase().includes(s) ||
      l.deliveryCity?.toLowerCase().includes(s)
    );
  });

  const activeFilterCount = [
    countryFilter !== 'ALL',
    !!minWeight,
    !!maxWeight,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setCountryFilter('ALL');
    setMinWeight('');
    setMaxWeight('');
  };

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

      {/* Sort + Filter row */}
      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortPicker(true)}>
          <Text style={styles.sortIcon}>{"\u2195"}</Text>
          <Text style={styles.sortLabel}>{SORT_OPTIONS.find(s => s.value === sortBy)?.label}</Text>
          <Text style={styles.sortChevron}>{"\u25BC"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setShowFilterSheet(true)}
        >
          <Text style={styles.filterIcon}>{"\u2630"}</Text>
          <Text style={[styles.filterLabel, activeFilterCount > 0 && { color: theme.accent }]}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Truck type chips */}
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
          emoji="\u{1F50D}"
          title="No loads match your filters"
          subtitle="Try adjusting your search, sort, or filters. Check back later for new loads."
          buttonLabel={activeFilterCount > 0 ? "Clear Filters" : undefined}
          onButton={activeFilterCount > 0 ? clearFilters : undefined}
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

      {/* Sort picker modal */}
      <Modal visible={showSortPicker} transparent animationType="fade" onRequestClose={() => setShowSortPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSortPicker(false)} />
        <View style={styles.sortSheet}>
          <Text style={styles.sheetTitle}>Sort by</Text>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.sortOption, sortBy === opt.value && styles.sortOptionActive]}
              onPress={() => { setSortBy(opt.value); setShowSortPicker(false); }}
            >
              <Text style={[styles.sortOptionText, sortBy === opt.value && { color: theme.accent }]}>
                {opt.label}
              </Text>
              {sortBy === opt.value && <Text style={styles.checkmark}>{"\u2713"}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* Filter sheet modal */}
      <Modal visible={showFilterSheet} transparent animationType="slide" onRequestClose={() => setShowFilterSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilterSheet(false)} />
        <View style={styles.filterSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Filter loads</Text>

          {/* Route corridor (country) */}
          <Text style={styles.filterSectionLabel}>ROUTE CORRIDOR</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {['ALL', ...COUNTRIES].map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, countryFilter === c && styles.chipActive]}
                onPress={() => setCountryFilter(c)}
              >
                <Text style={[styles.chipText, countryFilter === c && styles.chipTextActive]}>
                  {c === 'ALL' ? 'All routes' : c.charAt(0) + c.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Weight range */}
          <Text style={[styles.filterSectionLabel, { marginTop: 20 }]}>WEIGHT RANGE (TONS)</Text>
          <View style={styles.weightRow}>
            <TextInput
              style={styles.weightInput}
              placeholder="Min"
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
              value={minWeight}
              onChangeText={setMinWeight}
            />
            <Text style={styles.weightDash}>—</Text>
            <TextInput
              style={styles.weightInput}
              placeholder="Max"
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
              value={maxWeight}
              onChangeText={setMaxWeight}
            />
          </View>

          {/* Actions */}
          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
              <Text style={styles.clearBtnText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => setShowFilterSheet(false)}
            >
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:         { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:          { fontSize: 22, fontWeight: '500', color: theme.text },
  searchWrap:     { paddingHorizontal: 16, marginBottom: 10 },
  searchInput:    { backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: theme.text },
  controlRow:     { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 10 },
  sortBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flex: 1 },
  sortIcon:       { fontSize: 14, color: theme.textMuted },
  sortLabel:      { fontSize: 13, color: theme.text, fontWeight: '400', flex: 1 },
  sortChevron:    { fontSize: 9, color: theme.textMuted },
  filterBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  filterBtnActive:{ borderWidth: 0.5, borderColor: theme.accentBorder, backgroundColor: theme.accentDim },
  filterIcon:     { fontSize: 14, color: theme.textMuted },
  filterLabel:    { fontSize: 13, color: theme.textMuted, fontWeight: '500' },
  filterWrap:     { height: 44, justifyContent: 'center', marginBottom: 4 },
  filterRow:      { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip:           { height: 36, borderRadius: 999, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  chipActive:     { backgroundColor: theme.accent },
  chipText:       { fontSize: 13, fontWeight: '500', color: theme.textMuted },
  chipTextActive: { color: theme.darkGreen, fontWeight: '500' },
  list:           { padding: 16, paddingTop: 4 },

  // Sort modal
  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sortSheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0B0F0E', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 16, paddingBottom: 32 },
  sheetTitle:      { fontSize: 15, fontWeight: '500', color: theme.text, marginBottom: 12 },
  sortOption:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  sortOptionActive:{ },
  sortOptionText:  { fontSize: 14, color: theme.text, fontWeight: '400' },
  checkmark:       { fontSize: 16, color: theme.accent, fontWeight: '600' },

  // Filter modal
  filterSheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0B0F0E', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 16, paddingBottom: 32 },
  sheetHandle:        { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  filterSectionLabel: { fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10 },
  weightRow:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weightInput:        { flex: 1, backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: theme.text, borderWidth: 0.5, borderColor: theme.border },
  weightDash:         { color: theme.textMuted, fontSize: 14 },
  filterActions:      { flexDirection: 'row', gap: 10, marginTop: 24 },
  clearBtn:           { flex: 1, borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  clearBtnText:       { fontSize: 13, color: theme.textMuted, fontWeight: '500' },
  applyBtn:           { flex: 1, backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  applyBtnText:       { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
