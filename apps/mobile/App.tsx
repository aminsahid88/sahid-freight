/**
 * Sahid Freight capture app — entry. Loads Inter, hydrates settings, session
 * and the offline queue, then mounts navigation.
 */
import "react-native-gesture-handler";
import React, { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import AppNavigator from "./src/navigation/AppNavigator";
import { useTheme } from "./src/components/ui";
import { useQueue } from "./src/lib/queue";
import { useAuthStore } from "./src/store/auth";
import { useSettingsStore } from "./src/store/settings";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Root() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    Promise.all([useSettingsStore.getState().hydrate(), useAuthStore.getState().load(), useQueue.getState().hydrate()])
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  const onLayout = useCallback(() => {
    if ((fontsLoaded || fontError) && hydrated) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError, hydrated]);

  if (!(fontsLoaded || fontError) || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <Root />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
