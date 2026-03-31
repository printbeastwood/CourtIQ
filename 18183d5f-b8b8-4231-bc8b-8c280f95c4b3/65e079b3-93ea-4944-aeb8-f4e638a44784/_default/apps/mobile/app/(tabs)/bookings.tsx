import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../src/lib/api";
import { useAuthStore } from "../../src/stores/auth";
import { formatDate, formatTime, formatPrice } from "../../src/lib/format";

interface Booking {
  id: string;
  status: "pending" | "confirmed" | "cancelled";
  slot: {
    startsAt: string;
    endsAt: string;
    priceCents: number;
    currency: string;
  };
  venue: {
    name: string;
  };
  court: {
    name: string;
    surface: string;
  };
}

export default function BookingsScreen() {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.userId);

  // Note: booking list endpoint not in current API — using placeholder
  const bookingsQuery = useQuery({
    queryKey: ["bookings", userId],
    queryFn: async () => {
      // TODO: Implement when booking list endpoint is available
      return { bookings: [] as Booking[] };
    },
    enabled: !!userId,
  });

  const bookings = bookingsQuery.data?.bookings ?? [];

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700",
      confirmed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      pending: t("booking.status_pending"),
      confirmed: t("booking.status_confirmed"),
      cancelled: t("booking.status_cancelled"),
    };
    return (
      <View className={`px-2 py-1 rounded-full ${styles[status] ?? "bg-gray-100"}`}>
        <Text className={`text-xs font-medium ${styles[status] ?? "text-gray-600"}`}>
          {labels[status] ?? status}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-gray-900">
          {t("booking.history")}
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={bookingsQuery.isRefreshing}
            onRefresh={() => bookingsQuery.refetch()}
          />
        }
      >
        {bookings.length === 0 && (
          <View className="items-center justify-center py-20">
            <Text className="text-5xl mb-4">📋</Text>
            <Text className="text-lg text-gray-400">{t("booking.empty")}</Text>
          </View>
        )}

        {bookings.map((b) => (
          <View
            key={b.id}
            className="bg-white rounded-xl p-4 mb-3 border border-gray-100"
          >
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">
                  {b.venue.name}
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                  {b.court.name} · {b.court.surface}
                </Text>
              </View>
              {statusBadge(b.status)}
            </View>
            <View className="flex-row justify-between mt-3">
              <Text className="text-sm text-gray-600">
                {formatDate(b.slot.startsAt)} · {formatTime(b.slot.startsAt)} –{" "}
                {formatTime(b.slot.endsAt)}
              </Text>
              <Text className="text-sm font-semibold text-brand-600">
                {formatPrice(b.slot.priceCents, b.slot.currency)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
