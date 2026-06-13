import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

type FilterPillProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export function FilterPill({ label, active, onPress }: FilterPillProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip:           { height: 36, borderRadius: 999, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface2 },
  chipActive:     { backgroundColor: theme.accent },
  chipText:       { fontSize: 13, fontWeight: '500', color: theme.textMuted },
  chipTextActive: { color: theme.darkGreen, fontWeight: '500' },
});
