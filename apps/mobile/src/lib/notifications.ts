import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { useAuthStore } from "../stores/auth";
import { api } from "./api";

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowInForeground: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return null;
  }

  // Get the FCM token (Android) or APNs token mapped through FCM (iOS)
  const tokenData = await Notifications.getDevicePushTokenAsync();
  const token = tokenData.data;

  // Register with our backend
  const platform = Platform.OS === "ios" ? "ios" : "android";
  try {
    await api.post("/devices/register", { token, platform });
  } catch (err) {
    console.error("Failed to register device token:", err);
  }

  return token;
}

export function useNotificationListeners() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (!userId) return;

    // Register token on app launch
    registerForPushNotifications();

    // Listen for token refreshes
    const tokenSub = Notifications.addPushTokenListener((tokenEvent) => {
      const platform = Platform.OS === "ios" ? "ios" : "android";
      api.post("/devices/register", {
        token: tokenEvent.data,
        platform,
      }).catch((err) =>
        console.error("Failed to re-register device token:", err),
      );
    });

    // Listen for notifications received while app is foregrounded
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        // Update badge count if needed
        const badge = notification.request.content.badge;
        if (badge !== undefined) {
          Notifications.setBadgeCountAsync(badge);
        }
      });

    // Listen for notification taps — navigate to correct screen
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        const screen = data?.screen as string | undefined;

        if (screen === "post-match-feedback" && data?.matchId) {
          router.push({
            pathname: "/post-match-feedback",
            params: { matchId: data.matchId as string },
          });
        } else if (screen === "booking-detail" && data?.bookingId) {
          router.push("/(tabs)/bookings");
        } else if (screen === "match-detail" && data?.matchId) {
          router.push("/match-history");
        }

        // Clear badge on tap
        Notifications.setBadgeCountAsync(0);
      });

    return () => {
      tokenSub.remove();
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current,
        );
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(
          responseListener.current,
        );
      }
    };
  }, [userId, router]);
}
