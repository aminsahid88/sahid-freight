import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { statusColors, theme } from '../theme';

export function StatusBadge({ status }: { status: string }) {
  const s = statusColors[status] || { bg: theme.surface2, color: theme.textMuted };
  const label = status?.replace(/_/g, ' ') || '—';
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  text:  { fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
});
