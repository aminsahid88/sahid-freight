import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { theme } from '../theme';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}

export function StarRating({ value, onChange, size = 24 }: Props) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1,2,3,4,5].map(s => (
        <TouchableOpacity key={s} onPress={() => onChange?.(s)} disabled={!onChange}>
          <Text style={{ fontSize: size, color: s <= value ? theme.warning : theme.border }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
