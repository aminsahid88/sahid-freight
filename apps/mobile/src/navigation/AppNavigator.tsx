import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '../store/auth';
import { useThemeStore } from '../store/themeStore';
import { theme } from '../theme';

// Onboarding
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import SignUpDetailsScreen from '../screens/auth/SignUpDetailsScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import NewPasswordScreen from '../screens/auth/NewPasswordScreen';

// Sender screens
import SenderOverviewScreen from '../screens/sender/SenderOverviewScreen';
import MyLoadsScreen from '../screens/sender/MyLoadsScreen';
import LoadDetailScreen from '../screens/sender/LoadDetailScreen';
import PostLoadScreen from '../screens/sender/PostLoadScreen';
import EditLoadScreen from '../screens/sender/EditLoadScreen';
import SenderBookingsScreen from '../screens/sender/SenderBookingsScreen';

// Owner screens
import OwnerOverviewScreen from '../screens/owner/OwnerOverviewScreen';
import AvailableLoadsScreen from '../screens/owner/AvailableLoadsScreen';
import LoadBidScreen from '../screens/owner/LoadBidScreen';
import MyFleetScreen from '../screens/owner/MyFleetScreen';
import DriversScreen from '../screens/owner/DriversScreen';
import OwnerBookingsScreen from '../screens/owner/OwnerBookingsScreen';
import AddTruckScreen from '../screens/owner/AddTruckScreen';
import EditTruckScreen from '../screens/owner/EditTruckScreen';

// Driver screens
import DriverActiveScreen from '../screens/driver/DriverActiveScreen';
import DriverHistoryScreen from '../screens/driver/DriverHistoryScreen';
import ProofOfDeliveryScreen from '../screens/driver/ProofOfDeliveryScreen';

// Broker screens (P3a — skeletons, real content lands in P3b-d)
import BrokerDashboardScreen from '../screens/broker/BrokerDashboardScreen';
import BrokerLoadsScreen from '../screens/broker/BrokerLoadsScreen';
import BrokerTrucksScreen from '../screens/broker/BrokerTrucksScreen';
import FindTruckScreen from '../screens/broker/FindTruckScreen';

// Shared screens
import ProfileScreen from '../screens/shared/ProfileScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import TrackingScreen from '../screens/shared/TrackingScreen';
import ConversationsScreen from '../screens/shared/ConversationsScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import PaymentScreen from '../screens/shared/PaymentScreen';
import BookingDetailScreen from '../screens/shared/BookingDetailScreen';
import VerificationScreen from '../screens/shared/VerificationScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// P2: bidding flow hidden during broker-direct-assignment pivot.
// Flip to true to restore the Sender Bids tab, Owner AvailableLoads tab,
// and the LoadBid stack screen. Underlying screens + API endpoints are intact.
const BIDDING_ENABLED = false;

type AppState = 'loading' | 'onboarding' | 'auth' | 'app';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 20 : 18, opacity: focused ? 1 : 0.35 }}>{emoji}</Text>
  );
}

function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  return {
    backgroundColor: theme.tabBar,
    borderTopColor: theme.tabBarBorder,
    borderTopWidth: 0.5,
    height: 60 + insets.bottom,
    paddingBottom: insets.bottom + 8,
    paddingTop: 6,
  };
}

function SenderTabs() {
  const tabBarStyle = useTabBarStyle();
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle,
      tabBarActiveTintColor: theme.accent,
      tabBarInactiveTintColor: theme.textMuted,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '500' as const },
    }}>
      <Tab.Screen name="SenderOverview" component={SenderOverviewScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
      <Tab.Screen name="MyLoads" component={MyLoadsScreen}
        options={{ tabBarLabel: 'My Loads', tabBarIcon: ({ focused }) => <TabIcon emoji="📦" focused={focused} /> }} />
      {BIDDING_ENABLED && (
        <Tab.Screen name="SenderBookings" component={SenderBookingsScreen}
          options={{ tabBarLabel: 'Bids', tabBarIcon: ({ focused }) => <TabIcon emoji="🤝" focused={focused} /> }} />
      )}
      <Tab.Screen name="SenderChat" component={ConversationsScreen}
        options={{ tabBarLabel: 'Chat', tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }} />
      <Tab.Screen name="SenderProfile" component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

function OwnerTabs() {
  const tabBarStyle = useTabBarStyle();
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle,
      tabBarActiveTintColor: theme.accent,
      tabBarInactiveTintColor: theme.textMuted,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '500' as const },
    }}>
      <Tab.Screen name="OwnerOverview" component={OwnerOverviewScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
      {BIDDING_ENABLED && (
        <Tab.Screen name="AvailableLoads" component={AvailableLoadsScreen}
          options={{ tabBarLabel: 'Loads', tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} /> }} />
      )}
      <Tab.Screen name="OwnerBookings" component={OwnerBookingsScreen}
        options={{ tabBarLabel: 'Bookings', tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} /> }} />
      <Tab.Screen name="OwnerChat" component={ConversationsScreen}
        options={{ tabBarLabel: 'Chat', tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }} />
      <Tab.Screen name="OwnerProfile" component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

function BrokerTabs() {
  const tabBarStyle = useTabBarStyle();
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle,
      tabBarActiveTintColor: theme.accent,
      tabBarInactiveTintColor: theme.textMuted,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '500' as const },
    }}>
      <Tab.Screen name="BrokerDashboard" component={BrokerDashboardScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ focused }) => <TabIcon emoji="🧭" focused={focused} /> }} />
      <Tab.Screen name="BrokerLoads" component={BrokerLoadsScreen}
        options={{ tabBarLabel: 'Loads', tabBarIcon: ({ focused }) => <TabIcon emoji="📦" focused={focused} /> }} />
      <Tab.Screen name="BrokerTrucks" component={BrokerTrucksScreen}
        options={{ tabBarLabel: 'Trucks', tabBarIcon: ({ focused }) => <TabIcon emoji="🚛" focused={focused} /> }} />
      <Tab.Screen name="BrokerChat" component={ConversationsScreen}
        options={{ tabBarLabel: 'Chat', tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }} />
      <Tab.Screen name="BrokerProfile" component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

function DriverTabs() {
  const tabBarStyle = useTabBarStyle();
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarStyle,
      tabBarActiveTintColor: theme.accent,
      tabBarInactiveTintColor: theme.textMuted,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '500' as const },
    }}>
      <Tab.Screen name="DriverActive" component={DriverActiveScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }} />
      <Tab.Screen name="DriverHistory" component={DriverHistoryScreen}
        options={{ tabBarLabel: 'History', tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} /> }} />
      <Tab.Screen name="DriverChat" component={ConversationsScreen}
        options={{ tabBarLabel: 'Chat', tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }} />
      <Tab.Screen name="DriverProfile" component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="SignUpDetails" component={SignUpDetailsScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="NewPassword" component={NewPasswordScreen} />
    </Stack.Navigator>
  );
}

function SenderStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SenderTabs" component={SenderTabs} />
      <Stack.Screen name="LoadDetail" component={LoadDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="PostLoad" component={PostLoadScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="EditLoad" component={EditLoadScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Tracking" component={TrackingScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Verification" component={VerificationScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

function OwnerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OwnerTabs" component={OwnerTabs} />
      {BIDDING_ENABLED && (
        <Stack.Screen name="LoadBid" component={LoadBidScreen} options={{ presentation: 'card' }} />
      )}
      <Stack.Screen name="AddTruck" component={AddTruckScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="EditTruck" component={EditTruckScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Drivers" component={DriversScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="MyFleet" component={MyFleetScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Tracking" component={TrackingScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Verification" component={VerificationScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

function BrokerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BrokerTabs" component={BrokerTabs} />
      {/* Broker-specific modal: match a load to a truck (P3c) */}
      <Stack.Screen name="FindTruck" component={FindTruckScreen} options={{ presentation: 'modal' }} />
      {/* Reused screens — broker views load detail (sender-flavored read-only for now)
          and creates loads using the existing PostLoad form. P3b may swap these for broker-specific variants. */}
      <Stack.Screen name="LoadDetail" component={LoadDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="CreateLoad" component={PostLoadScreen} options={{ presentation: 'modal' }} />
      {/* Shared screens */}
      <Stack.Screen name="Tracking" component={TrackingScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ presentation: 'card' }} />
    </Stack.Navigator>
  );
}

function DriverStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverTabs" component={DriverTabs} />
      <Stack.Screen name="Tracking" component={TrackingScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Verification" component={VerificationScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ProofOfDelivery" component={ProofOfDeliveryScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, setAuth } = useAuthStore();
  const { loadTheme } = useThemeStore();
  const [appState, setAppState] = useState<AppState>('loading');

  useEffect(() => { loadTheme(); }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const seen = await SecureStore.getItemAsync('onboarding_seen');
        if (!seen) { setAppState('onboarding'); return; }

        const token = await SecureStore.getItemAsync('accessToken');
        const userStr = await SecureStore.getItemAsync('user');
        if (token && userStr) {
          const userData = JSON.parse(userStr);
          await setAuth(userData, token);
          setAppState('app');
        } else {
          setAppState('auth');
        }
      } catch {
        setAppState('auth');
      }
    };
    init();
  }, []);

  // React to auth state changes (login/logout) so navigator swaps stacks immediately
  useEffect(() => {
    if (appState === 'loading' || appState === 'onboarding') return;
    if (user && appState === 'auth') setAppState('app');
    if (!user && appState === 'app') setAppState('auth');
  }, [user]);

  if (appState === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (appState === 'onboarding') {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Onboarding">
            {() => <OnboardingScreen onDone={() => setAppState('auth')} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  if (appState === 'auth' || !user) {
    return (
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      {user.role === 'CARGO_SENDER' || user.role === 'ADMIN' ? (
        <SenderStack />
      ) : user.role === 'TRUCK_OWNER' ? (
        <OwnerStack />
      ) : user.role === 'BROKER' ? (
        <BrokerStack />
      ) : (
        <DriverStack />
      )}
    </NavigationContainer>
  );
}
