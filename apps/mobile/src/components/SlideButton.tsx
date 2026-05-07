import React, { useRef, useState } from 'react';
import { View, Text, Animated, PanResponder, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../theme';

interface Props {
  label: string;
  color?: string;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
}

const TRACK_H = 56;
const THUMB_SIZE = 48;
const INSET = (TRACK_H - THUMB_SIZE) / 2;

export function SlideButton({ label, color = theme.warning, onConfirm, disabled = false }: Props) {
  const trackWidth = useRef(0);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const x = useRef(new Animated.Value(0)).current;

  const maxTravel = () => trackWidth.current - THUMB_SIZE - INSET * 2;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled && !confirmed && !loading,
    onStartShouldSetPanResponderCapture: () => !disabled && !confirmed && !loading,
    onMoveShouldSetPanResponder: () => !disabled && !confirmed && !loading,
    onMoveShouldSetPanResponderCapture: (_, gs) => !disabled && !confirmed && !loading && Math.abs(gs.dx) > 5,
    onPanResponderMove: (_, gs) => {
      const max = maxTravel();
      if (max > 0) x.setValue(Math.max(0, Math.min(gs.dx, max)));
    },
    onPanResponderRelease: (_, gs) => {
      const max = maxTravel();
      if (max > 0 && gs.dx / max >= 0.85) {
        Animated.spring(x, { toValue: max, useNativeDriver: false, bounciness: 0 }).start(async () => {
          setConfirmed(true);
          setLoading(true);
          if (__DEV__) console.log('[SlideButton] onComplete fired');
          try { await onConfirm(); } finally { setLoading(false); }
        });
      } else {
        Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
      }
    },
  })).current;

  const labelOpacity = x.interpolate({
    inputRange: [0, (trackWidth.current || 200) * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const tintBg = color + '26'; // ~15% alpha
  const borderColor = disabled ? theme.border : color;

  return (
    <View
      style={[styles.track, { backgroundColor: tintBg, borderColor, opacity: disabled ? 0.5 : 1 }]}
      onLayout={e => { trackWidth.current = e.nativeEvent.layout.width; }}
    >
      {/* Label behind thumb */}
      {!confirmed ? (
        <Animated.View style={styles.labelWrap} pointerEvents="none">
          <Animated.Text style={[styles.label, { color, opacity: labelOpacity }]}>{label}</Animated.Text>
        </Animated.View>
      ) : loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.label, { color }]}>Confirmed</Text>
      )}

      {/* Thumb */}
      {!confirmed && (
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: disabled ? theme.border : color,
              transform: [{ translateX: x }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Text style={styles.arrow}>›</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  labelWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    top: INSET,
    left: INSET,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  arrow: {
    color: '#173404',
    fontSize: 22,
    fontWeight: '500',
  },
});
