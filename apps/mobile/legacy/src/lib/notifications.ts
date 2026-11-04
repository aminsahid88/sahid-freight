// TODO: re-enable push notifications when paid Apple Developer account is set up
// Free Apple Developer accounts don't support the Push Notifications capability.
//
// import * as Notifications from "expo-notifications";
// import * as Device from "expo-device";
// import { Platform } from "react-native";
// import { api } from "./api";
//
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: true,
//   }),
// });

export async function registerForPushNotifications(): Promise<string | null> {
  // TODO: re-enable push notifications when paid Apple Developer account is set up
  return null;
}

export function addNotificationListener(
  onNotification: (notification: unknown) => void,
  onResponse: (response: unknown) => void
) {
  // TODO: re-enable push notifications when paid Apple Developer account is set up
  return () => {};
}
