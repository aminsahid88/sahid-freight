import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}

export function StarRating({ value, onChange, size = 24 }: Props) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(s => {
        const filled = s <= value;
        return (
          <TouchableOpacity key={s} onPress={() => onChange?.(s)} disabled={!onChange}>
            <MaterialCommunityIcons
              name={filled ? 'star' : 'star-outline'}
              size={size}
              color={filled ? theme.warning : theme.border}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
