import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, Card, Badge } from "@courtiq/ui";
import { useAuthStore } from "../../src/stores/auth";
import {
  getPlayerProfile,
  getPlayerRating,
  getMatchHistory,
  sendConnectionRequest,
  type MatchItem,
} from "../../src/lib/api";
import Svg, { Path } from "react-native-svg";

function BackIcon({ color = "#1F2937" }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Plays daily",
  weekly: "Plays weekly",
  biweekly: "Plays biweekly",
  monthly: "Plays monthly",
  occasional: "Plays occasionally",
};

export default function PlayerProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id: playerId } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuthStore();

  const isOwnProfile = playerId === userId;

  const profileQuery = useQuery({
    queryKey: ["player-profile", playerId],
    queryFn: () => getPlayerProfile(playerId!),
    enabled: !!playerId,
  });

  const ratingQuery = useQuery({
    queryKey: ["rating", playerId, "doubles"],
    queryFn: () => getPlayerRating(playerId!, "doubles"),
    enabled: !!playerId,
  });

  const singlesRatingQuery = useQuery({
    queryKey: ["rating", playerId, "singles"],
    queryFn: () => getPlayerRating(playerId!, "singles"),
    enabled: !!playerId,
  });

  const matchesQuery = useQuery({
    queryKey: ["matches", playerId],
    queryFn: () => getMatchHistory(playerId!, 10),
    enabled: !!playerId,
  });

  const connectMutation = useMutation({
    mutationFn: () => sendConnectionRequest(playerId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-profile", playerId] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
  });

  const profile = profileQuery.data?.profile;
  const rating = ratingQuery.data;
  const singlesRating = singlesRatingQuery.data;
  const matches = matchesQuery.data?.matches ?? [];

  if (profileQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="px-5 pt-4">
          <Pressable onPress={() => router.back()} className="flex-row items-center">
            <BackIcon />
            <Text className="text-base text-gray-600 ml-1">{t("common.back")}</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-gray-400">Player not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const connectionStatus = profile.connectionStatus;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
          <Pressable onPress={() => router.back()} className="flex-row items-center">
            <BackIcon />
            <Text className="text-base text-gray-600 ml-1">{t("common.back")}</Text>
          </Pressable>
        </View>

        {/* Profile card */}
        <View className="px-5 mt-2">
          <Card variant="elevated">
            <View className="items-center">
              <Avatar size="xl" name={profile.displayName} />
              <Text className="text-2xl font-bold text-gray-900 mt-3">
                {profile.displayName}
              </Text>
              {profile.bio && (
                <Text className="text-sm text-gray-500 mt-1 text-center px-4">
                  {profile.bio}
                </Text>
              )}
              {profile.playFrequency && (
                <Text className="text-xs text-gray-400 mt-1">
                  {FREQUENCY_LABELS[profile.playFrequency] ?? profile.playFrequency}
                </Text>
              )}
            </View>

            {/* Rating row */}
            <View className="flex-row mt-5 gap-3">
              <View className="flex-1 bg-brand-50 rounded-xl px-4 py-3 items-center border border-brand-100">
                <Text className="text-xs text-gray-500 mb-1">Doubles</Text>
                <Text className="text-2xl font-bold text-brand-600">
                  {rating ? Math.round(rating.rating) : "—"}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {rating && rating.gamesPlayed > 0
                    ? `${rating.gamesPlayed} games · ${Math.round(rating.confidence * 100)}%`
                    : t("players.unrated")}
                </Text>
              </View>
              <View className="flex-1 bg-purple-50 rounded-xl px-4 py-3 items-center border border-purple-100">
                <Text className="text-xs text-gray-500 mb-1">Singles</Text>
                <Text className="text-2xl font-bold text-purple-600">
                  {singlesRating ? Math.round(singlesRating.rating) : "—"}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {singlesRating && singlesRating.gamesPlayed > 0
                    ? `${singlesRating.gamesPlayed} games · ${Math.round(singlesRating.confidence * 100)}%`
                    : t("players.unrated")}
                </Text>
              </View>
            </View>

            {/* Connection action */}
            {!isOwnProfile && (
              <View className="mt-4">
                {connectionStatus === "accepted" ? (
                  <View className="bg-emerald-50 py-3 rounded-xl items-center border border-emerald-100">
                    <Text className="text-sm font-semibold text-emerald-600">
                      {t("players.connected")}
                    </Text>
                  </View>
                ) : connectionStatus === "pending" ? (
                  <View className="bg-amber-50 py-3 rounded-xl items-center border border-amber-100">
                    <Text className="text-sm font-semibold text-amber-600">
                      {t("players.request_sent")}
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    className="bg-brand-600 py-3.5 rounded-xl items-center"
                  >
                    {connectMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-base font-semibold text-white">
                        {t("players.send_request")}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            )}
          </Card>
        </View>

        {/* Recent matches */}
        {matches.length > 0 && (
          <View className="px-5 mt-4">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Recent Matches
            </Text>
            {matches.map((m) => (
              <MatchRow
                key={m.match.id}
                match={m}
                playerId={playerId!}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MatchRow({
  match,
  playerId,
}: {
  match: MatchItem;
  playerId: string;
}) {
  const isPlayer1 = match.match.player1Id === playerId;
  const myScore = isPlayer1 ? match.match.player1Score : match.match.player2Score;
  const theirScore = isPlayer1 ? match.match.player2Score : match.match.player1Score;
  const won = match.match.winnerId === playerId;
  const opponent = isPlayer1 ? match.player2 : match.player1;
  const date = new Date(match.match.playedAt);

  return (
    <View className="mb-2">
      <Card variant="default">
        <View className="flex-row items-center">
          <View
            className={`w-1 h-10 rounded-full mr-3 ${won ? "bg-emerald-400" : "bg-red-400"}`}
          />
          <View className="flex-1">
            <Text className="text-sm font-medium text-gray-900">
              vs {opponent.displayName ?? "Player"}
            </Text>
            <Text className="text-xs text-gray-400">
              {date.toLocaleDateString()} · {match.match.format}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-lg font-bold text-gray-900">
              {myScore}–{theirScore}
            </Text>
            {match.ratingChange != null && (
              <Text
                className={`text-xs font-medium ${
                  match.ratingChange >= 0 ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {match.ratingChange >= 0 ? "+" : ""}
                {Math.round(match.ratingChange)}
              </Text>
            )}
          </View>
        </View>
      </Card>
    </View>
  );
}
