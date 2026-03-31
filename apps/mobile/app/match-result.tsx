import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { Card, Button } from "@courtiq/ui";
import { useAuthStore } from "../src/stores/auth";
import { submitMatchResult, type MatchResultResponse } from "../src/lib/api";
import Svg, { Path } from "react-native-svg";

type MatchFormat = "singles" | "doubles";
type Phase = "input" | "result";

function ArrowUp({ color = "#10B981" }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 19V5M5 12l7-7 7 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ArrowDown({ color = "#EF4444" }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M19 12l-7 7-7-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function MatchResultScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("input");
  const [format, setFormat] = useState<MatchFormat>("doubles");
  const [opponentId, setOpponentId] = useState("");
  const [myScore, setMyScore] = useState("");
  const [theirScore, setTheirScore] = useState("");
  const [resultData, setResultData] = useState<MatchResultResponse | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const p1Score = parseInt(myScore, 10);
      const p2Score = parseInt(theirScore, 10);
      if (!opponentId.trim()) throw new Error("Enter opponent ID");
      if (isNaN(p1Score) || isNaN(p2Score)) throw new Error("Enter valid scores");

      return submitMatchResult({
        opponentId: opponentId.trim(),
        format,
        player1Score: p1Score,
        player2Score: p2Score,
        playedAt: new Date().toISOString(),
      });
    },
    onSuccess: (data) => {
      setResultData(data);
      setPhase("result");
      queryClient.invalidateQueries({ queryKey: ["rating"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["ratingHistory"] });
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message);
    },
  });

  const didWin = resultData
    ? resultData.ratingChanges.you.change > 0
    : false;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8">
        {/* Header */}
        <View className="pt-4 pb-2 flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 p-1">
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#1F2937" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text className="text-2xl font-bold text-gray-900">
            Log Match Result
          </Text>
        </View>

        {phase === "input" && (
          <Animated.View entering={FadeInUp.duration(300)}>
            {/* Format selector */}
            <View className="mt-4">
              <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Format
              </Text>
              <View className="flex-row gap-3">
                {(["doubles", "singles"] as MatchFormat[]).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setFormat(f)}
                    className={`flex-1 py-3 rounded-xl items-center border ${
                      format === f
                        ? "bg-brand-600 border-brand-600"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <Text
                      className={`text-base font-semibold capitalize ${
                        format === f ? "text-white" : "text-gray-600"
                      }`}
                    >
                      {f}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Opponent */}
            <View className="mt-6">
              <Card variant="default">
                <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Opponent
                </Text>
                <TextInput
                  value={opponentId}
                  onChangeText={setOpponentId}
                  placeholder="Enter opponent's player ID"
                  placeholderTextColor="#9CA3AF"
                  className="bg-gray-50 rounded-xl px-4 py-3.5 text-base text-gray-900 border border-gray-200"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Card>
            </View>

            {/* Score */}
            <View className="mt-4">
              <Card variant="default">
                <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Score
                </Text>
                <View className="flex-row items-center gap-4">
                  <View className="flex-1">
                    <Text className="text-sm text-gray-500 mb-1 text-center">
                      You
                    </Text>
                    <TextInput
                      value={myScore}
                      onChangeText={setMyScore}
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      className="bg-gray-50 rounded-xl px-4 py-4 text-2xl font-bold text-gray-900 text-center border border-gray-200"
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <Text className="text-2xl font-bold text-gray-300 mt-5">
                    :
                  </Text>
                  <View className="flex-1">
                    <Text className="text-sm text-gray-500 mb-1 text-center">
                      Opponent
                    </Text>
                    <TextInput
                      value={theirScore}
                      onChangeText={setTheirScore}
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      className="bg-gray-50 rounded-xl px-4 py-4 text-2xl font-bold text-gray-900 text-center border border-gray-200"
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>
              </Card>
            </View>

            {/* Submit */}
            <View className="mt-6">
              <Button
                onPress={() => mutation.mutate()}
                disabled={mutation.isPending || !opponentId || !myScore || !theirScore}
                variant="primary"
                size="lg"
              >
                {mutation.isPending ? "Submitting..." : "Submit Result"}
              </Button>
            </View>
          </Animated.View>
        )}

        {phase === "result" && resultData && (
          <Animated.View entering={FadeInDown.duration(400)}>
            {/* Result summary */}
            <View className="mt-6 items-center">
              <View
                className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${
                  didWin ? "bg-green-100" : "bg-red-100"
                }`}
              >
                <Text className="text-3xl">{didWin ? "W" : "L"}</Text>
              </View>
              <Text className="text-2xl font-bold text-gray-900 mb-1">
                {didWin ? "Victory!" : "Defeat"}
              </Text>
              <Text className="text-gray-500 text-base">
                {resultData.match.player1Score} – {resultData.match.player2Score}
              </Text>
            </View>

            {/* Rating change card */}
            <View className="mt-6">
              <Card variant="elevated">
                <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Rating Update
                </Text>
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-sm text-gray-500">Before</Text>
                    <Text className="text-xl font-bold text-gray-900">
                      {Math.round(resultData.ratingChanges.you.before.rating)}
                    </Text>
                  </View>
                  <View className="items-center px-4">
                    <View className="flex-row items-center">
                      {resultData.ratingChanges.you.change >= 0 ? (
                        <ArrowUp />
                      ) : (
                        <ArrowDown />
                      )}
                      <Text
                        className={`text-lg font-bold ml-1 ${
                          resultData.ratingChanges.you.change >= 0
                            ? "text-green-600"
                            : "text-red-500"
                        }`}
                      >
                        {resultData.ratingChanges.you.change > 0 ? "+" : ""}
                        {resultData.ratingChanges.you.change}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm text-gray-500">After</Text>
                    <Text className="text-xl font-bold text-brand-600">
                      {Math.round(resultData.ratingChanges.you.after.rating)}
                    </Text>
                  </View>
                </View>
              </Card>
            </View>

            {/* Actions */}
            <View className="mt-6 gap-3">
              <Button
                onPress={() =>
                  router.push({
                    pathname: "/post-match-feedback",
                    params: {
                      matchId: resultData.match.id,
                      opponentId: opponentId.trim(),
                    },
                  })
                }
                variant="primary"
                size="lg"
              >
                Rate This Session
              </Button>
              <Button
                onPress={() => {
                  setPhase("input");
                  setMyScore("");
                  setTheirScore("");
                  setOpponentId("");
                  setResultData(null);
                }}
                variant="secondary"
                size="lg"
              >
                Log Another Match
              </Button>
              <Button
                onPress={() => router.back()}
                variant="ghost"
                size="lg"
              >
                Done
              </Button>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
