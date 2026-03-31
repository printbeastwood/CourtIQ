import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchVenueDetail, fetchVenueSlots } from "../../src/lib/api";
import { formatPrice, formatTime, surfaceLabel, surfaceColor } from "../../src/lib/format";
import { LoadingScreen } from "../../src/components/LoadingScreen";
import { ErrorView } from "../../src/components/ErrorView";

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);

  // Generate next 7 days for date picker
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      value: d.toISOString().split("T")[0],
      label: d.toLocaleDateString([], { weekday: "short", day: "numeric" }),
      isToday: i === 0,
    };
  });

  const venueQuery = useQuery({
    queryKey: ["venue", id],
    queryFn: () => fetchVenueDetail(id!),
    enabled: !!id,
  });

  const slotsQuery = useQuery({
    queryKey: ["venue-slots", id, selectedDate],
    queryFn: () => fetchVenueSlots(id!, selectedDate),
    enabled: !!id,
  });

  if (venueQuery.isLoading) return <LoadingScreen />;
  if (venueQuery.isError) {
    return (
      <ErrorView
        message={venueQuery.error?.message}
        onRetry={() => venueQuery.refetch()}
      />
    );
  }

  const venue = venueQuery.data?.venue;
  if (!venue) return <ErrorView message="Venue not found" />;

  const slots = slotsQuery.data?.slots ?? [];

  return (
    <ScrollView className="flex-1 bg-slate-50">
      {/* Venue header */}
      <View className="bg-brand-950 pt-24 pb-8 px-4">
        <Text className="text-3xl font-bold text-white">{venue.name}</Text>
        <Text className="text-brand-300 mt-1">{venue.address}</Text>
      </View>

      {/* Courts */}
      <View className="px-4 pt-4">
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          {t("venue.courts")} ({venue.courts.length})
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {venue.courts.map((court) => (
            <View
              key={court.id}
              className="bg-white rounded-xl p-3 mr-3 w-36 border border-gray-100"
            >
              <Text className="font-medium text-gray-900">{court.name}</Text>
              <View className="flex-row items-center mt-1">
                <View
                  className="w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: surfaceColor(court.surface) }}
                />
                <Text className="text-xs text-gray-500">
                  {surfaceLabel(court.surface)}
                </Text>
              </View>
              <Text className="text-xs text-gray-400 mt-0.5">
                {court.indoor ? "Indoor" : "Outdoor"}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Amenities */}
        {venue.amenities.length > 0 && (
          <View className="mb-4">
            <Text className="text-lg font-semibold text-gray-900 mb-2">
              {t("venue.amenities")}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {venue.amenities.map((a) => (
                <View key={a} className="bg-brand-50 px-3 py-1.5 rounded-full">
                  <Text className="text-sm text-brand-700">{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Date picker */}
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          {t("venue.available_slots")}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
        >
          {dates.map((d) => (
            <Pressable
              key={d.value}
              className={`px-4 py-2 mr-2 rounded-xl ${
                selectedDate === d.value
                  ? "bg-brand-600"
                  : "bg-white border border-gray-200"
              }`}
              onPress={() => setSelectedDate(d.value)}
            >
              <Text
                className={`text-sm font-medium ${
                  selectedDate === d.value ? "text-white" : "text-gray-700"
                }`}
              >
                {d.isToday ? "Today" : d.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Slots */}
        {slotsQuery.isLoading && (
          <Text className="text-center text-gray-400 py-8">
            {t("common.loading")}
          </Text>
        )}

        {slots.map((r) => (
          <Pressable
            key={r.slot.id}
            className="bg-white rounded-xl p-4 mb-2 border border-gray-100 flex-row justify-between items-center"
            onPress={() => router.push(`/booking/${r.slot.id}`)}
          >
            <View>
              <Text className="text-base font-semibold text-gray-900">
                {formatTime(r.slot.startsAt)} – {formatTime(r.slot.endsAt)}
              </Text>
              <Text className="text-sm text-gray-500">{r.court.name}</Text>
            </View>
            <View className="items-end">
              <Text className="text-lg font-bold text-brand-600">
                {formatPrice(r.slot.priceCents, r.slot.currency)}
              </Text>
              <Text className="text-xs text-gray-400">
                {t("venue.per_hour")}
              </Text>
            </View>
          </Pressable>
        ))}

        {!slotsQuery.isLoading && slots.length === 0 && (
          <Text className="text-center text-gray-400 py-8">
            No slots available for this date
          </Text>
        )}
      </View>

      <View className="h-8" />
    </ScrollView>
  );
}
