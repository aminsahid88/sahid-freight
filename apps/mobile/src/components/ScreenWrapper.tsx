import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

interface Props {
  children: React.ReactNode;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  backgroundColor?: string;
  style?: object;
}

export default function ScreenWrapper({ children, edges = ['top', 'bottom'], backgroundColor = theme.bg, style }: Props) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1 } });
