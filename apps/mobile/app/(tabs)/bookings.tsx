import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Card, Badge, SurfaceBadge, CourtIcon } from "@courtiq/ui";
import { fetchBookings, type BookingListItem } from "../../src/lib/api";
import { useAuthStore } from "../../src/stores/auth";
import { formatDate, formatTime, formatPrice } from "../../src/lib/format";

type TabKey = "upcoming" | "past";

const STATUS_VARIANT: Record<string, "warning" | "success" | "error"> = {
  pending: "warning",
  confirmed: "success",
  cancelled: "error",
  payment_failed: "error",
};

const STATUS_ICON: Record<string, string> = {
  pending: "time-outline",
  confirmed: "checkmark-circle-outline",
  cancelled: "close-circle-outline",
  payment_failed: "alert-circle-outline",
};

function isSlotPast(endsAt: string): boolean {
  return new Date(endsAt).getTime() < Date.now();
}

function BookingCard({ booking, onPress }: { booking: BookingListItem; onPress: () => void }) {
  const { t } = useTranslation();
  const past = isSlotPast(booking.slot.endsAt);

  return (
    <Pressable onPress={onPress} className="mb-3">
      <Card variant="default">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-3">
            <Text className="text-base font-semibold text-gray-900">
              {booking.venue.name}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-1">
              <Text className="text-sm text-gray-500">
                {booking.court.name}
              </Text>
              <SurfaceBadge surface={booking.court.surface as any} />
            </View>
          </View>
          <Badge variant={STATUS_VARIANT[booking.status] ?? "default"}>
            {t(`booking.status_${booking.status}`)}
          </Badge>
        </View>

        <View className="flex-row items-center mt-3 gap-2">
          <Ionicons name="calendar-outline" size={14} color="#6B7280" />
          <Text className="text-sm text-gray-600">
            {formatDate(booking.slot.startsAt)}
          </Text>
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <Text className="text-sm text-gray-600">
            {formatTime(booking.slot.startsAt)} –{" "}
            {formatTime(booking.slot.endsAt)}
          </Text>
        </View>

        <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-gray-50">
          <Text className="text-base font-bold text-brand-600">
            {formatPrice(booking.slot.priceCents, booking.slot.currency)}
          </Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-xs text-gray-400">View details</Text>
            <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const { t } = useTranslation();
  return (
    <Animated.View
      entering={FadeInUp.delay(100).duration(400)}
      className="items-center justify-center py-20"
    >
      <CourtIcon size={48} color="#CBD5E1" />
      <Text className="text-lg font-medium text-gray-400 mt-3">
        {tab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
      </Text>
      <Text className="text-sm text-gray-300 mt-1 text-center px-8">
        {tab === "upcoming"
          ? "Book a court and it will show up here"
          : "Your completed bookings will appear here"}
      </Text>
    </Animated.View>
  );
}

export default function BookingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const [activeTab, setActiveTab] = useState<TabKey>("upcoming");

  const bookingsQuery = useQuery({
    queryKey: ["bookings", userId],
    queryFn: fetchBookings,
    enabled: !!userId,
  });

  const bookings = bookingsQuery.data?.bookings ?? [];

  const { upcoming, past } = useMemo(() => {
    const upcomingList: BookingListItem[] = [];
    const pastList: BookingListItem[] = [];

    for (const b of bookings) {
      if (b.status === "cancelled") {
        pastList.push(b);
      } else if (isSlotPast(b.slot.endsAt)) {
        pastList.push(b);
      } else {
        upcomingList.push(b);
      }
    }

    // Sort upcoming by start time ascending, past by start time descending
    upcomingList.sort(
      (a, b) =>
        new Date(a.slot.startsAt).getTime() -
        new Date(b.slot.startsAt).getTime(),
    );
    pastList.sort(
      (a, b) =>
        new Date(b.slot.startsAt).getTime() -
        new Date(a.slot.startsAt).getTime(),
    );

    return { upcoming: upcomingList, past: pastList };
  }, [bookings]);

  const displayList = activeTab === "upcoming" ? upcoming : past;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-gray-900">
          {t("booking.history")}
        </Text>
      </View>

      {/* Tab Bar */}
      <View className="flex-row mx-5 mb-3 bg-gray-100 rounded-xl p-1">
        {(["upcoming", "past"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const count = tab === "upcoming" ? upcoming.length : past.length;
          return (
            <Pressable
              key={tab}
              className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
                isActive ? "bg-white shadow-sm" : ""
              }`}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                className={`text-sm font-semibold ${
                  isActive ? "text-gray-900" : "text-gray-500"
                }`}
              >
                {tab === "upcoming" ? "Upcoming" : "Past"}
              </Text>
              {count > 0 && (
                <View
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-brand-100" : "bg-gray-200"
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isActive ? "text-brand-600" : "text-gray-500"
                    }`}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
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
        {displayList.length === 0 && !bookingsQuery.isLoading && (
          <EmptyState tab={activeTab} />
        )}

        {displayList.map((b, index) => (
          <Animated.View
            key={b.id}
            entering={FadeInUp.delay(index * 60).duration(350)}
          >
            <BookingCard
              booking={b}
              onPress={() =>
                router.push({
                  pathname: "/booking-detail/[id]",
                  params: { id: b.id },
                })
              }
            />
          </Animated.View>
        ))}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
