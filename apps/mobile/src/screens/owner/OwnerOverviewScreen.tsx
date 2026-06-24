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

// P2: bidding flow hidden during broker-direct-assignment pivot.
// Hides the "Find Loads" CTAs (empty-state button + new-sheet option) that lead to bidding.
const BIDDING_ENABLED = false;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

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
    <ScreenWrapper backgroundColor={theme.bg}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.name}>{user?.companyName || user?.fullName || 'Owner'}</Text>
          </View>
          <View style={styles.headerRight}>
            <NotificationBell navigation={navigation} />
            <TouchableOpacity style={styles.newBtn} onPress={() => setShowNewSheet(true)} activeOpacity={0.8}>
              <Text style={styles.newBtnText}>+ New</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats grid 2x2 */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard label="Total trucks" value={stats.trucks} emoji="🚛" color={theme.accent} onPress={() => navigation.navigate('MyFleet')} />
            <StatCard label="Available" value={stats.activeTrucks} emoji="🟢" color={theme.accent} onPress={() => navigation.navigate('MyFleet')} />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="In transit" value={stats.inTransit} emoji="🛣️" color={theme.warning} onPress={() => navigation.navigate('OwnerBookings', { filter: 'IN_TRANSIT' })} />
            <StatCard label="Completed" value={stats.completed} emoji="✅" color={theme.blue} onPress={() => navigation.navigate('OwnerBookings', { filter: 'COMPLETED' })} />
          </View>
        </View>

        {/* Pending bids banner */}
        {stats.pending > 0 && (
          <View style={styles.pendingBanner}>
            <View style={styles.pendingLeft}>
              <Text style={styles.pendingEmoji}>📩</Text>
              <Text style={styles.pendingText}>
                {stats.pending} pending bid{stats.pending !== 1 ? 's' : ''} awaiting response
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('OwnerBookings')} activeOpacity={0.7}>
              <Text style={styles.pendingLink}>View</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Bookings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Bookings</Text>
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
            subtitle={BIDDING_ENABLED
              ? "Browse available loads and place bids to get started."
              : "When a broker dispatches a load to one of your trucks, it will show up here."}
            {...(BIDDING_ENABLED
              ? { buttonLabel: "Find Loads", onButton: () => navigation.navigate('AvailableLoads') }
              : {})}
          />
        ) : (
          recentBookings.map(booking => (
            <TouchableOpacity
              key={booking.id}
              style={styles.bookingCard}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
            >
              <View style={styles.bookingTop}>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingTitle} numberOfLines={1}>{booking.load?.title || 'Load'}</Text>
                  <Text style={styles.bookingRoute}>
                    {booking.load?.pickupCity} → {booking.load?.deliveryCity}
                  </Text>
                </View>
                <StatusBadge status={booking.status} />
              </View>
              <View style={styles.bookingBottom}>
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
            activeOpacity={0.7}
            onPress={() => { setShowNewSheet(false); navigation.navigate('AddTruck'); }}
          >
            <View style={[styles.sheetIcon, { backgroundColor: theme.accentDim }]}>
              <Text style={styles.sheetIconText}>🚛</Text>
            </View>
            <View style={styles.sheetOptionContent}>
              <Text style={styles.sheetOptionLabel}>Add a truck</Text>
              <Text style={styles.sheetOptionSub}>Expand your fleet</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sheetOption}
            activeOpacity={0.7}
            onPress={() => { setShowNewSheet(false); navigation.navigate('Drivers'); }}
          >
            <View style={[styles.sheetIcon, { backgroundColor: theme.blueDim }]}>
              <Text style={styles.sheetIconText}>👤</Text>
            </View>
            <View style={styles.sheetOptionContent}>
              <Text style={styles.sheetOptionLabel}>Add a driver</Text>
              <Text style={styles.sheetOptionSub}>Invite a driver to your fleet</Text>
            </View>
          </TouchableOpacity>

          {BIDDING_ENABLED && (
            <TouchableOpacity
              style={[styles.sheetOption, styles.sheetOptionLast]}
              activeOpacity={0.7}
              onPress={() => { setShowNewSheet(false); navigation.navigate('AvailableLoads'); }}
            >
              <View style={[styles.sheetIcon, { backgroundColor: theme.orangeDim }]}>
                <Text style={styles.sheetIconText}>📦</Text>
              </View>
              <View style={styles.sheetOptionContent}>
                <Text style={styles.sheetOptionLabel}>Find loads</Text>
                <Text style={styles.sheetOptionSub}>Browse available loads to bid on</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.sheetDismiss} onPress={() => setShowNewSheet(false)} activeOpacity={0.7}>
            <Text style={styles.sheetDismissText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  greeting: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '400',
    marginBottom: 2,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    letterSpacing: -0.3,
  },
  newBtn: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  newBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Stats */
  statsGrid: {
    gap: 8,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  /* Pending bids banner */
  pendingBanner: {
    backgroundColor: theme.orangeDim,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.orange + '30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 4,
  },
  pendingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  pendingEmoji: {
    fontSize: 16,
  },
  pendingText: {
    fontSize: 13,
    color: theme.orange,
    fontWeight: '600',
    flex: 1,
  },
  pendingLink: {
    fontSize: 13,
    color: theme.orange,
    fontWeight: '700',
    marginLeft: 10,
    textDecorationLine: 'underline',
  },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  seeAll: {
    fontSize: 13,
    color: theme.accent,
    fontWeight: '600',
  },

  /* Booking cards */
  bookingCard: {
    backgroundColor: theme.bg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  bookingTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  bookingRoute: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 3,
  },
  bookingBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 10,
  },
  bookingTruck: {
    fontSize: 13,
    color: theme.textMuted,
    fontWeight: '400',
  },
  bookingPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.accent,
  },

  /* Bottom sheet */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sheetOptionLast: {
    borderBottomWidth: 0,
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIconText: {
    fontSize: 20,
  },
  sheetOptionContent: {
    flex: 1,
  },
  sheetOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  sheetOptionSub: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 2,
    fontWeight: '400',
  },
  sheetDismiss: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: theme.surface2,
    borderRadius: 12,
  },
  sheetDismissText: {
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '600',
  },
});
