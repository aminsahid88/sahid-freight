import 'react-native-gesture-handler';
import React, { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, TextInput, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

import AppNavigator from './src/navigation/AppNavigator';

// Keep the splash on-screen until Inter loads so no flash of the system
// font ever hits the user.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Set app-wide font defaults for every <Text> / <TextInput>. Individual
// screens can still override via style.fontFamily to pick a weight.
function applyDefaultFont() {
  const RNText: any = Text;
  const RNInput: any = TextInput;

  const applyDefault = (Component: any) => {
    const existing = Component.defaultProps || {};
    Component.defaultProps = {
      ...existing,
      allowFontScaling: existing.allowFontScaling ?? true,
      style: [{ fontFamily: 'Inter_400Regular' }, existing.style],
    };
  };
  applyDefault(RNText);
  applyDefault(RNInput);
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      applyDefaultFont();
    }
  }, [fontsLoaded, fontError]);

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutReady}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <StatusBar style="light" />
          <AppNavigator />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
