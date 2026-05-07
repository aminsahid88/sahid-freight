import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface Props {
  emoji?: string;
  title: string;
  subtitle?: string;
  buttonLabel?: string;
  onButton?: () => void;
}

export function EmptyState({ emoji = '📭', title, subtitle, buttonLabel, onButton }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {buttonLabel && onButton && (
        <TouchableOpacity style={styles.btn} onPress={onButton}>
          <Text style={styles.btnText}>{buttonLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  emoji:    { fontSize: 48, marginBottom: 16 },
  title:    { fontSize: 15, fontWeight: '500', color: theme.text, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 20, fontWeight: '400' },
  btn:      { marginTop: 20, backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 28 },
  btnText:  { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
