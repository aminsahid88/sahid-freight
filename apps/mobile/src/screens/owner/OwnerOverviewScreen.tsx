import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Modal, Pressable,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { useAuthStore } from '../../store/auth';
import api from '../../lib/api';
import { StatCard } from '../../components/StatCard';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { NotificationBell } from '../../components/NotificationBell';
import { theme } from '../../theme';
import { formatPrice } from '../../lib/constants';

export default function OwnerOverviewScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewSheet, setShowNewSheet] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const [bookRes, truckRes] = await Promise.all([
        api.get('/bookings/my'),
        api.get('/trucks/my'),
      ]);
      setBookings(bookRes.data?.bookings || bookRes.data || []);
      setTrucks(truckRes.data?.trucks || truckRes.data || []);
    } catch (e) {
      console.warn('Fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const onRefresh = () => { setRefreshing(true); fetch(); };

  const stats = {
    trucks: trucks.length,
    activeTrucks: trucks.filter(t => t.isAvailable).length,
    pending: bookings.filter(b => b.status === 'PENDING').length,
    inTransit: bookings.filter(b => b.status === 'IN_TRANSIT').length,
    completed: bookings.filter(b => b.status === 'COMPLETED' || b.status === 'DELIVERED').length,
  };

  const recentBookings = bookings.slice(0, 4);

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Truck Owner</Text>
            <Text style={styles.name}>{user?.companyName || user?.fullName || 'Owner'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <NotificationBell navigation={navigation} />
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowNewSheet(true)}>
              <Text style={styles.addBtnText}>+ New</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Fleet Overview */}
        <Text style={styles.sectionLabel}>FLEET OVERVIEW</Text>
        <View style={styles.statsRow}>
          <StatCard label="Total trucks" value={stats.trucks} emoji="🚛" color={theme.accent} onPress={() => navigation.navigate('MyFleet')} />
          <StatCard label="Available" value={stats.activeTrucks} emoji="🟢" color={theme.accent} onPress={() => navigation.navigate('MyFleet')} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="In transit" value={stats.inTransit} emoji="🛣️" color={theme.warning} onPress={() => navigation.navigate('OwnerBookings', { filter: 'IN_TRANSIT' })} />
          <StatCard label="Completed" value={stats.completed} emoji="✅" color={theme.blue} onPress={() => navigation.navigate('OwnerBookings', { filter: 'COMPLETED' })} />
        </View>

        {/* Pending bids */}
        {stats.pending > 0 && (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingText}>
              {stats.pending} pending bid{stats.pending !== 1 ? 's' : ''} awaiting response
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('OwnerBookings')}>
              <Text style={styles.pendingLink}>View</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Bookings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>RECENT BOOKINGS</Text>
          <TouchableOpacity onPress={() => navigation.navigate('OwnerBookings')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <SkeletonList count={3} />
        ) : recentBookings.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="No bookings yet"
            subtitle="Browse available loads and place bids to get started."
            buttonLabel="Find Loads"
            onButton={() => navigation.navigate('AvailableLoads')}
          />
        ) : (
          recentBookings.map(booking => (
            <TouchableOpacity key={booking.id} style={styles.bookingCard} activeOpacity={0.75} onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}>
              <View style={styles.bookingHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingTitle} numberOfLines={1}>{booking.load?.title || 'Load'}</Text>
                  <Text style={styles.bookingRoute}>
                    {booking.load?.pickupCity} → {booking.load?.deliveryCity}
                  </Text>
                </View>
                <StatusBadge status={booking.status} />
              </View>
              <View style={styles.bookingMeta}>
                <Text style={styles.bookingTruck}>{booking.truck?.plateNumber}</Text>
                <Text style={styles.bookingPrice}>{formatPrice(booking.bidPrice, booking.load?.currency)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* + New chooser sheet */}
      <Modal visible={showNewSheet} transparent animationType="slide" onRequestClose={() => setShowNewSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowNewSheet(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Create new</Text>

          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => { setShowNewSheet(false); navigation.navigate('AddTruck'); }}
          >
            <View style={styles.sheetIcon}><Text style={styles.sheetIconText}>🚛</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetOptionLabel}>Add a truck</Text>
              <Text style={styles.sheetOptionSub}>Expand your fleet</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sheetOption}
            onPress={() => { setShowNewSheet(false); navigation.navigate('Drivers'); }}
          >
            <View style={styles.sheetIcon}><Text style={styles.sheetIconText}>👤</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetOptionLabel}>Add a driver</Text>
              <Text style={styles.sheetOptionSub}>Invite a driver to your fleet</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetOption, { borderBottomWidth: 0 }]}
            onPress={() => { setShowNewSheet(false); navigation.navigate('AvailableLoads'); }}
          >
            <View style={styles.sheetIcon}><Text style={styles.sheetIconText}>📦</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetOptionLabel}>Find loads</Text>
              <Text style={styles.sheetOptionSub}>Browse available loads to bid on</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetDismiss} onPress={() => setShowNewSheet(false)}>
            <Text style={styles.sheetDismissText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll:        { flex: 1 },
  content:       { padding: 16, paddingBottom: 32 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  greeting:      { fontSize: 13, color: theme.textMuted },
  name:          { fontSize: 22, fontWeight: '500', color: theme.text },
  addBtn:        { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16 },
  addBtnText:    { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  sectionLabel:  { fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginTop: 20, marginBottom: 10 },
  seeAll:        { fontSize: 13, color: theme.accent, fontWeight: '500' },
  statsRow:      { flexDirection: 'row', gap: 8, marginBottom: 4 },
  pendingBanner: { backgroundColor: theme.warningDim, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: theme.warning, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  pendingText:   { fontSize: 13, color: theme.warning, fontWeight: '500', flex: 1 },
  pendingLink:   { fontSize: 13, color: theme.warning, fontWeight: '500', marginLeft: 10 },
  bookingCard:   { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  bookingHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  bookingTitle:  { fontSize: 14, fontWeight: '500', color: theme.text },
  bookingRoute:  { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  bookingMeta:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: theme.border, paddingTop: 10 },
  bookingTruck:  { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  bookingPrice:  { fontSize: 15, fontWeight: '500', color: theme.accent },
  sheetBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:           { backgroundColor: theme.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 16, paddingBottom: 32 },
  sheetHandle:     { width: 36, height: 4, backgroundColor: theme.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:      { fontSize: 15, fontWeight: '500', color: theme.text, marginBottom: 12 },
  sheetOption:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  sheetIcon:       { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
  sheetIconText:   { fontSize: 20 },
  sheetOptionLabel:{ fontSize: 14, fontWeight: '500', color: theme.text },
  sheetOptionSub:  { fontSize: 13, color: theme.textMuted, marginTop: 2, fontWeight: '400' },
  sheetDismiss:    { marginTop: 12, paddingVertical: 14, alignItems: 'center' },
  sheetDismissText:{ fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
});
