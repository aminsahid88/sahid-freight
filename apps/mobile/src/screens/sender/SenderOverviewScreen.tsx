import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
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
      <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.name}>{user?.companyName || user?.fullName || 'Cargo owner'}</Text>
            <Text style={styles.subtitle}>Everything happening with your loads today.</Text>
          </View>
          <View style={styles.headerRight}>
            <NotificationBell navigation={navigation} />
            <TouchableOpacity
              style={styles.newBtn}
              onPress={() => navigation.navigate('PostLoad')}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={16} color={theme.accentText} />
              <Text style={styles.newBtnText}>Post load</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Overview */}
        <Text style={styles.sectionLabel}>Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard label="Total loads" value={stats.total} color={theme.accent} />
            <StatCard label="Open" value={stats.open} color={theme.success} />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="In transit" value={stats.inTransit} color={theme.warning} />
            <StatCard label="Delivered" value={stats.delivered} color={theme.blue} />
          </View>
        </View>

        {/* Recent loads */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabelInline}>Recent loads</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyLoads')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <SkeletonList count={3} />
        ) : recentLoads.length === 0 ? (
          <EmptyState
            icon="package"
            title="No loads yet"
            subtitle="Post your first load and a broker will match it with a verified truck."
            buttonLabel="Post a load"
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
  scroll: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  greeting: {
    fontSize: 14,
    color: theme.textMuted,
    marginBottom: 2,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  newBtnText: {
    color: theme.accentText,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
  },
  statsGrid: {
    gap: 10,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 14,
  },
  sectionLabelInline: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  seeAll: {
    fontSize: 13,
    color: theme.accent,
    fontWeight: '600',
  },
});
