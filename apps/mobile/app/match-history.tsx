import { View, Text, Pressable, ScrollView, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Card } from "@courtiq/ui";
import { useAuthStore } from "../src/stores/auth";
import {
  getPlayerRating,
  getRatingHistory,
  getMatchHistory,
  type RatingHistoryItem,
  type MatchItem,
} from "../src/lib/api";
import Svg, { Path, Polyline, Line, Text as SvgText } from "react-native-svg";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - 72;
const CHART_HEIGHT = 140;
const CHART_PADDING = { top: 10, right: 10, bottom: 20, left: 40 };

function RatingChart({ history }: { history: RatingHistoryItem[] }) {
  if (history.length < 2) {
    return (
      <View className="h-36 items-center justify-center">
        <Text className="text-sm text-gray-400">
          Play more matches to see your rating trend
        </Text>
      </View>
    );
  }

  // Reverse so oldest first
  const data = [...history].reverse();
  const ratings = data.map((h) => h.ratingAfter);
  const minR = Math.floor(Math.min(...ratings) / 50) * 50 - 50;
  const maxR = Math.ceil(Math.max(...ratings) / 50) * 50 + 50;
  const range = maxR - minR || 100;

  const plotW = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotH = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const points = data.map((h, i) => {
    const x = CHART_PADDING.left + (i / (data.length - 1)) * plotW;
    const y = CHART_PADDING.top + plotH - ((h.ratingAfter - minR) / range) * plotH;
    return `${x},${y}`;
  });

  const polylineStr = points.join(" ");

  // Y-axis labels
  const yLabels = [minR, Math.round((minR + maxR) / 2), maxR];

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      {/* Y axis labels + grid lines */}
      {yLabels.map((val) => {
        const y = CHART_PADDING.top + plotH - ((val - minR) / range) * plotH;
        return (
          <View key={val}>
            <SvgText
              x={CHART_PADDING.left - 6}
              y={y + 4}
              fontSize={10}
              fill="#9CA3AF"
              textAnchor="end"
            >
              {val}
            </SvgText>
            <Line
              x1={CHART_PADDING.left}
              y1={y}
              x2={CHART_WIDTH - CHART_PADDING.right}
              y2={y}
              stroke="#F3F4F6"
              strokeWidth={1}
            />
          </View>
        );
      })}

      {/* Rating line */}
      <Polyline
        points={polylineStr}
        fill="none"
        stroke="#2563EB"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function MatchRow({ item, currentUserId }: { item: MatchItem; currentUserId: string }) {
  const isPlayer1 = item.match.player1Id === currentUserId;
  const opponentName = isPlayer1
    ? item.player2.displayName ?? "Unknown"
    : item.player1.displayName ?? "Unknown";
  const myScore = isPlayer1 ? item.match.player1Score : item.match.player2Score;
  const theirScore = isPlayer1 ? item.match.player2Score : item.match.player1Score;
  const didWin = item.match.winnerId === currentUserId;
  const isDraw = item.match.winnerId == null;

  const date = new Date(item.match.playedAt);
  const dateStr = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  return (
    <View className="flex-row items-center py-3 border-b border-gray-50">
      {/* Result indicator */}
      <View
        className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
          isDraw
            ? "bg-gray-100"
            : didWin
              ? "bg-green-100"
              : "bg-red-100"
        }`}
      >
        <Text
          className={`text-xs font-bold ${
            isDraw
              ? "text-gray-500"
              : didWin
                ? "text-green-700"
                : "text-red-600"
          }`}
        >
          {isDraw ? "D" : didWin ? "W" : "L"}
        </Text>
      </View>

      {/* Opponent + date */}
      <View className="flex-1">
        <Text className="text-base font-medium text-gray-900">
          vs {opponentName}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {dateStr} · {item.match.format}
        </Text>
      </View>

      {/* Score */}
      <Text className="text-base font-semibold text-gray-700 mr-3">
        {myScore}–{theirScore}
      </Text>

      {/* Rating change */}
      {item.ratingChange != null && (
        <Text
          className={`text-sm font-semibold min-w-[44px] text-right ${
            item.ratingChange > 0
              ? "text-green-600"
              : item.ratingChange < 0
                ? "text-red-500"
                : "text-gray-400"
          }`}
        >
          {item.ratingChange > 0 ? "+" : ""}
          {item.ratingChange}
        </Text>
      )}
    </View>
  );
}

export default function MatchHistoryScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);

  const ratingQuery = useQuery({
    queryKey: ["rating", userId, "doubles"],
    queryFn: () => getPlayerRating(userId!, "doubles"),
    enabled: !!userId,
  });

  const historyQuery = useQuery({
    queryKey: ["ratingHistory", userId, "doubles"],
    queryFn: () => getRatingHistory(userId!, "doubles"),
    enabled: !!userId,
  });

  const matchesQuery = useQuery({
    queryKey: ["matches", userId],
    queryFn: () => getMatchHistory(userId!),
    enabled: !!userId,
  });

  const rating = ratingQuery.data;
  const history = historyQuery.data?.history ?? [];
  const matches = matchesQuery.data?.matches ?? [];

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
          <Text className="text-2xl font-bold text-gray-900">
            Rating & Matches
          </Text>
        </View>

        {/* Rating overview */}
        {rating && (
          <Animated.View entering={FadeInUp.duration(300)}>
            <Card variant="elevated">
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-sm text-gray-400 uppercase tracking-wider font-semibold">
                    Doubles Rating
                  </Text>
                  <Text className="text-4xl font-bold text-brand-600 mt-1">
                    {Math.round(rating.rating)}
                  </Text>
                </View>
                <View className="items-end">
                  <View className="flex-row items-center">
                    <View
                      className={`w-2 h-2 rounded-full mr-1.5 ${
                        rating.confidence > 0.7
                          ? "bg-green-500"
                          : rating.confidence > 0.3
                            ? "bg-yellow-500"
                            : "bg-gray-300"
                      }`}
                    />
                    <Text className="text-sm text-gray-500">
                      {Math.round(rating.confidence * 100)}% confidence
                    </Text>
                  </View>
                  <Text className="text-sm text-gray-400 mt-1">
                    {rating.gamesPlayed} game{rating.gamesPlayed !== 1 ? "s" : ""} played
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Rating chart */}
        <View className="mt-4">
          <Animated.View entering={FadeInUp.duration(300).delay(100)}>
            <Card variant="default">
              <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Rating History
              </Text>
              <RatingChart history={history} />
            </Card>
          </Animated.View>
        </View>

        {/* Match list */}
        <View className="mt-4">
          <Animated.View entering={FadeInUp.duration(300).delay(200)}>
            <Card variant="default" padded={false}>
              <View className="px-5 pt-4 pb-2 flex-row justify-between items-center">
                <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Recent Matches
                </Text>
                <Pressable onPress={() => router.push("/match-result")}>
                  <Text className="text-sm font-medium text-brand-600">
                    + Log Match
                  </Text>
                </Pressable>
              </View>
              <View className="px-5 pb-2">
                {matches.length === 0 ? (
                  <View className="py-8 items-center">
                    <Text className="text-sm text-gray-400">
                      No matches recorded yet
                    </Text>
                    <Pressable
                      onPress={() => router.push("/match-result")}
                      className="mt-2"
                    >
                      <Text className="text-sm font-medium text-brand-600">
                        Log your first match
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  matches.map((m) => (
                    <MatchRow
                      key={m.match.id}
                      item={m}
                      currentUserId={userId!}
                    />
                  ))
                )}
              </View>
            </Card>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
