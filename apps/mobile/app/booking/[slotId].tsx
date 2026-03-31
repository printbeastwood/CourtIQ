import { useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Card, Button, Badge, SurfaceBadge, BallIcon } from "@courtiq/ui";
import { useAuthStore } from "../../src/stores/auth";
import {
  createRedirectBooking,
  confirmBooking,
  type RedirectBookingResponse,
} from "../../src/lib/api";
import { formatPrice, formatTime, formatDate } from "../../src/lib/format";

const PLATFORM_LABELS: Record<string, string> = {
  playtomic: "Playtomic",
  reclub: "Reclub",
  matchi: "MATCHi",
  book_and_go: "Book & Go",
  padel_mates: "Padel Mates",
  padel_society: "Padel Society",
  club_direct: "Venue Website",
};

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

type BookingPhase = "details" | "redirecting" | "confirm";

export default function BookingConfirmScreen() {
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<BookingPhase>("details");
  const [bookingData, setBookingData] = useState<RedirectBookingResponse | null>(null);

  // Create redirect booking + open platform URL
  const redirectMutation = useMutation({
    mutationFn: async () => {
      if (!slotId) throw new Error("No slot selected");
      const data = await createRedirectBooking(slotId);
      setBookingData(data);

      if (data.bookingUrl) {
        setPhase("redirecting");
        await Linking.openURL(data.bookingUrl);
        // User returns from external app/browser
        setPhase("confirm");
      } else {
        // No booking URL available — go straight to confirm
        setPhase("confirm");
      }
      return data;
    },
  });

  // Confirm or cancel the booking after redirect
  const confirmMutation = useMutation({
    mutationFn: async (status: "confirmed" | "cancelled") => {
      if (!bookingData) throw new Error("No booking data");
      return confirmBooking(bookingData.booking.id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      router.back();
    },
  });

  const error = redirectMutation.error || confirmMutation.error;

  // === Phase: Details (pre-redirect) ===
  if (phase === "details") {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={["bottom"]}>
        <View className="flex-1 px-5 pt-6">
          <Animated.View entering={FadeInUp.duration(400)}>
            <Card variant="elevated">
              <View className="items-center mb-5">
                <View className="w-14 h-14 rounded-full bg-brand-100 items-center justify-center mb-3">
                  <BallIcon size={28} color="#2563EB" />
                </View>
                <Text className="text-xl font-bold text-gray-900">
                  {t("booking.confirm")}
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                  You'll be redirected to complete booking
                </Text>
              </View>

              {/* Slot info placeholder — shows slot ID before redirect */}
              <View className="bg-gray-50 rounded-xl p-4 mb-4 gap-3">
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Slot</Text>
                  <Badge variant="brand">{slotId?.slice(0, 8) ?? ""}</Badge>
                </View>
              </View>

              <Text className="text-sm text-gray-400 text-center leading-5 mb-5">
                We'll open the booking platform where you can complete your reservation. Come back here to confirm.
              </Text>

              {error && (
                <View className="bg-red-50 rounded-xl p-3 mb-4">
                  <Text className="text-sm text-red-600 text-center">
                    {error instanceof Error ? error.message : "Something went wrong"}
                  </Text>
                </View>
              )}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={redirectMutation.isPending}
                onPress={() => redirectMutation.mutate()}
              >
                Continue to Book
              </Button>
            </Card>
          </Animated.View>
        </View>

        <View className="px-5 pb-4">
          <Pressable className="py-3 items-center" onPress={() => router.back()}>
            <Text className="text-gray-500 font-medium">{t("common.cancel")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // === Phase: Redirecting (brief transitional state) ===
  if (phase === "redirecting") {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center" edges={["bottom"]}>
        <View className="items-center px-8">
          <View className="w-16 h-16 rounded-full bg-brand-100 items-center justify-center mb-4">
            <BallIcon size={32} color="#2563EB" />
          </View>
          <Text className="text-lg font-semibold text-gray-900 text-center">
            Opening {bookingData ? platformLabel(bookingData.venue.sourcePlatform) : "platform"}...
          </Text>
          <Text className="text-sm text-gray-500 mt-2 text-center">
            Complete your booking there, then come back here
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // === Phase: Post-redirect confirmation ===
  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["bottom"]}>
      <View className="flex-1 px-5 pt-6">
        <Animated.View entering={FadeInUp.duration(400)}>
          <Card variant="elevated">
            <View className="items-center mb-5">
              <View className="w-14 h-14 rounded-full bg-emerald-100 items-center justify-center mb-3">
                <BallIcon size={28} color="#10B981" />
              </View>
              <Text className="text-xl font-bold text-gray-900">
                Did you complete your booking?
              </Text>
            </View>

            {/* Booking details */}
            {bookingData && (
              <View className="bg-gray-50 rounded-xl p-4 mb-4 gap-2.5">
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Venue</Text>
                  <Text className="text-sm font-medium text-gray-900">
                    {bookingData.venue.name}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Court</Text>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm font-medium text-gray-900">
                      {bookingData.court.name}
                    </Text>
                    <SurfaceBadge surface={bookingData.court.surface as any} />
                  </View>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Date</Text>
                  <Text className="text-sm font-medium text-gray-900">
                    {formatDate(bookingData.slot.startsAt)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Time</Text>
                  <Text className="text-sm font-medium text-gray-900">
                    {formatTime(bookingData.slot.startsAt)} – {formatTime(bookingData.slot.endsAt)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Price</Text>
                  <Text className="text-base font-bold text-brand-600">
                    {formatPrice(bookingData.slot.priceCents, bookingData.slot.currency)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Platform</Text>
                  <Badge variant="brand">
                    {platformLabel(bookingData.venue.sourcePlatform)}
                  </Badge>
                </View>
              </View>
            )}

            {error && (
              <View className="bg-red-50 rounded-xl p-3 mb-4">
                <Text className="text-sm text-red-600 text-center">
                  {error instanceof Error ? error.message : "Something went wrong"}
                </Text>
              </View>
            )}

            <View className="gap-3">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={confirmMutation.isPending && confirmMutation.variables === "confirmed"}
                onPress={() => confirmMutation.mutate("confirmed")}
              >
                Yes, I booked it
              </Button>
              <Button
                variant="ghost"
                size="lg"
                fullWidth
                loading={confirmMutation.isPending && confirmMutation.variables === "cancelled"}
                onPress={() => confirmMutation.mutate("cancelled")}
              >
                No, I didn't book
              </Button>
            </View>
          </Card>

          {/* Re-open platform link */}
          {bookingData?.bookingUrl && (
            <Pressable
              className="mt-4 py-3 items-center"
              onPress={() => {
                if (bookingData.bookingUrl) {
                  Linking.openURL(bookingData.bookingUrl);
                }
              }}
            >
              <Text className="text-brand-600 font-medium text-sm">
                Open {platformLabel(bookingData.venue.sourcePlatform)} again
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
