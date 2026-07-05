import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/LoadingSkeleton';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type FeatherName = keyof typeof Feather.glyphMap;

function notifIcon(type: string): FeatherName {
  const map: Record<string, FeatherName> = {
    BID_RECEIVED: 'inbox',
    BID_ACCEPTED: 'check-circle',
    BID_REJECTED: 'x-circle',
    LOAD_BOOKED: 'package',
    IN_TRANSIT: 'truck',
    DELIVERED: 'check-circle',
    PAYMENT: 'dollar-sign',
    SYSTEM: 'bell',
  };
  return map[type] || 'bell';
}

function notifIconColor(type: string): string {
  switch (type) {
    case 'BID_ACCEPTED':
    case 'DELIVERED':
      return theme.accent;
    case 'BID_REJECTED':
      return theme.danger;
    case 'PAYMENT':
      return theme.accent;
    case 'IN_TRANSIT':
      return theme.blue;
    default:
      return theme.textMuted;
  }
}

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data?.notifications || res.data || []);
    } catch (e) {
      console.warn('Notifications fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleTap = (item: Notification) => {
    markRead(item.id);
    const meta = (item as any).meta;
    switch (item.type) {
      case 'BID_RECEIVED':
      case 'BID_ACCEPTED':
      case 'BID_REJECTED':
        if (meta?.loadId) navigation.navigate('LoadDetail', { loadId: meta.loadId });
        break;
      case 'LOAD_BOOKED':
        break;
      case 'IN_TRANSIT':
      case 'DELIVERED':
        if (meta?.bookingId) navigation.navigate('Tracking', { bookingId: meta.bookingId });
        break;
      case 'PAYMENT':
        if (meta?.bookingId) navigation.navigate('Payment', { bookingId: meta.bookingId });
        break;
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.item, !item.read && styles.itemUnread]}
      onPress={() => handleTap(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconBox}>
        <Feather name={notifIcon(item.type)} size={20} color={notifIconColor(item.type)} />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
      </View>
      {!item.read && <View style={styles.dot} />}
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>Updates about your loads, bookings, and trucks.</Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <SkeletonList count={6} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetch(); }}
              tintColor={theme.accent}
            />
          }
          contentContainerStyle={notifications.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
          ListEmptyComponent={
            <EmptyState
              icon="bell"
              title="You're all caught up"
              subtitle="Updates about your loads, bookings, and trucks will appear here."
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.bg,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: { color: theme.text, fontSize: 22, fontWeight: '500' },
  headerSub:   { color: theme.textMuted, fontSize: 13, marginTop: 2 },
  markAll:     { color: theme.accent, fontSize: 13, fontWeight: '500' },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.bg,
  },
  itemUnread: {
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
    backgroundColor: theme.accentDim,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content:  { flex: 1 },
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title:    { fontSize: 14, fontWeight: '400', color: theme.text, flex: 1, marginRight: 8 },
  titleUnread: { fontWeight: '500', color: theme.text },
  time:     { fontSize: 11, color: theme.textMuted },
  message:  { fontSize: 13, color: theme.textMuted, lineHeight: 18 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accent,
    marginLeft: 8,
    marginTop: 6,
  },
  separator: { height: 1, backgroundColor: theme.border },
});
