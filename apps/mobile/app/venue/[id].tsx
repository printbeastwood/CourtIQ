import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Card,
  Badge,
  SurfaceBadge,
  SlotPicker,
  Button,
  type TimeSlot,
  CourtIcon,
} from "@courtiq/ui";
import { fetchVenueDetail, fetchVenueSlots } from "../../src/lib/api";
import {
  formatPrice,
  formatTime,
  surfaceLabel,
  surfaceColor,
} from "../../src/lib/format";
import { LoadingScreen } from "../../src/components/LoadingScreen";
import { ErrorView } from "../../src/components/ErrorView";

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      value: d.toISOString().split("T")[0],
      dayName: d.toLocaleDateString([], { weekday: "short" }),
      dayNum: d.getDate(),
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

  const rawSlots = slotsQuery.data?.slots ?? [];
  const slotPickerData: TimeSlot[] = rawSlots.map((r) => ({
    id: r.slot.id,
    startsAt: r.slot.startsAt,
    endsAt: r.slot.endsAt,
    available: r.slot.status === "available",
    priceCents: r.slot.priceCents,
    currency: r.slot.currency,
  }));

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView className="flex-1">
        {/* Hero */}
        <View className="bg-brand-950 pt-28 pb-6 px-5">
          <Text className="text-3xl font-extrabold text-white">{venue.name}</Text>
          <Text className="text-brand-300 mt-1.5 text-sm">{venue.address}</Text>
          <View className="flex-row flex-wrap gap-1.5 mt-3">
            {venue.amenities.map((a) => (
              <Badge key={a} variant="brand">
                {a}
              </Badge>
            ))}
          </View>
        </View>

        <View className="px-5 pt-5">
          {/* Courts section */}
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Courts ({venue.courts.length})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-5"
            contentContainerStyle={{ gap: 10 }}
          >
            {venue.courts.map((court) => (
              <View key={court.id} className="w-36">
                <Card variant="elevated" padded>
                  <Text className="font-semibold text-gray-900 text-sm">
                    {court.name}
                  </Text>
                  <View className="mt-2 gap-1.5">
                    <SurfaceBadge surface={court.surface as any} />
                    <Badge variant="default">
                      {court.indoor ? "Indoor" : "Outdoor"}
                    </Badge>
                  </View>
                </Card>
              </View>
            ))}
          </ScrollView>

          {/* Date picker */}
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Available Slots
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
            contentContainerStyle={{ gap: 8 }}
          >
            {dates.map((d) => (
              <Pressable
                key={d.value}
                className={`w-14 items-center py-2.5 rounded-xl border ${
                  selectedDate === d.value
                    ? "bg-brand-600 border-brand-600"
                    : "bg-white border-gray-200"
                }`}
                onPress={() => {
                  setSelectedDate(d.value);
                  setSelectedSlot(null);
                }}
              >
                <Text
                  className={`text-xs font-medium ${
                    selectedDate === d.value ? "text-brand-100" : "text-gray-400"
                  }`}
                >
                  {d.isToday ? "Today" : d.dayName}
                </Text>
                <Text
                  className={`text-lg font-bold mt-0.5 ${
                    selectedDate === d.value ? "text-white" : "text-gray-900"
                  }`}
                >
                  {d.dayNum}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Slot picker */}
          {slotsQuery.isLoading && (
            <View className="items-center py-12">
              <Text className="text-gray-400">{t("common.loading")}</Text>
            </View>
          )}

          {!slotsQuery.isLoading && slotPickerData.length > 0 && (
            <SlotPicker
              slots={slotPickerData}
              selectedId={selectedSlot?.id ?? null}
              onSelect={(slot) => setSelectedSlot(slot)}
              formatTime={(iso) => formatTime(iso)}
              formatPrice={(cents, currency) => formatPrice(cents, currency)}
            />
          )}

          {!slotsQuery.isLoading && slotPickerData.length === 0 && (
            <View className="items-center py-12">
              <CourtIcon size={36} color="#CBD5E1" />
              <Text className="text-gray-400 mt-2">
                No slots available for this date
              </Text>
            </View>
          )}
        </View>

        <View className="h-24" />
      </ScrollView>

      {/* Sticky book button */}
      {selectedSlot && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 pb-8">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-sm text-gray-500">
                {formatTime(selectedSlot.startsAt)} –{" "}
                {formatTime(selectedSlot.endsAt)}
              </Text>
            </View>
            <Text className="text-xl font-bold text-brand-600">
              {formatPrice(
                selectedSlot.priceCents ?? 0,
                selectedSlot.currency ?? "THB",
              )}
            </Text>
          </View>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => router.push(`/booking/${selectedSlot.id}`)}
          >
            Book this slot
          </Button>
        </View>
      )}
    </View>
  );
}
