import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { Card, Avatar, Button } from "@courtiq/ui";
import { useAuthStore } from "../src/stores/auth";
import {
  getMatchDetail,
  rsvpMatch,
  updateMatch,
  invitePlayers,
} from "../src/lib/api";
import Svg, { Path } from "react-native-svg";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }) + " at " + d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCountdown(scheduledAt: string): string {
  const diff = new Date(scheduledAt).getTime() - Date.now();
  if (diff <= 0) return "Starting now";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `In ${days} day${days > 1 ? "s" : ""}`;
  }
  if (hours > 0) return `In ${hours}h ${minutes}m`;
  return `In ${minutes}m`;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  upcoming: { bg: "bg-blue-100", text: "text-blue-700" },
  active: { bg: "bg-green-100", text: "text-green-700" },
  completed: { bg: "bg-gray-100", text: "text-gray-700" },
  cancelled: { bg: "bg-red-100", text: "text-red-700" },
};

const rsvpColors: Record<string, { bg: string; text: string }> = {
  accepted: { bg: "bg-green-100", text: "text-green-700" },
  pending: { bg: "bg-amber-100", text: "text-amber-700" },
  declined: { bg: "bg-red-100", text: "text-red-700" },
};

export default function MatchDetailScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["matchDetail", matchId],
    queryFn: () => getMatchDetail(matchId!),
    enabled: !!matchId,
  });

  const match = data?.match;

  const rsvpMutation = useMutation({
    mutationFn: (status: "accepted" | "declined") =>
      rsvpMatch(matchId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matchDetail", matchId] });
      queryClient.invalidateQueries({ queryKey: ["upcomingMatches"] });
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => updateMatch(matchId!, { status: "cancelled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matchDetail", matchId] });
      queryClient.invalidateQueries({ queryKey: ["upcomingMatches"] });
      Alert.alert("Cancelled", "The match has been cancelled.");
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  if (isLoading || !match) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  const isHost = match.createdByUserId === userId;
  const myPlayer = match.players?.find((p) => p.userId === userId);
  const isUpcoming = match.status === "upcoming";
  const needsRsvp = myPlayer?.rsvpStatus === "pending" && !isHost;
  const sc = statusColors[match.status] ?? statusColors.upcoming;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8">
        {/* Header */}
        <View className="pt-4 pb-2 flex-row items-center">
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
          <Text className="text-2xl font-bold text-gray-900 flex-1">
            Match Details
          </Text>
          <View className={`px-3 py-1 rounded-full ${sc.bg}`}>
            <Text className={`text-sm font-semibold capitalize ${sc.text}`}>
              {match.status}
            </Text>
          </View>
        </View>

        {/* Hero card */}
        <Animated.View entering={FadeInUp.duration(300)} className="mt-4">
          <Card variant="elevated">
            <View className="items-center py-2">
              <Text className="text-lg font-bold text-gray-900 capitalize mb-1">
                {match.format} Match
              </Text>
              <Text className="text-base text-gray-600">
                {formatDateTime(match.scheduledAt)}
              </Text>
              {isUpcoming && (
                <View className="bg-amber-50 px-4 py-2 rounded-xl mt-3">
                  <Text className="text-amber-700 font-semibold">
                    {getCountdown(match.scheduledAt)}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        </Animated.View>

        {/* Venue */}
        {match.venue && (
          <Animated.View entering={FadeInUp.delay(100).duration(300)} className="mt-4">
            <Card variant="default">
              <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Location
              </Text>
              <Text className="text-base font-semibold text-gray-900">
                {match.venue.name}
              </Text>
              {match.venue.address && (
                <Text className="text-sm text-gray-500 mt-0.5">
                  {match.venue.address}
                </Text>
              )}
              {match.court && (
                <Text className="text-sm text-gray-500 mt-0.5">
                  {match.court.name} · {match.court.surface}
                  {match.court.indoor ? " · Indoor" : ""}
                </Text>
              )}
            </Card>
          </Animated.View>
        )}

        {/* Players */}
        <Animated.View entering={FadeInUp.delay(200).duration(300)} className="mt-4">
          <Card variant="default">
            <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Players
            </Text>
            {(match.players ?? []).map((player) => {
              const rc = rsvpColors[player.rsvpStatus] ?? rsvpColors.pending;
              return (
                <View
                  key={player.userId}
                  className="flex-row items-center py-2.5 border-b border-gray-100 last:border-b-0"
                >
                  <Avatar
                    uri={player.avatarUrl}
                    name={player.displayName ?? "?"}
                    size={40}
                  />
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base font-semibold text-gray-900">
                        {player.displayName ?? "Unknown"}
                      </Text>
                      {player.role === "host" && (
                        <View className="bg-brand-100 px-2 py-0.5 rounded-full">
                          <Text className="text-xs font-semibold text-brand-700">
                            Host
                          </Text>
                        </View>
                      )}
                      {player.userId === userId && (
                        <Text className="text-xs text-gray-400">You</Text>
                      )}
                    </View>
                  </View>
                  <View className={`px-2.5 py-1 rounded-full ${rc.bg}`}>
                    <Text
                      className={`text-xs font-semibold capitalize ${rc.text}`}
                    >
                      {player.rsvpStatus}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </Animated.View>

        {/* Notes */}
        {match.notes && (
          <Animated.View entering={FadeInUp.delay(300).duration(300)} className="mt-4">
            <Card variant="default">
              <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Notes
              </Text>
              <Text className="text-base text-gray-700">{match.notes}</Text>
            </Card>
          </Animated.View>
        )}

        {/* Scores (if completed) */}
        {match.status === "completed" &&
          match.player1Score != null &&
          match.player2Score != null && (
            <Animated.View
              entering={FadeInUp.delay(300).duration(300)}
              className="mt-4"
            >
              <Card variant="elevated">
                <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 text-center">
                  Final Score
                </Text>
                <View className="flex-row items-center justify-center gap-6">
                  <View className="items-center">
                    <Text className="text-sm text-gray-500">
                      {match.player1Name ?? "Player 1"}
                    </Text>
                    <Text className="text-4xl font-bold text-gray-900">
                      {match.player1Score}
                    </Text>
                  </View>
                  <Text className="text-2xl text-gray-300 mt-4">–</Text>
                  <View className="items-center">
                    <Text className="text-sm text-gray-500">
                      {match.player2Name ?? "Player 2"}
                    </Text>
                    <Text className="text-4xl font-bold text-gray-900">
                      {match.player2Score}
                    </Text>
                  </View>
                </View>
              </Card>
            </Animated.View>
          )}

        {/* RSVP Actions */}
        {needsRsvp && (
          <Animated.View entering={FadeInDown.duration(400)} className="mt-6 gap-3">
            <Text className="text-sm text-gray-500 text-center mb-1">
              You've been invited to this match
            </Text>
            <Button
              onPress={() => rsvpMutation.mutate("accepted")}
              disabled={rsvpMutation.isPending}
              variant="primary"
              size="lg"
            >
              Accept Invitation
            </Button>
            <Button
              onPress={() => rsvpMutation.mutate("declined")}
              disabled={rsvpMutation.isPending}
              variant="secondary"
              size="lg"
            >
              Decline
            </Button>
          </Animated.View>
        )}

        {/* Host actions */}
        {isHost && isUpcoming && (
          <Animated.View entering={FadeInDown.duration(400)} className="mt-6 gap-3">
            <Button
              onPress={() =>
                router.push({
                  pathname: "/create-match",
                  params: { matchId: match.id },
                })
              }
              variant="primary"
              size="lg"
            >
              Invite More Players
            </Button>
            <Button
              onPress={() =>
                Alert.alert(
                  "Cancel Match",
                  "Are you sure you want to cancel this match?",
                  [
                    { text: "No", style: "cancel" },
                    {
                      text: "Yes, Cancel",
                      style: "destructive",
                      onPress: () => cancelMutation.mutate(),
                    },
                  ],
                )
              }
              disabled={cancelMutation.isPending}
              variant="ghost"
              size="lg"
            >
              Cancel Match
            </Button>
          </Animated.View>
        )}

        {/* Complete match - record result */}
        {isHost && match.status === "upcoming" && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mt-3">
            <Button
              onPress={() =>
                router.push({
                  pathname: "/match-result",
                  params: { matchId: match.id },
                })
              }
              variant="secondary"
              size="lg"
            >
              Record Result
            </Button>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
