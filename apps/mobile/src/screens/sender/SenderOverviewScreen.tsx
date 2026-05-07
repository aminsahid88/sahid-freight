import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { useAuthStore } from '../../store/auth';
import api from '../../lib/api';
import { theme } from '../../theme';
import { StatCard } from '../../components/StatCard';
import { LoadCard } from '../../components/LoadCard';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { NotificationBell } from '../../components/NotificationBell';

export default function SenderOverviewScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = () => {
    setRefreshing(true);
    fetch();
  };

  const stats = {
    total: loads.length,
    open: loads.filter(l => l.status === 'OPEN').length,
    booked: loads.filter(l => l.status === 'BOOKED').length,
    inTransit: loads.filter(l => l.status === 'IN_TRANSIT').length,
    delivered: loads.filter(l => l.status === 'DELIVERED').length,
  };

  const recentLoads = loads.slice(0, 3);

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
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.name}>{user?.companyName || user?.fullName || 'Sender'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <NotificationBell navigation={navigation} />
            <TouchableOpacity
              style={styles.newBtn}
              onPress={() => navigation.navigate('PostLoad')}
            >
              <Text style={styles.newBtnText}>+ Post Load</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* OVERVIEW */}
        <Text style={styles.sectionLabel}>OVERVIEW</Text>
        <View style={styles.statsRow}>
          <StatCard label="Total Loads" value={stats.total} emoji="📦" color={theme.accent} />
          <StatCard label="Open" value={stats.open} emoji="🟢" color={theme.accent} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="In Transit" value={stats.inTransit} emoji="🚛" color={theme.warning} />
          <StatCard label="Delivered" value={stats.delivered} emoji="✅" color={theme.blue} />
        </View>

        {/* RECENT LOADS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>RECENT LOADS</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyLoads')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <SkeletonList count={3} />
        ) : recentLoads.length === 0 ? (
          <EmptyState
            emoji="📭"
            title="No loads yet"
            subtitle="Post your first load to start getting bids from truck owners."
            buttonLabel="Post a Load"
            onButton={() => navigation.navigate('PostLoad')}
          />
        ) : (
          recentLoads.map(load => (
            <LoadCard
              key={load.id}
              load={load}
              onPress={() => navigation.navigate('LoadDetail', { loadId: load.id })}
            />
          ))
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll:        { flex: 1, backgroundColor: theme.bg },
  content:       { padding: 16, paddingBottom: 32 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  greeting:      { fontSize: 13, color: theme.textMuted },
  name:          { fontSize: 22, fontWeight: '500', color: theme.text },
  newBtn:        { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16 },
  newBtnText:    { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionLabel:  { fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginTop: 24, marginBottom: 12 },
  seeAll:        { fontSize: 13, color: theme.accent, fontWeight: '500' },
  statsRow:      { flexDirection: 'row', marginHorizontal: -4 },
});
