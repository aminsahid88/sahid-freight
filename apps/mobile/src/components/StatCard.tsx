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
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
        {sub && <Text style={styles.sub}>{sub}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:    { backgroundColor: theme.surface, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: theme.accent, overflow: 'hidden', flex: 1, margin: 4, borderWidth: 0 },
  body:    { padding: 14 },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  value:   { fontSize: 22, fontWeight: '500', color: theme.text, letterSpacing: -0.5 },
  label:   { fontSize: 11, color: theme.textMuted, marginTop: 4, fontWeight: '400' },
  sub:     { fontSize: 10, color: theme.textMuted, marginTop: 2 },
});
