import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "../src/stores/auth";
import { useLocationStore } from "../src/stores/location";
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

  useEffect(() => {
    hydrate();
    requestLocation();
  }, [hydrate, requestLocation]);

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
              headerTitle: "Confirm Booking",
              animation: "slide_from_bottom",
              presentation: "modal",
            }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
