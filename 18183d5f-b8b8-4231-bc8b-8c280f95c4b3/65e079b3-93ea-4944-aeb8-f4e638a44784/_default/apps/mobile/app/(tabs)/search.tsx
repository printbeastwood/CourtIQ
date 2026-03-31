import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  FlatList,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { searchSlots, fetchVenues } from "../../src/lib/api";
import { useLocationStore } from "../../src/stores/location";
import { SlotCard } from "../../src/components/SlotCard";
import { VenueCard } from "../../src/components/VenueCard";

type SurfaceFilter = "glass" | "panoramic" | "concrete" | "turf";

export default function SearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { latitude, longitude } = useLocationStore();
  const [query, setQuery] = useState("");
  const [surfaces, setSurfaces] = useState<SurfaceFilter[]>([]);
  const [indoor, setIndoor] = useState<boolean | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [mode, setMode] = useState<"venues" | "slots">("venues");

  const toggleSurface = (s: SurfaceFilter) => {
    setSurfaces((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const venuesQuery = useQuery({
    queryKey: ["venues", "search", query, latitude, longitude],
    queryFn: () =>
      fetchVenues({
        lat: latitude ?? undefined,
        lng: longitude ?? undefined,
        radiusKm: 30,
        search: query || undefined,
        limit: 30,
      }),
    enabled: latitude != null,
  });

  const slotsQuery = useQuery({
    queryKey: ["slots", "search", latitude, longitude, surfaces, indoor],
    queryFn: () => {
      const now = new Date();
      const weekLater = new Date(now);
      weekLater.setDate(weekLater.getDate() + 7);
      return searchSlots({
        lat: latitude ?? undefined,
        lng: longitude ?? undefined,
        radiusKm: 30,
        dateFrom: now.toISOString(),
        dateTo: weekLater.toISOString(),
        surface: surfaces.length > 0 ? surfaces : undefined,
        indoor,
        limit: 30,
      });
    },
    enabled: latitude != null && mode === "slots",
  });

  const venues = venuesQuery.data?.venues ?? [];
  const slots = slotsQuery.data?.results ?? [];

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Search bar */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center bg-white rounded-xl px-4 py-3 border border-gray-200">
          <TextInput
            className="flex-1 text-base text-gray-900"
            placeholder={t("search.placeholder")}
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          <Pressable onPress={() => setShowFilters(!showFilters)}>
            <Text className="text-brand-600 font-medium">
              {t("search.filters")}
            </Text>
          </Pressable>
        </View>

        {/* Mode toggle */}
        <View className="flex-row mt-3 gap-2">
          <Pressable
            className={`px-4 py-2 rounded-full ${
              mode === "venues" ? "bg-brand-600" : "bg-gray-200"
            }`}
            onPress={() => setMode("venues")}
          >
            <Text
              className={mode === "venues" ? "text-white font-medium" : "text-gray-600"}
            >
              Venues
            </Text>
          </Pressable>
          <Pressable
            className={`px-4 py-2 rounded-full ${
              mode === "slots" ? "bg-brand-600" : "bg-gray-200"
            }`}
            onPress={() => setMode("slots")}
          >
            <Text
              className={mode === "slots" ? "text-white font-medium" : "text-gray-600"}
            >
              Available Slots
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Filters */}
      {showFilters && (
        <View className="px-4 py-3 bg-white border-b border-gray-100">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            {t("search.surface")}
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {(["glass", "panoramic", "concrete", "turf"] as SurfaceFilter[]).map(
              (s) => (
                <Pressable
                  key={s}
                  className={`px-3 py-1.5 rounded-full ${
                    surfaces.includes(s)
                      ? "bg-brand-100 border-brand-500 border"
                      : "bg-gray-100"
                  }`}
                  onPress={() => toggleSurface(s)}
                >
                  <Text
                    className={
                      surfaces.includes(s)
                        ? "text-brand-700 text-sm"
                        : "text-gray-600 text-sm"
                    }
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

          <View className="flex-row gap-2">
            <Pressable
              className={`px-3 py-1.5 rounded-full ${
                indoor === true ? "bg-brand-100 border-brand-500 border" : "bg-gray-100"
              }`}
              onPress={() => setIndoor(indoor === true ? undefined : true)}
            >
              <Text className="text-sm text-gray-600">{t("search.indoor")}</Text>
            </Pressable>
            <Pressable
              className={`px-3 py-1.5 rounded-full ${
                indoor === false ? "bg-brand-100 border-brand-500 border" : "bg-gray-100"
              }`}
              onPress={() => setIndoor(indoor === false ? undefined : false)}
            >
              <Text className="text-sm text-gray-600">{t("search.outdoor")}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Results */}
      <ScrollView className="flex-1 px-4 pt-3">
        {mode === "venues" &&
          venues.map((v) => (
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

        {mode === "slots" &&
          slots.map((r) => (
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

        {((mode === "venues" && !venuesQuery.isLoading && venues.length === 0) ||
          (mode === "slots" && !slotsQuery.isLoading && slots.length === 0)) && (
          <Text className="text-center text-gray-400 py-12">
            {t("search.no_results")}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
