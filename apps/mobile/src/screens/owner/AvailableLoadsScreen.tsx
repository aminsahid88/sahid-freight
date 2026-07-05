import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, TextInput, Modal, Pressable, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { TRUCK_TYPES, COUNTRIES } from '../../lib/constants';
import { LoadCard } from '../../components/LoadCard';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { FilterPill } from '../../components/FilterPill';
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
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Available loads</Text>
          <Text style={styles.subtitle}>Loads posted by cargo owners that match your trucks.</Text>
        </View>
        <NotificationBell navigation={navigation} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={theme.textMuted} style={styles.searchIcon} />
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
          <Feather name="bar-chart-2" size={14} color={theme.textMuted} />
          <Text style={styles.sortLabel}>{SORT_OPTIONS.find(s => s.value === sortBy)?.label}</Text>
          <Feather name="chevron-down" size={14} color={theme.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setShowFilterSheet(true)}
        >
          <Feather name="sliders" size={14} color={activeFilterCount > 0 ? theme.accent : theme.textMuted} />
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
            <FilterPill
              label={item.replace(/_/g, ' ')}
              active={truckFilter === item}
              onPress={() => setTruckFilter(item)}
            />
          )}
        />
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={activeFilterCount > 0 || search.trim() ? 'search' : 'package'}
          title={activeFilterCount > 0 || search.trim()
            ? 'No loads match your filters'
            : 'Nothing available in your area right now'}
          subtitle={activeFilterCount > 0 || search.trim()
            ? 'Try adjusting your search, sort, or filters.'
            : "When new loads matching your trucks are posted, they'll appear here."}
          buttonLabel={activeFilterCount > 0 ? 'Clear filters' : undefined}
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
              {sortBy === opt.value && <Feather name="check" size={16} color={theme.accent} />}
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
          <Text style={styles.filterSectionLabel}>Route corridor</Text>
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
          <Text style={[styles.filterSectionLabel, { marginTop: 20 }]}>Weight range (tons)</Text>
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
  header:         { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title:          { fontSize: 22, fontWeight: '700', color: theme.text, fontFamily: 'Inter_700Bold' },
  subtitle:       { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  searchWrap:     { paddingHorizontal: 16, marginBottom: 10, position: 'relative' },
  searchIcon:     { position: 'absolute', left: 30, top: 14, zIndex: 1 },
  searchInput:    { backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 14, paddingLeft: 38, paddingVertical: 11, fontSize: 14, color: theme.text },
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
  chip:           { height: 36, borderRadius: 999, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface2 },
  chipActive:     { backgroundColor: theme.accent },
  chipText:       { fontSize: 13, fontWeight: '500', color: theme.textMuted },
  chipTextActive: { color: theme.darkGreen, fontWeight: '500' },
  list:           { padding: 16, paddingTop: 4 },

  // Sort modal
  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sortSheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 16, paddingBottom: 32 },
  sheetTitle:      { fontSize: 15, fontWeight: '500', color: theme.text, marginBottom: 12 },
  sortOption:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  sortOptionActive:{ },
  sortOptionText:  { fontSize: 14, color: theme.text, fontWeight: '400' },
  checkmark:       { fontSize: 16, color: theme.accent, fontWeight: '600' },

  // Filter modal
  filterSheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 16, paddingBottom: 32 },
  sheetHandle:        { width: 36, height: 4, backgroundColor: theme.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  filterSectionLabel: { fontSize: 12, fontWeight: '600', color: theme.textMuted, marginBottom: 10 },
  weightRow:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weightInput:        { flex: 1, backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: theme.text, borderWidth: 0.5, borderColor: theme.border },
  weightDash:         { color: theme.textMuted, fontSize: 14 },
  filterActions:      { flexDirection: 'row', gap: 10, marginTop: 24 },
  clearBtn:           { flex: 1, borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  clearBtnText:       { fontSize: 13, color: theme.textMuted, fontWeight: '500' },
  applyBtn:           { flex: 1, backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  applyBtnText:       { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
