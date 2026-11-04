import React, { useEffect, useState, useRef } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../lib/api';
import { theme } from '../theme';

interface Props {
  navigation: any;
}

export function NotificationBell({ navigation }: Props) {
  const [count, setCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = async () => {
    try {
      const res = await api.get('/notifications/unread');
      setCount(res.data?.count ?? 0);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchCount();
    intervalRef.current = setInterval(fetchCount, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <TouchableOpacity style={styles.wrap} onPress={() => navigation.navigate('Notifications')}>
      <Feather name="bell" size={20} color={theme.text} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap:      { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  badge:     { position: 'absolute', top: 2, right: 2, backgroundColor: theme.danger, borderRadius: 999, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '500' },
});
