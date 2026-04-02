import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Linking from "expo-linking";
import { useAuthStore, subscribeToAuthState } from "../src/stores/auth";
import { useLocationStore } from "../src/stores/location";
import { useReferralStore } from "../src/stores/referral";
import { useNotificationListeners } from "../src/lib/notifications";
import "../src/i18n";
import "../global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const requestLocation = useLocationStore((s) => s.requestLocation);
  const hydrateReferral = useReferralStore((s) => s.hydrate);
  const setPendingCode = useReferralStore((s) => s.setPendingCode);

  // Register push notification listeners and handle navigation on tap
  useNotificationListeners();

  useEffect(() => {
    hydrate();
    hydrateReferral();
    requestLocation();
    const unsubscribe = subscribeToAuthState();

    // Handle deep links for referral codes (courtiq:///r/CODE or https://courtiq.app/r/CODE)
    const handleDeepLink = ({ url }: { url: string }) => {
      const refMatch = url.match(/\/r\/([A-Za-z0-9]+)/);
      if (refMatch?.[1]) {
        setPendingCode(refMatch[1].toUpperCase());
      }
    };

    // Check initial URL (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    // Listen for incoming links (warm start)
    const linkSub = Linking.addEventListener("url", handleDeepLink);

    return () => {
      unsubscribe();
      linkSub.remove();
    };
  }, [hydrate, hydrateReferral, requestLocation, setPendingCode]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#F8FAFC" },
          }}
        >
          <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
          <Stack.Screen name="onboarding" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
          <Stack.Screen
            name="venue/[id]"
            options={{
              headerShown: true,
              headerTransparent: true,
              headerTitle: "",
              headerTintColor: "#fff",
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="booking/[slotId]"
            options={{
              headerShown: true,
              headerTitle: "Book Court",
              animation: "slide_from_bottom",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="booking-detail/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="create-match"
            options={{
              headerShown: false,
              animation: "slide_from_bottom",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="upcoming-matches"
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="match-detail"
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="match-result"
            options={{
              headerShown: false,
              animation: "slide_from_bottom",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="match-history"
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="post-match-feedback"
            options={{
              headerShown: false,
              animation: "slide_from_bottom",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="referrals"
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
