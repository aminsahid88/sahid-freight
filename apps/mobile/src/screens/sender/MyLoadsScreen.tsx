import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, Alert, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { StatusBadge } from '../../components/StatusBadge';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { formatPrice } from '../../lib/constants';
import { EmptyState } from '../../components/EmptyState';
import { FilterPill } from '../../components/FilterPill';
import { NotificationBell } from '../../components/NotificationBell';
import { formatApiError } from '../../lib/errors';

const FILTERS = ['ALL', 'OPEN', 'BOOKED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];

function LoadActionSheet({ load, onClose, onEdit, onDuplicate, onDelete, onCancel, onComplete }: {
  load: any; onClose: () => void;
  onEdit: (id: string) => void; onDuplicate: (l: any) => void;
  onDelete: (id: string) => void; onCancel: (id: string) => void; onComplete: (id: string) => void;
}) {
  if (!load) return null;

  const status = (load.status || '').toUpperCase();
  const bidCount = load._count?.bids ?? load.bidCount ?? 0;

  if (__DEV__) {
    console.log('[KebabMenu] v2 status:', JSON.stringify(status), 'bidCount:', bidCount, '_count:', JSON.stringify(load._count), 'raw status:', JSON.stringify(load.status));
  }

  type MenuItem = { label: string; icon: keyof typeof Feather.glyphMap; color?: string; onPress: () => void };
  const items: MenuItem[] = [];

  // Edit — OPEN only
  if (status === 'OPEN') {
    items.push({ label: 'Edit load', icon: 'edit-2', onPress: () => onEdit(load.id) });
  }

  // Duplicate — always
  items.push({ label: 'Duplicate load', icon: 'copy', onPress: () => onDuplicate(load) });

  // Mark as complete — IN_TRANSIT only
  if (status === 'IN_TRANSIT') {
    items.push({
      label: 'Mark as complete', icon: 'check-circle', color: theme.accent,
      onPress: () => Alert.alert(
        'Mark this load as complete?',
        "Only do this if the driver finished the trip but didn't update the app.",
        [{ text: 'Not yet', style: 'cancel' }, { text: 'Mark complete', onPress: () => onComplete(load.id) }],
      ),
    });
  }

  // Cancel load — OPEN with bids OR BOOKED
  if ((status === 'OPEN' && bidCount > 0) || status === 'BOOKED') {
    const msg = status === 'BOOKED'
      ? "The truck owner will be notified and can't dispatch to this load anymore. A cancellation fee may apply."
      : "The broker won't be able to dispatch a truck to this load after this.";
    items.push({
      label: 'Cancel load', icon: 'x-circle', color: theme.danger,
      onPress: () => Alert.alert('Cancel this load?', msg, [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Cancel load', style: 'destructive', onPress: () => onCancel(load.id) },
      ]),
    });
  }

  // Delete — OPEN with no bids, DRAFT, or CANCELLED
  if ((status === 'OPEN' && bidCount === 0) || status === 'DRAFT' || status === 'CANCELLED') {
    items.push({
      label: 'Delete load', icon: 'trash-2', color: theme.danger,
      onPress: () => Alert.alert('Delete this load?', "This can't be undone.", [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(load.id) },
      ]),
    });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle} numberOfLines={1}>{load.title}</Text>
        {items.map((item, i) => (
          <TouchableOpacity key={i} style={styles.sheetRow} onPress={item.onPress}>
            <Feather name={item.icon} size={18} color={item.color || theme.text} />
            <Text style={[styles.sheetRowText, item.color ? { color: item.color } : undefined]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.sheetRow, styles.sheetCancel]} onPress={onClose}>
          <Text style={[styles.sheetRowText, { color: theme.textSecondary, textAlign: 'center', flex: 1 }]}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export default function MyLoadsScreen({ navigation }: any) {
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [menuLoad, setMenuLoad] = useState<any>(null);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/loads/my');
      setLoads(res.data?.loads || res.data || []);
    } catch (e) {
      console.warn('Failed to fetch loads', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  useFocusEffect(
    useCallback(() => { fetch(); }, [fetch])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetch();
  };

  const filtered = filter === 'ALL' ? loads : loads.filter(l => l.status === filter);

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My loads</Text>
          <Text style={styles.subtitle}>Every load you've posted, in one place.</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <NotificationBell navigation={navigation} />
          <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('PostLoad')}>
            <Feather name="plus" size={14} color={theme.darkGreen} />
            <Text style={styles.newBtnText}>New load</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterWrap}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={i => i}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
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
        <SkeletonList count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="package"
          title={filter === 'ALL' ? 'No loads yet' : `No ${filter.replace(/_/g, ' ').toLowerCase()} loads`}
          subtitle="Post your first load and a broker will match it with a verified truck."
          buttonLabel="Post a load"
          onButton={() => navigation.navigate('PostLoad')}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.cardWrap}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('LoadDetail', { loadId: item.id })}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardRoute}>{item.pickupCity} → {item.deliveryCity}</Text>
                </View>
                <View style={styles.cardRight}>
                  <StatusBadge status={item.status} />
                  <TouchableOpacity
                    style={styles.kebab}
                    onPress={() => setMenuLoad(item)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Feather name="more-vertical" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.cardBottom}>
                <View style={styles.cardMeta}>
                  <View style={styles.cardPill}><Text style={styles.cardPillText}>{item.weightTons}t</Text></View>
                  <View style={styles.cardPill}><Text style={styles.cardPillText}>{item.truckTypeNeeded?.replace(/_/g, ' ')}</Text></View>
                  {item._count?.bids > 0 && (
                    <View style={styles.cardBidBadge}><Text style={styles.cardBidText}>{item._count.bids} bid{item._count.bids !== 1 ? 's' : ''}</Text></View>
                  )}
                </View>
                <Text style={styles.cardPrice}>{formatPrice(item.offeredPrice)} <Text style={styles.cardCurrency}>{item.currency || 'ETB'}</Text></Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <LoadActionSheet
        load={menuLoad}
        onClose={() => setMenuLoad(null)}
        onEdit={(id) => { setMenuLoad(null); navigation.navigate('EditLoad', { loadId: id }); }}
        onDuplicate={(l) => {
          setMenuLoad(null);
          navigation.navigate('PostLoad', {
            prefill: {
              title: l.title, description: l.description,
              pickupCity: l.pickupCity, pickupCountry: l.pickupCountry,
              deliveryCity: l.deliveryCity, deliveryCountry: l.deliveryCountry,
              weightTons: l.weightTons, truckTypeNeeded: l.truckTypeNeeded,
              offeredPrice: l.offeredPrice, currency: l.currency,
            },
          });
        }}
        onDelete={async (id) => {
          setMenuLoad(null);
          try {
            await api.delete(`/loads/${id}`);
            setLoads(prev => prev.filter(l => l.id !== id));
          } catch (e: any) { Alert.alert('Load not deleted', formatApiError(e, "We couldn't delete this load. Please try again.", 'load')); }
        }}
        onCancel={async (id) => {
          setMenuLoad(null);
          try {
            await api.patch(`/loads/${id}/cancel`);
            await fetch();
          } catch (e: any) { Alert.alert('Load not cancelled', formatApiError(e, "We couldn't cancel this load. Please try again.", 'load')); }
        }}
        onComplete={async (id) => {
          setMenuLoad(null);
          try {
            await api.patch(`/loads/${id}/complete`);
            await fetch();
          } catch (e: any) { Alert.alert('Load not updated', formatApiError(e, "We couldn't mark this load as complete. Please try again.", 'load')); }
        }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:          { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, paddingBottom: 8, backgroundColor: theme.bg, gap: 12 },
  title:           { fontSize: 22, fontWeight: '500', color: theme.text },
  subtitle:        { fontSize: 13, color: theme.textMuted, marginTop: 4 },
  newBtn:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  newBtnText:      { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
  filterWrap:      { height: 52, justifyContent: 'center', paddingVertical: 0 },
  list:            { padding: 16, paddingTop: 8 },
  cardWrap:        { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  cardTop:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  cardTitle:       { fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 3 },
  cardRoute:       { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  cardRight:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kebab:           { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: theme.surface2 },
  cardDivider:     { height: 0.5, backgroundColor: theme.border, marginBottom: 12 },
  cardBottom:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMeta:        { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  cardPill:        { backgroundColor: theme.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  cardPillText:    { fontSize: 11, color: theme.textMuted, fontWeight: '400' },
  cardBidBadge:    { backgroundColor: theme.warningDim, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  cardBidText:     { fontSize: 10, fontWeight: '500', color: theme.warning },
  cardPrice:       { fontSize: 15, fontWeight: '500', color: theme.accent },
  cardCurrency:    { fontSize: 11, fontWeight: '400', color: theme.textMuted },
  backdrop:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:           { backgroundColor: theme.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 16, paddingBottom: 32 },
  sheetHandle:     { width: 36, height: 4, backgroundColor: theme.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:      { fontSize: 15, fontWeight: '500', color: theme.text, marginBottom: 12, paddingHorizontal: 4 },
  sheetRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  sheetCancel:     { marginTop: 8, borderBottomWidth: 0, justifyContent: 'center' },
  sheetRowText:    { fontSize: 14, color: theme.text, fontWeight: '500' },
});
