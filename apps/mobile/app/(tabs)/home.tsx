import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Card, Button, Badge, SurfaceBadge, RacketIcon } from "@courtiq/ui";
import {
  fetchVenues,
  searchSlots,
  getUpcomingMatches,
  type VenueListResponse,
  type SlotSearchResponse,
  type ScheduledMatchItem,
} from "../../src/lib/api";
import { useLocationStore } from "../../src/stores/location";
import { useAuthStore } from "../../src/stores/auth";
import { ErrorView } from "../../src/components/ErrorView";
import { formatPrice, formatTime, formatDistance } from "../../src/lib/format";

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { latitude, longitude } = useLocationStore();
  const displayName = useAuthStore((s) => s.displayName);

  const venuesQuery = useQuery({
    queryKey: ["venues", "nearby", latitude, longitude],
    queryFn: () =>
      fetchVenues({
        lat: latitude ?? undefined,
        lng: longitude ?? undefined,
        radiusKm: 15,
        limit: 6,
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

  const upcomingQuery = useQuery({
    queryKey: ["upcomingMatches", "home"],
    queryFn: () => getUpcomingMatches(3),
  });

  const venues = venuesQuery.data?.venues ?? [];
  const slots = slotsQuery.data?.results ?? [];
  const upcomingMatches = upcomingQuery.data?.matches ?? [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-6"
        refreshControl={
          <RefreshControl
            refreshing={
              (venuesQuery.isRefetching || slotsQuery.isRefetching || upcomingQuery.isRefetching) ?? false
            }
            onRefresh={() => {
              venuesQuery.refetch();
              slotsQuery.refetch();
              upcomingQuery.refetch();
            }}
          />
        }
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-sm text-gray-400 font-medium">
            {greeting()}
          </Text>
          <Text className="text-2xl font-bold text-gray-900 mt-0.5">
            {displayName ?? t("home.title")}
          </Text>
        </View>

        {/* Concierge CTA */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <Pressable
            className="mx-5 mt-3 mb-5"
            onPress={() => router.push("/(tabs)/concierge")}
          >
            <Card variant="elevated">
              <View className="flex-row items-center">
                <View className="w-12 h-12 rounded-full bg-brand-100 items-center justify-center mr-4">
                  <RacketIcon size={24} color="#2563EB" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">
                    Find me a court
                  </Text>
                  <Text className="text-sm text-gray-500 mt-0.5">
                    Ask your AI concierge for personalized picks
                  </Text>
                </View>
                <Text className="text-brand-500 text-lg">→</Text>
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        {/* Upcoming Matches */}
        {upcomingMatches.length > 0 && (
          <View className="mb-5">
            <View className="px-5 flex-row justify-between items-center mb-3">
              <Text className="text-lg font-semibold text-gray-900">
                Upcoming Matches
              </Text>
              <Pressable onPress={() => router.push("/upcoming-matches")}>
                <Text className="text-sm font-medium text-brand-600">
                  View all
                </Text>
              </Pressable>
            </View>
            {upcomingMatches.map((m) => {
              const scheduledDate = new Date(m.scheduledAt);
              const diff = scheduledDate.getTime() - Date.now();
              const hours = Math.floor(diff / (1000 * 60 * 60));
              const countdown =
                hours > 24
                  ? `${Math.floor(hours / 24)}d`
                  : hours > 0
                    ? `${hours}h`
                    : `${Math.floor(diff / (1000 * 60))}m`;
              const accepted = m.players.filter(
                (p) => p.rsvpStatus === "accepted",
              ).length;
              return (
                <Pressable
                  key={m.id}
                  className="mx-5 mb-2"
                  onPress={() =>
                    router.push({
                      pathname: "/match-detail",
                      params: { matchId: m.id },
                    })
                  }
                >
                  <Card variant="default">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <View className="w-10 h-10 bg-brand-100 rounded-lg items-center justify-center mr-3">
                          <Text className="text-brand-600 font-bold text-sm capitalize">
                            {m.format.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-base font-semibold text-gray-900 capitalize">
                            {m.format}
                          </Text>
                          <Text className="text-sm text-gray-500">
                            {scheduledDate.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            · {accepted} player{accepted !== 1 ? "s" : ""}
                          </Text>
                        </View>
                      </View>
                      <View className="bg-amber-100 px-2.5 py-1 rounded-lg">
                        <Text className="text-sm font-bold text-amber-700">
                          {countdown}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Create match quick action */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <Pressable
            className="mx-5 mb-5"
            onPress={() => router.push("/create-match")}
          >
            <Card variant="default">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3">
                  <Text className="text-green-600 text-lg">+</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">
                    Create a Match
                  </Text>
                  <Text className="text-sm text-gray-500">
                    Schedule & invite friends
                  </Text>
                </View>
                <Text className="text-gray-400 text-lg">→</Text>
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        {/* Suggested slots */}
        {slots.length > 0 && (
          <View className="mb-5">
            <View className="px-5 flex-row justify-between items-center mb-3">
              <Text className="text-lg font-semibold text-gray-900">
                For You
              </Text>
              <Badge variant="brand">AI picks</Badge>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {slots.map((r) => (
                <Pressable
                  key={r.slot.id}
                  className="w-64"
                  onPress={() => router.push(`/booking/${r.slot.id}`)}
                >
                  <Card variant="elevated">
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 mr-2">
                        <Text className="text-base font-semibold text-gray-900">
                          {formatTime(r.slot.startsAt)} –{" "}
                          {formatTime(r.slot.endsAt)}
                        </Text>
                        <Text
                          className="text-sm text-gray-500 mt-0.5"
                          numberOfLines={1}
                        >
                          {r.venue.name}
                        </Text>
                      </View>
                      <Text className="text-lg font-bold text-brand-600">
                        {formatPrice(r.slot.priceCents, r.slot.currency)}
                      </Text>
                    </View>
                    <View className="flex-row gap-1.5 mt-1">
                      <SurfaceBadge
                        surface={r.court.surface as any}
                        label={r.court.name}
                      />
                      <Badge variant="default">
                        {r.court.indoor ? "Indoor" : "Outdoor"}
                      </Badge>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Nearby venues */}
        <View className="px-5">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-gray-900">
              {t("home.nearby")}
            </Text>
            <Pressable onPress={() => router.push("/(tabs)/search")}>
              <Text className="text-sm font-medium text-brand-600">
                {t("home.view_all")}
              </Text>
            </Pressable>
          </View>

          {venuesQuery.isError && (
            <ErrorView
              message={venuesQuery.error?.message}
              onRetry={() => venuesQuery.refetch()}
            />
          )}

          {venues.map((v) => (
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
                    <Badge variant="brand">{formatDistance(v.distance_km)}</Badge>
                  )}
                </View>
                <View className="flex-row mt-2.5 flex-wrap gap-1.5">
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

          {!venuesQuery.isLoading &&
            venues.length === 0 &&
            !venuesQuery.isError && (
              <View className="items-center py-16">
                <Text className="text-gray-400 text-base">
                  {t("search.no_results")}
                </Text>
              </View>
            )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
