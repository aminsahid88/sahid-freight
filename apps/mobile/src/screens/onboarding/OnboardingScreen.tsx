import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, StatusBar,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { theme } from '../../theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '\u{1F30D}',
    title: 'Move cargo across\nthe Horn of Africa',
    sub: 'Connect with verified truck owners across Ethiopia, Somalia and Djibouti. Fast, reliable, transparent.',
  },
  {
    emoji: '\u{1F69B}',
    title: 'For truck owners',
    sub: 'Bid on loads. Manage your fleet. Track your drivers. Get paid on time.',
  },
  {
    emoji: '\u{1F4E6}',
    title: 'For cargo senders',
    sub: 'Post loads. Get competitive bids. Track shipments in real time. Verified drivers only.',
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const markSeenAndGo = async () => {
    await SecureStore.setItemAsync('onboarding_seen', 'true');
    onDone();
  };

  const onScroll = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      {/* Skip button */}
      <TouchableOpacity style={styles.skipBtn} onPress={markSeenAndGo}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index: i }) => (
          <View style={styles.slide}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>{item.title}</Text>
              <View style={styles.titleUnderline} />
            </View>
            <Text style={styles.sub}>{item.sub}</Text>

            {i === SLIDES.length - 1 ? (
              <View style={styles.finalBtns}>
                <TouchableOpacity style={styles.startBtn} onPress={markSeenAndGo}>
                  <Text style={styles.startBtnText}>Get Started</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.loginLink} onPress={markSeenAndGo}>
                  <Text style={styles.loginLinkText}>I already have an account</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.nextBtn} onPress={next}>
                <Text style={styles.nextBtnText}>Next</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {/* Pagination dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === index ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: theme.bg },
  skipBtn:       { position: 'absolute', top: 56, right: 24, zIndex: 10, paddingVertical: 6, paddingHorizontal: 12 },
  skipText:      { fontSize: 14, color: theme.textMuted, fontWeight: '500' },
  slide:         { width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 120 },
  emoji:         { fontSize: 80, marginBottom: 36 },
  titleWrap:     { alignItems: 'center', marginBottom: 20 },
  title:         { fontSize: 22, fontWeight: '500', color: theme.text, textAlign: 'center', letterSpacing: -0.5, lineHeight: 30 },
  titleUnderline: { height: 3, width: 60, backgroundColor: theme.accent, borderRadius: 999, marginTop: 12 },
  sub:           { fontSize: 15, color: theme.textMuted, textAlign: 'center', lineHeight: 24, marginBottom: 48 },
  finalBtns:     { width: '100%', gap: 16 },
  startBtn:      { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  startBtnText:  { color: theme.darkGreen, fontSize: 15, fontWeight: '600' },
  loginLink:     { alignItems: 'center', paddingVertical: 8 },
  loginLinkText: { color: theme.accent, fontSize: 14, fontWeight: '500' },
  nextBtn:       { borderWidth: 0.5, borderColor: theme.accentBorder, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 40, alignItems: 'center' },
  nextBtnText:   { color: theme.accent, fontSize: 15, fontWeight: '600' },
  dots:          { position: 'absolute', bottom: 52, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot:           { borderRadius: 999 },
  dotActive:     { width: 20, height: 8, backgroundColor: theme.text },
  dotInactive:   { width: 8, height: 8, backgroundColor: theme.textMuted },
});
