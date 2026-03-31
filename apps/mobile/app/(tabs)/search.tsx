import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Input,
  Card,
  Badge,
  SurfaceBadge,
  BottomSheet,
  Button,
  CourtIcon,
} from "@courtiq/ui";
import { searchSlots, fetchVenues } from "../../src/lib/api";
import { useLocationStore } from "../../src/stores/location";
import { formatPrice, formatTime, formatDistance } from "../../src/lib/format";

type SurfaceFilter = "glass" | "panoramic" | "concrete" | "turf";
const ALL_SURFACES: SurfaceFilter[] = ["glass", "panoramic", "concrete", "turf"];

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

  const activeFilterCount =
    surfaces.length + (indoor !== undefined ? 1 : 0);

  const clearFilters = () => {
    setSurfaces([]);
    setIndoor(undefined);
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
      <View className="px-5 pt-4 pb-2">
        <Input
          variant="search"
          placeholder={t("search.placeholder")}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />

        {/* Mode toggle + filter button */}
        <View className="flex-row items-center mt-3 gap-2">
          <Pressable
            className={`px-4 py-2 rounded-full ${
              mode === "venues" ? "bg-brand-600" : "bg-white border border-gray-200"
            }`}
            onPress={() => setMode("venues")}
          >
            <Text
              className={`text-sm font-medium ${
                mode === "venues" ? "text-white" : "text-gray-600"
              }`}
            >
              Venues
            </Text>
          </Pressable>
          <Pressable
            className={`px-4 py-2 rounded-full ${
              mode === "slots" ? "bg-brand-600" : "bg-white border border-gray-200"
            }`}
            onPress={() => setMode("slots")}
          >
            <Text
              className={`text-sm font-medium ${
                mode === "slots" ? "text-white" : "text-gray-600"
              }`}
            >
              Available Slots
            </Text>
          </Pressable>

          <View className="flex-1" />

          <Pressable
            className={`flex-row items-center px-3 py-2 rounded-full border ${
              activeFilterCount > 0
                ? "border-brand-500 bg-brand-50"
                : "border-gray-200 bg-white"
            }`}
            onPress={() => setShowFilters(true)}
          >
            <Text
              className={`text-sm font-medium ${
                activeFilterCount > 0 ? "text-brand-600" : "text-gray-600"
              }`}
            >
              Filters
            </Text>
            {activeFilterCount > 0 && (
              <View className="ml-1.5 w-5 h-5 rounded-full bg-brand-600 items-center justify-center">
                <Text className="text-white text-xs font-bold">
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Results */}
      <ScrollView className="flex-1 px-5 pt-3">
        {mode === "venues" &&
          venues.map((v) => (
            <Pressable
              key={v.id}
              className="mb-3"
              onPress={() => router.push(`/venue/${v.id}`)}
            >
              <Card variant="default">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 mr-3">
                    <Text className="text-base font-semibold text-gray-900">
                      {v.name}
                    </Text>
                    <Text
                      className="text-sm text-gray-500 mt-0.5"
                      numberOfLines={1}
                    >
                      {v.address}
                    </Text>
                  </View>
                  {v.distance_km != null && (
                    <Badge variant="brand">
                      {formatDistance(v.distance_km)}
                    </Badge>
                  )}
                </View>
                <View className="flex-row mt-2 flex-wrap gap-1.5">
                  {v.courtCount != null && (
                    <Badge variant="default">
                      {`${v.courtCount} court${v.courtCount !== 1 ? "s" : ""}`}
                    </Badge>
                  )}
                  {v.amenities.slice(0, 3).map((a) => (
                    <Badge key={a} variant="default">
                      {a}
                    </Badge>
                  ))}
                </View>
              </Card>
            </Pressable>
          ))}

        {mode === "slots" &&
          slots.map((r) => (
            <Pressable
              key={r.slot.id}
              className="mb-3"
              onPress={() => router.push(`/booking/${r.slot.id}`)}
            >
              <Card variant="default">
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 mr-3">
                    <Text className="text-base font-semibold text-gray-900">
                      {formatTime(r.slot.startsAt)} –{" "}
                      {formatTime(r.slot.endsAt)}
                    </Text>
                    <Text className="text-sm text-gray-500 mt-0.5">
                      {r.venue.name} · {r.court.name}
                    </Text>
                  </View>
                  <Text className="text-lg font-bold text-brand-600">
                    {formatPrice(r.slot.priceCents, r.slot.currency)}
                  </Text>
                </View>
                <View className="flex-row mt-2 gap-1.5">
                  <SurfaceBadge surface={r.court.surface as any} />
                  <Badge variant="default">
                    {r.court.indoor ? "Indoor" : "Outdoor"}
                  </Badge>
                </View>
              </Card>
            </Pressable>
          ))}

        {((mode === "venues" &&
          !venuesQuery.isLoading &&
          venues.length === 0) ||
          (mode === "slots" &&
            !slotsQuery.isLoading &&
            slots.length === 0)) && (
          <View className="items-center py-16">
            <CourtIcon size={40} color="#CBD5E1" />
            <Text className="text-gray-400 text-base mt-3">
              {t("search.no_results")}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Filter Bottom Sheet */}
      <BottomSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        title="Filters"
        snapHeight="half"
      >
        <View className="px-5 pt-2 pb-6">
          <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
            Court Surface
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            {ALL_SURFACES.map((s) => (
              <Pressable
                key={s}
                className={`px-4 py-2.5 rounded-full border ${
                  surfaces.includes(s)
                    ? "bg-brand-50 border-brand-500"
                    : "bg-gray-50 border-gray-200"
                }`}
                onPress={() => toggleSurface(s)}
              >
                <Text
                  className={`text-sm font-medium ${
                    surfaces.includes(s) ? "text-brand-700" : "text-gray-600"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
            Environment
          </Text>
          <View className="flex-row gap-2 mb-8">
            <Pressable
              className={`px-4 py-2.5 rounded-full border ${
                indoor === true
                  ? "bg-brand-50 border-brand-500"
                  : "bg-gray-50 border-gray-200"
              }`}
              onPress={() => setIndoor(indoor === true ? undefined : true)}
            >
              <Text
                className={`text-sm font-medium ${
                  indoor === true ? "text-brand-700" : "text-gray-600"
                }`}
              >
                Indoor
              </Text>
            </Pressable>
            <Pressable
              className={`px-4 py-2.5 rounded-full border ${
                indoor === false
                  ? "bg-brand-50 border-brand-500"
                  : "bg-gray-50 border-gray-200"
              }`}
              onPress={() => setIndoor(indoor === false ? undefined : false)}
            >
              <Text
                className={`text-sm font-medium ${
                  indoor === false ? "text-brand-700" : "text-gray-600"
                }`}
              >
                Outdoor
              </Text>
            </Pressable>
          </View>

          <View className="flex-row gap-3">
            {activeFilterCount > 0 && (
              <View className="flex-1">
                <Button variant="ghost" fullWidth onPress={clearFilters}>
                  Clear all
                </Button>
              </View>
            )}
            <View className="flex-1">
              <Button
                variant="primary"
                fullWidth
                onPress={() => setShowFilters(false)}
              >
                Apply
              </Button>
            </View>
          </View>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
