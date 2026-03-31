import { View, Text, ScrollView, RefreshControl, Linking, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Card, Badge, SurfaceBadge, CourtIcon } from "@courtiq/ui";
import { fetchBookings, type BookingListItem } from "../../src/lib/api";
import { useAuthStore } from "../../src/stores/auth";
import { formatDate, formatTime, formatPrice } from "../../src/lib/format";

const STATUS_VARIANT: Record<string, "warning" | "success" | "error"> = {
  pending: "warning",
  confirmed: "success",
  cancelled: "error",
};

const PLATFORM_LABELS: Record<string, string> = {
  playtomic: "Playtomic",
  reclub: "Reclub",
  matchi: "MATCHi",
  book_and_go: "Book & Go",
  padel_mates: "Padel Mates",
  padel_society: "Padel Society",
  club_direct: "Venue Website",
};

function isSlotPast(endsAt: string): boolean {
  return new Date(endsAt).getTime() < Date.now();
}

export default function BookingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);

  const bookingsQuery = useQuery({
    queryKey: ["bookings", userId],
    queryFn: fetchBookings,
    enabled: !!userId,
  });

  const bookings = bookingsQuery.data?.bookings ?? [];

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-gray-900">
          {t("booking.history")}
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        refreshControl={
          <RefreshControl
            refreshing={bookingsQuery.isRefetching ?? false}
            onRefresh={() => bookingsQuery.refetch()}
          />
        }
      >
        {bookings.length === 0 && !bookingsQuery.isLoading && (
          <Animated.View
            entering={FadeInUp.delay(100).duration(400)}
            className="items-center justify-center py-20"
          >
            <CourtIcon size={48} color="#CBD5E1" />
            <Text className="text-lg font-medium text-gray-400 mt-3">
              {t("booking.empty")}
            </Text>
            <Text className="text-sm text-gray-300 mt-1 text-center px-8">
              Your bookings will appear here after you reserve a court
            </Text>
          </Animated.View>
        )}

        {bookings.map((b) => (
          <Pressable
            key={b.id}
            className="mb-3"
            onPress={() => {
              if (b.slot.sourceBookingUrl && b.status === "pending") {
                Linking.openURL(b.slot.sourceBookingUrl);
              }
            }}
          >
            <Card variant="default">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 mr-3">
                  <Text className="text-base font-semibold text-gray-900">
                    {b.venue.name}
                  </Text>
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {b.court.name}
                  </Text>
                </View>
                <Badge variant={STATUS_VARIANT[b.status] ?? "default"}>
                  {t(`booking.status_${b.status}`)}
                </Badge>
              </View>

              <View className="flex-row items-center mt-2.5 gap-1.5">
                <SurfaceBadge surface={b.court.surface as any} />
                <Badge variant="default">
                  {PLATFORM_LABELS[b.venue.sourcePlatform] ?? b.venue.sourcePlatform}
                </Badge>
              </View>

              <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-gray-50">
                <Text className="text-sm text-gray-500">
                  {formatDate(b.slot.startsAt)} ·{" "}
                  {formatTime(b.slot.startsAt)} – {formatTime(b.slot.endsAt)}
                </Text>
                <Text className="text-base font-bold text-brand-600">
                  {formatPrice(b.slot.priceCents, b.slot.currency)}
                </Text>
              </View>

              {b.status === "confirmed" && isSlotPast(b.slot.endsAt) && (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/post-match-feedback",
                      params: {
                        bookingId: b.id,
                        venueName: b.venue.name,
                      },
                    })
                  }
                  className="mt-3 py-2.5 rounded-xl bg-brand-50 items-center border border-brand-100"
                >
                  <Text className="text-sm font-semibold text-brand-600">
                    {t("feedback.give_feedback")}
                  </Text>
                </Pressable>
              )}
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
