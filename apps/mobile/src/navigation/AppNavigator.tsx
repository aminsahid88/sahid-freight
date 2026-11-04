import React, { useEffect } from "react";
import { AppState } from "react-native";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { backoffice } from "../lib/backoffice";
import { useT } from "../lib/i18n";
import { useQueue } from "../lib/queue";
import { useAuthStore } from "../store/auth";
import { useSettingsStore } from "../store/settings";
import { useTheme } from "../components/ui";
import { font } from "../theme";
import CaptureScreen from "../screens/CaptureScreen";
import SettingsScreen from "../screens/SettingsScreen";
import SignInScreen from "../screens/SignInScreen";
import SubmissionsScreen from "../screens/SubmissionsScreen";
import WhichTruckScreen from "../screens/WhichTruckScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  const { t } = useT();
  const theme = useTheme();
  const pending = useQueue((s) => s.items.filter((i) => i.status === "pending" || i.status === "uploading").length);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.tabBar, borderTopColor: theme.tabBarBorder, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
      }}
    >
      <Tab.Screen name="Capture" component={CaptureScreen} options={{ title: t("mobile.capture"), tabBarIcon: ({ color, size }) => <Feather name="camera" size={size} color={color} /> }} />
      <Tab.Screen name="Submissions" component={SubmissionsScreen} options={{ title: t("mobile.submissions"), tabBarBadge: pending || undefined, tabBarIcon: ({ color, size }) => <Feather name="inbox" size={size} color={color} /> }} />
      <Tab.Screen name="WhichTruck" component={WhichTruckScreen} options={{ title: t("mobile.whichTruck"), tabBarIcon: ({ color, size }) => <Feather name="truck" size={size} color={color} /> }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t("nav.settings"), tabBarIcon: ({ color, size }) => <Feather name="settings" size={size} color={color} /> }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const companyId = useSettingsStore((s) => s.companyId);
  const setCompany = useSettingsStore((s) => s.setCompany);
  const processQueue = useQueue((s) => s.process);

  // Pick a company automatically when there is exactly one, so a driver never sees a picker.
  useEffect(() => {
    if (!user || companyId) return;
    backoffice
      .myCompanies()
      .then((cs) => cs[0] && setCompany(cs[0].company.id))
      .catch(() => undefined);
  }, [user, companyId, setCompany]);

  // Drain the upload queue whenever the app comes to the foreground.
  useEffect(() => {
    if (!user) return;
    void processQueue();
    const sub = AppState.addEventListener("change", (state) => state === "active" && void processQueue());
    return () => sub.remove();
  }, [user, processQueue]);

  if (!ready) return null;
  const navTheme = theme.isDark ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: theme.bg, card: theme.bg, text: theme.text, border: theme.border, primary: theme.accent } } : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.bg, card: theme.bg, text: theme.text, border: theme.border, primary: theme.accent } };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? <Stack.Screen name="Main" component={Tabs} /> : <Stack.Screen name="SignIn" component={SignInScreen} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
