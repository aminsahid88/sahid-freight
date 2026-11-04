import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { theme } from '../theme';

export function LoadingSkeleton({ height = 80, style }: { height?: number; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  return <Animated.View style={[{ height, borderRadius: 12, backgroundColor: theme.surface2 }, style, { opacity }]} />;
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={{ padding: 16, gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton key={i} height={88} />
      ))}
    </View>
  );
}
