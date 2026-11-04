import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  emoji?: string;
  onPress?: () => void;
}

export function StatCard({ label, value, sub, color = theme.accent, emoji, onPress }: Props) {
  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: color }]} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.body}>
        {emoji && (
          <View style={[styles.iconBox, { backgroundColor: color + '14' }]}>
            <Text style={{ fontSize: 16 }}>{emoji}</Text>
          </View>
        )}
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        {sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:    { backgroundColor: theme.surface, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: theme.accent, overflow: 'hidden', flex: 1, minHeight: 100 },
  body:    { padding: 14, flex: 1, justifyContent: 'center' },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  value:   { fontSize: 22, fontWeight: '500', color: theme.text, letterSpacing: -0.5 },
  label:   { fontSize: 11, color: theme.textMuted, marginTop: 4, fontWeight: '400' },
  sub:     { fontSize: 10, color: theme.textMuted, marginTop: 2 },
});
