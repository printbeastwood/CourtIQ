import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchVenues, searchSlots, type VenueListResponse, type SlotSearchResponse } from "../../src/lib/api";
import { useLocationStore } from "../../src/stores/location";
import { VenueCard } from "../../src/components/VenueCard";
import { SlotCard } from "../../src/components/SlotCard";
import { ErrorView } from "../../src/components/ErrorView";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { latitude, longitude } = useLocationStore();

  const venuesQuery = useQuery({
    queryKey: ["venues", "nearby", latitude, longitude],
    queryFn: () =>
      fetchVenues({
        lat: latitude ?? undefined,
        lng: longitude ?? undefined,
        radiusKm: 15,
        limit: 10,
      }),
    enabled: latitude != null,
  });

  const slotsQuery = useQuery({
    queryKey: ["slots", "suggested", latitude, longitude],
    queryFn: () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return searchSlots({
        lat: latitude ?? undefined,
        lng: longitude ?? undefined,
        radiusKm: 15,
        dateFrom: now.toISOString(),
        dateTo: tomorrow.toISOString(),
        limit: 5,
      });
    },
    enabled: latitude != null,
  });

  const venues = venuesQuery.data?.venues ?? [];
  const slots = slotsQuery.data?.results ?? [];

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6"
        refreshControl={
          <RefreshControl
            refreshing={venuesQuery.isRefreshing || slotsQuery.isRefreshing}
            onRefresh={() => {
              venuesQuery.refetch();
              slotsQuery.refetch();
            }}
          />
        }
      >
        {/* Header */}
        <View className="pt-4 pb-6">
          <Text className="text-3xl font-bold text-gray-900">
            {t("home.title")}
          </Text>
          <Text className="text-base text-gray-500 mt-1">
            {t("onboarding.subtitle")}
          </Text>
        </View>

        {/* Suggested slots */}
        {slots.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              {t("home.suggested")}
            </Text>
            {slots.map((r) => (
              <SlotCard
                key={r.slot.id}
                venueName={r.venue.name}
                courtName={r.court.name}
                surface={r.court.surface}
                indoor={r.court.indoor}
                startsAt={r.slot.startsAt}
                endsAt={r.slot.endsAt}
                priceCents={r.slot.priceCents}
                currency={r.slot.currency}
                onPress={() => router.push(`/booking/${r.slot.id}`)}
              />
            ))}
          </View>
        )}

        {/* Nearby venues */}
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-lg font-semibold text-gray-900">
            {t("home.nearby")}
          </Text>
          <Text
            className="text-sm text-brand-600"
            onPress={() => router.push("/(tabs)/search")}
          >
            {t("home.view_all")}
          </Text>
        </View>

        {venuesQuery.isError && (
          <ErrorView
            message={venuesQuery.error?.message}
            onRetry={() => venuesQuery.refetch()}
          />
        )}

        {venues.map((v) => (
          <VenueCard
            key={v.id}
            id={v.id}
            name={v.name}
            address={v.address}
            amenities={v.amenities}
            distance_km={v.distance_km}
            courtCount={v.courtCount}
          />
        ))}

        {!venuesQuery.isLoading && venues.length === 0 && !venuesQuery.isError && (
          <Text className="text-center text-gray-400 py-12">
            {t("search.no_results")}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
