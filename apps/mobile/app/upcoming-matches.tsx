import { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Card, Avatar } from "@courtiq/ui";
import { useAuthStore } from "../src/stores/auth";
import {
  getUpcomingMatches,
  type ScheduledMatchItem,
} from "../src/lib/api";
import Svg, { Path } from "react-native-svg";

function getCountdown(scheduledAt: string): string {
  const diff = new Date(scheduledAt).getTime() - Date.now();
  if (diff <= 0) return "Starting now";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MatchCard({
  match,
  userId,
  onPress,
}: {
  match: ScheduledMatchItem;
  userId: string;
  onPress: () => void;
}) {
  const isHost = match.createdByUserId === userId;
  const acceptedPlayers = match.players.filter(
    (p) => p.rsvpStatus === "accepted",
  );
  const pendingPlayers = match.players.filter(
    (p) => p.rsvpStatus === "pending",
  );
  const countdown = getCountdown(match.scheduledAt);

  return (
    <Pressable onPress={onPress}>
      <Card variant="elevated">
        <View className="flex-row items-start justify-between mb-3">
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-bold text-gray-900 capitalize">
                {match.format}
              </Text>
              {isHost && (
                <View className="bg-brand-100 px-2 py-0.5 rounded-full">
                  <Text className="text-xs font-semibold text-brand-700">
                    Host
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-sm text-gray-500 mt-0.5">
              {formatDate(match.scheduledAt)} · {formatTime(match.scheduledAt)}
            </Text>
          </View>
          <View className="bg-amber-100 px-3 py-1.5 rounded-lg">
            <Text className="text-sm font-bold text-amber-700">
              {countdown}
            </Text>
          </View>
        </View>

        {/* Venue info */}
        {match.venue && (
          <View className="flex-row items-center mb-3">
            <Text className="text-sm text-gray-500">📍 {match.venue.name}</Text>
          </View>
        )}

        {/* Players */}
        <View className="flex-row items-center">
          <View className="flex-row -space-x-2">
            {acceptedPlayers.slice(0, 4).map((p) => (
              <View key={p.userId} className="border-2 border-white rounded-full">
                <Avatar
                  uri={p.avatarUrl}
                  name={p.displayName ?? "?"}
                  size={32}
                />
              </View>
            ))}
          </View>
          <Text className="text-sm text-gray-500 ml-3">
            {acceptedPlayers.length} confirmed
            {pendingPlayers.length > 0 &&
              ` · ${pendingPlayers.length} pending`}
          </Text>
        </View>

        {/* Notes */}
        {match.notes && (
          <Text className="text-sm text-gray-400 mt-2 italic" numberOfLines={1}>
            {match.notes}
          </Text>
        )}
      </Card>
    </Pressable>
  );
}

export default function UpcomingMatchesScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["upcomingMatches"],
    queryFn: () => getUpcomingMatches(50),
    refetchInterval: 60_000, // Refresh every minute for countdown updates
  });

  const matches = data?.matches ?? [];

  const renderMatch = useCallback(
    ({ item, index }: { item: ScheduledMatchItem; index: number }) => (
      <Animated.View
        entering={FadeInUp.delay(index * 80).duration(300)}
        className="mb-3"
      >
        <MatchCard
          match={item}
          userId={userId!}
          onPress={() =>
            router.push({
              pathname: "/match-detail",
              params: { matchId: item.id },
            })
          }
        />
      </Animated.View>
    ),
    [userId, router],
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 p-1">
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 12H5M12 19l-7-7 7-7"
                stroke="#1F2937"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <Text className="text-2xl font-bold text-gray-900">
            Upcoming Matches
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/create-match")}
          className="bg-brand-600 px-4 py-2 rounded-xl"
        >
          <Text className="text-white font-semibold text-sm">+ New</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : matches.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">🏸</Text>
          <Text className="text-xl font-bold text-gray-900 mb-2 text-center">
            No Upcoming Matches
          </Text>
          <Text className="text-base text-gray-500 text-center mb-6">
            Create a match and invite your friends to play!
          </Text>
          <Button
            onPress={() => router.push("/create-match")}
            variant="primary"
            size="lg"
          >
            Create Your First Match
          </Button>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatch}
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#2563EB"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// Re-export Button since it's used in the empty state
function Button({
  onPress,
  variant,
  size,
  children,
}: {
  onPress: () => void;
  variant: string;
  size: string;
  children: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-brand-600 px-6 py-3.5 rounded-xl items-center w-full"
    >
      <Text className="text-white font-semibold text-base">{children}</Text>
    </Pressable>
  );
}
