import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/LoadingSkeleton';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function ConversationsScreen({ navigation }: any) {
  const [convs, setConvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/messages/conversations');
      setConvs(res.data?.conversations || []);
    } catch (e) {
      console.warn('Fetch convs error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetch]);

  const onRefresh = () => { setRefreshing(true); fetch(); };

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : convs.length === 0 ? (
        <EmptyState emoji="💬" title="No conversations" subtitle="Message a truck owner or cargo sender to start a conversation." />
      ) : (
        <FlatList
          data={convs}
          keyExtractor={item => item.userId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          renderItem={({ item }) => {
            const initials = (item.user?.fullName || 'U').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate('Chat', { userId: item.userId, userName: item.user?.fullName || 'User' })}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.info}>
                  <View style={styles.infoTop}>
                    <Text style={styles.name} numberOfLines={1}>{item.user?.fullName || 'User'}</Text>
                    <Text style={styles.time}>{timeAgo(item.lastMessageAt)}</Text>
                  </View>
                  <View style={styles.infoBottom}>
                    <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
                    {item.unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:      { paddingHorizontal: 16, paddingVertical: 14 },
  title:       { fontSize: 22, fontWeight: '500', color: theme.text },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.bg },
  avatar:      { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.darkGreen, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:  { fontSize: 15, fontWeight: '500', color: theme.lightGreen },
  info:        { flex: 1 },
  infoTop:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  name:        { fontSize: 15, fontWeight: '500', color: theme.text, flex: 1 },
  time:        { fontSize: 11, color: theme.textMuted, marginLeft: 8 },
  infoBottom:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview:     { fontSize: 13, color: theme.textMuted, flex: 1 },
  unreadBadge: { backgroundColor: theme.accent, borderRadius: 999, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8 },
  unreadText:  { color: theme.darkGreen, fontSize: 11, fontWeight: '500' },
});
