import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeInDown, ZoomIn } from "react-native-reanimated";
import { Card, Button, Avatar } from "@courtiq/ui";
import { useAuthStore } from "../src/stores/auth";
import {
  createMatch,
  getMyConnections,
  type ConnectionItem,
} from "../src/lib/api";
import Svg, { Path } from "react-native-svg";

type MatchFormat = "singles" | "doubles";
type Phase = "details" | "invite" | "confirm";

function CalendarIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke="#6B7280"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function CreateMatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    courtId?: string;
    bookingId?: string;
    venueName?: string;
  }>();
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("details");
  const [format, setFormat] = useState<MatchFormat>("doubles");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(
    new Set(),
  );

  // Fetch connections for invite picker
  const { data: connectionsData, isLoading: connectionsLoading } = useQuery({
    queryKey: ["connections", "accepted"],
    queryFn: () => getMyConnections("accepted", 1, 100),
  });

  const connections = connectionsData?.connections ?? [];

  const togglePlayer = useCallback((playerId: string) => {
    setSelectedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!date || !time) throw new Error("Pick a date and time");
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

      return createMatch({
        format,
        scheduledAt,
        courtId: params.courtId,
        bookingId: params.bookingId,
        notes: notes.trim() || undefined,
        invitees: [...selectedPlayers],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upcomingMatches"] });
      setPhase("confirm");
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message);
    },
  });

  const maxInvites = format === "singles" ? 1 : 3;
  const canProceedToInvite = date && time;

  const renderConnection = useCallback(
    ({ item }: { item: ConnectionItem }) => {
      const selected = selectedPlayers.has(item.profile.userId);
      const disabled = !selected && selectedPlayers.size >= maxInvites;
      return (
        <Pressable
          onPress={() => !disabled && togglePlayer(item.profile.userId)}
          className={`flex-row items-center p-4 mb-2 rounded-xl border ${
            selected
              ? "bg-brand-50 border-brand-300"
              : disabled
                ? "bg-gray-50 border-gray-100 opacity-50"
                : "bg-white border-gray-200"
          }`}
        >
          <Avatar
            uri={item.profile.avatarUrl}
            name={item.profile.displayName}
            size={44}
          />
          <View className="flex-1 ml-3">
            <Text className="text-base font-semibold text-gray-900">
              {item.profile.displayName}
            </Text>
            {item.profile.rating && (
              <Text className="text-sm text-gray-500">
                Rating: {Math.round(item.profile.rating)}
              </Text>
            )}
          </View>
          <View
            className={`w-7 h-7 rounded-full items-center justify-center ${
              selected ? "bg-brand-600" : "border-2 border-gray-300"
            }`}
          >
            {selected && <CheckIcon />}
          </View>
        </Pressable>
      );
    },
    [selectedPlayers, maxInvites, togglePlayer],
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-4 pb-2 flex-row items-center">
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
          {phase === "details"
            ? "Create Match"
            : phase === "invite"
              ? "Invite Players"
              : "Match Created!"}
        </Text>
      </View>

      {/* Progress bar */}
      <View className="px-5 py-2">
        <View className="flex-row gap-2">
          {(["details", "invite", "confirm"] as Phase[]).map((p, i) => (
            <View
              key={p}
              className={`flex-1 h-1 rounded-full ${
                i <=
                ["details", "invite", "confirm"].indexOf(phase)
                  ? "bg-brand-600"
                  : "bg-gray-200"
              }`}
            />
          ))}
        </View>
      </View>

      {phase === "details" && (
        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8">
          <Animated.View entering={FadeInUp.duration(300)}>
            {/* Venue context (if coming from booking) */}
            {params.venueName && (
              <View className="mt-2 mb-4">
                <Card variant="default">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-brand-100 rounded-lg items-center justify-center mr-3">
                      <Text className="text-brand-600 text-lg">🏟️</Text>
                    </View>
                    <View>
                      <Text className="text-sm text-gray-500">Court</Text>
                      <Text className="text-base font-semibold text-gray-900">
                        {params.venueName}
                      </Text>
                    </View>
                  </View>
                </Card>
              </View>
            )}

            {/* Format selector */}
            <View className="mt-2">
              <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Format
              </Text>
              <View className="flex-row gap-3">
                {(["doubles", "singles"] as MatchFormat[]).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => {
                      setFormat(f);
                      // Reset invites if switching to singles
                      if (f === "singles" && selectedPlayers.size > 1) {
                        setSelectedPlayers(new Set());
                      }
                    }}
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

            {/* Date & Time */}
            <View className="mt-6">
              <Card variant="default">
                <View className="flex-row items-center mb-3">
                  <CalendarIcon />
                  <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider ml-2">
                    When
                  </Text>
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-sm text-gray-500 mb-1">Date</Text>
                    <TextInput
                      value={date}
                      onChangeText={setDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9CA3AF"
                      className="bg-gray-50 rounded-xl px-4 py-3.5 text-base text-gray-900 border border-gray-200"
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm text-gray-500 mb-1">Time</Text>
                    <TextInput
                      value={time}
                      onChangeText={setTime}
                      placeholder="HH:MM"
                      placeholderTextColor="#9CA3AF"
                      className="bg-gray-50 rounded-xl px-4 py-3.5 text-base text-gray-900 border border-gray-200"
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
              </Card>
            </View>

            {/* Notes */}
            <View className="mt-4">
              <Card variant="default">
                <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Notes (optional)
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Competitive match, bring water"
                  placeholderTextColor="#9CA3AF"
                  className="bg-gray-50 rounded-xl px-4 py-3.5 text-base text-gray-900 border border-gray-200"
                  multiline
                  numberOfLines={2}
                />
              </Card>
            </View>

            {/* Next */}
            <View className="mt-6">
              <Button
                onPress={() => setPhase("invite")}
                disabled={!canProceedToInvite}
                variant="primary"
                size="lg"
              >
                Next: Invite Players
              </Button>
            </View>
          </Animated.View>
        </ScrollView>
      )}

      {phase === "invite" && (
        <View className="flex-1 px-5">
          <Animated.View entering={FadeInUp.duration(300)} className="flex-1">
            <Text className="text-sm text-gray-500 mt-2 mb-4">
              Select up to {maxInvites} player{maxInvites > 1 ? "s" : ""} from
              your connections ({selectedPlayers.size}/{maxInvites} selected)
            </Text>

            {connectionsLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#2563EB" />
              </View>
            ) : connections.length === 0 ? (
              <View className="flex-1 items-center justify-center">
                <Text className="text-gray-500 text-base text-center">
                  No connections yet.{"\n"}Add friends to invite them to matches!
                </Text>
              </View>
            ) : (
              <FlatList
                data={connections}
                keyExtractor={(item) => item.connectionId}
                renderItem={renderConnection}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
              />
            )}

            {/* Bottom action buttons */}
            <View className="pb-8 pt-3 gap-3">
              <Button
                onPress={() => mutation.mutate()}
                disabled={mutation.isPending}
                variant="primary"
                size="lg"
              >
                {mutation.isPending
                  ? "Creating..."
                  : selectedPlayers.size > 0
                    ? `Create Match & Send ${selectedPlayers.size} Invite${selectedPlayers.size > 1 ? "s" : ""}`
                    : "Create Match Without Invites"}
              </Button>
              <Button
                onPress={() => setPhase("details")}
                variant="ghost"
                size="md"
              >
                Back
              </Button>
            </View>
          </Animated.View>
        </View>
      )}

      {phase === "confirm" && (
        <View className="flex-1 px-5 items-center justify-center">
          <Animated.View entering={ZoomIn.duration(400)} className="items-center">
            <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-6">
              <Text className="text-4xl">✅</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">
              Match Scheduled!
            </Text>
            <Text className="text-base text-gray-500 text-center mb-2">
              {format === "doubles" ? "Doubles" : "Singles"} match on {date} at{" "}
              {time}
            </Text>
            {selectedPlayers.size > 0 && (
              <Text className="text-sm text-brand-600 mb-6">
                {selectedPlayers.size} invite{selectedPlayers.size > 1 ? "s" : ""}{" "}
                sent
              </Text>
            )}
          </Animated.View>
          <View className="w-full gap-3 mt-4">
            <Button
              onPress={() => router.push("/upcoming-matches")}
              variant="primary"
              size="lg"
            >
              View Upcoming Matches
            </Button>
            <Button onPress={() => router.back()} variant="ghost" size="lg">
              Done
            </Button>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
