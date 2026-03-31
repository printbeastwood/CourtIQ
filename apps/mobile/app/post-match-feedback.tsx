import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  ZoomIn,
} from "react-native-reanimated";
import { Button, Card } from "@courtiq/ui";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../src/stores/auth";
import {
  submitMatchFeedback,
  submitSessionFeedback,
  type Satisfaction,
  type IssueCategory,
  type OpponentSkillRating,
} from "../src/lib/api";
import Svg, { Path } from "react-native-svg";

type Phase = "satisfaction" | "followup" | "opponent" | "done";

const SATISFACTION_OPTIONS: {
  key: Satisfaction;
  emoji: string;
  label: string;
  color: string;
  bgColor: string;
  selectedBg: string;
}[] = [
  {
    key: "great",
    emoji: "\u{1F60A}",
    label: "Great",
    color: "#10B981",
    bgColor: "bg-white",
    selectedBg: "bg-green-50",
  },
  {
    key: "okay",
    emoji: "\u{1F610}",
    label: "Okay",
    color: "#F59E0B",
    bgColor: "bg-white",
    selectedBg: "bg-amber-50",
  },
  {
    key: "poor",
    emoji: "\u{1F61E}",
    label: "Poor",
    color: "#EF4444",
    bgColor: "bg-white",
    selectedBg: "bg-red-50",
  },
];

const ISSUE_OPTIONS: { key: IssueCategory; label: string; icon: string }[] = [
  { key: "court_quality", label: "Court Quality", icon: "\u{1F3BE}" },
  { key: "opponent_level", label: "Opponent Level", icon: "\u{1F4CA}" },
  { key: "time", label: "Time / Schedule", icon: "\u{1F552}" },
  { key: "location", label: "Location", icon: "\u{1F4CD}" },
];

const OPPONENT_SKILL_OPTIONS: {
  key: OpponentSkillRating;
  label: string;
  description: string;
}[] = [
  { key: "too_easy", label: "Too Easy", description: "Opponents were below my level" },
  { key: "about_right", label: "About Right", description: "Well matched game" },
  { key: "too_hard", label: "Too Hard", description: "Opponents were above my level" },
];

function CheckIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        stroke="#10B981"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CloseIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 18L18 6M6 6l12 12"
        stroke="#6B7280"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function PostMatchFeedbackScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    matchId?: string;
    bookingId?: string;
    opponentId?: string;
    venueName?: string;
  }>();

  const [phase, setPhase] = useState<Phase>("satisfaction");
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [freeText, setFreeText] = useState("");
  const [issueCategories, setIssueCategories] = useState<IssueCategory[]>([]);
  const [opponentSkill, setOpponentSkill] = useState<OpponentSkillRating | null>(null);

  const toggleIssue = (cat: IssueCategory) => {
    setIssueCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!satisfaction) throw new Error("Select satisfaction level");

      const feedbackData = {
        satisfaction,
        freeText: freeText.trim() || undefined,
        issueCategories: issueCategories.length > 0 ? issueCategories : undefined,
        opponentSkillRating: opponentSkill ?? undefined,
        opponentId: params.opponentId ?? undefined,
        bookingId: params.bookingId ?? undefined,
      };

      if (params.matchId) {
        return submitMatchFeedback(params.matchId, feedbackData);
      }
      return submitSessionFeedback(feedbackData);
    },
    onSuccess: () => {
      setPhase("done");
      queryClient.invalidateQueries({ queryKey: ["feedbackStats"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (err: Error) => {
      if (err.message.includes("409")) {
        Alert.alert(
          t("feedback.already_submitted_title"),
          t("feedback.already_submitted"),
        );
        router.back();
      } else {
        Alert.alert(t("common.error"), err.message);
      }
    },
  });

  const handleSatisfactionSelect = (s: Satisfaction) => {
    setSatisfaction(s);
    // Auto-advance after a brief moment for visual feedback
    setTimeout(() => {
      if (s === "great" || s === "poor") {
        setPhase("followup");
      } else {
        // "okay" goes to opponent rating directly (or submit if no opponent)
        setPhase(params.opponentId ? "opponent" : "followup");
      }
    }, 300);
  };

  const handleFollowupNext = () => {
    if (params.opponentId) {
      setPhase("opponent");
    } else {
      mutation.mutate();
    }
  };

  const handleSubmit = () => {
    mutation.mutate();
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-gray-900">
          {t("feedback.title")}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="p-2 -mr-2"
          hitSlop={12}
        >
          <CloseIcon />
        </Pressable>
      </View>

      {/* Venue context */}
      {params.venueName && (
        <View className="px-5 pb-3">
          <Text className="text-sm text-gray-500">{params.venueName}</Text>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        {/* Phase 1: Satisfaction */}
        {phase === "satisfaction" && (
          <Animated.View entering={FadeInUp.duration(400)}>
            <View className="items-center mt-8 mb-8">
              <Text className="text-2xl font-bold text-gray-900 text-center">
                {t("feedback.how_was_session")}
              </Text>
              <Text className="text-base text-gray-500 mt-2 text-center">
                {t("feedback.tap_to_rate")}
              </Text>
            </View>

            <View className="flex-row justify-center gap-5">
              {SATISFACTION_OPTIONS.map((opt, idx) => (
                <Animated.View
                  key={opt.key}
                  entering={ZoomIn.delay(idx * 100).duration(300)}
                >
                  <Pressable
                    onPress={() => handleSatisfactionSelect(opt.key)}
                    className={`w-[100px] h-[120px] rounded-2xl items-center justify-center border-2 ${
                      satisfaction === opt.key
                        ? `${opt.selectedBg} border-current`
                        : `${opt.bgColor} border-gray-100`
                    }`}
                    style={
                      satisfaction === opt.key
                        ? { borderColor: opt.color }
                        : undefined
                    }
                  >
                    <Text className="text-4xl mb-2">{opt.emoji}</Text>
                    <Text
                      className="text-sm font-semibold"
                      style={{
                        color:
                          satisfaction === opt.key ? opt.color : "#6B7280",
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Phase 2: Follow-up (depends on satisfaction) */}
        {phase === "followup" && satisfaction && (
          <Animated.View entering={FadeInUp.duration(400)}>
            {satisfaction === "great" && (
              <>
                <View className="mt-6 mb-4">
                  <Text className="text-lg font-bold text-gray-900">
                    {t("feedback.what_made_great")}
                  </Text>
                  <Text className="text-sm text-gray-500 mt-1">
                    {t("feedback.optional_detail")}
                  </Text>
                </View>
                <Card variant="default">
                  <TextInput
                    value={freeText}
                    onChangeText={setFreeText}
                    placeholder={t("feedback.great_placeholder")}
                    placeholderTextColor="#9CA3AF"
                    className="bg-gray-50 rounded-xl px-4 py-3.5 text-base text-gray-900 border border-gray-200 min-h-[100px]"
                    multiline
                    textAlignVertical="top"
                  />
                </Card>
              </>
            )}

            {satisfaction === "poor" && (
              <>
                <View className="mt-6 mb-4">
                  <Text className="text-lg font-bold text-gray-900">
                    {t("feedback.what_went_wrong")}
                  </Text>
                  <Text className="text-sm text-gray-500 mt-1">
                    {t("feedback.select_issues")}
                  </Text>
                </View>

                <View className="gap-3">
                  {ISSUE_OPTIONS.map((issue, idx) => (
                    <Animated.View
                      key={issue.key}
                      entering={FadeInUp.delay(idx * 80).duration(300)}
                    >
                      <Pressable
                        onPress={() => toggleIssue(issue.key)}
                        className={`flex-row items-center px-4 py-3.5 rounded-xl border ${
                          issueCategories.includes(issue.key)
                            ? "bg-red-50 border-red-200"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <Text className="text-xl mr-3">{issue.icon}</Text>
                        <Text
                          className={`text-base font-medium flex-1 ${
                            issueCategories.includes(issue.key)
                              ? "text-red-700"
                              : "text-gray-700"
                          }`}
                        >
                          {issue.label}
                        </Text>
                        {issueCategories.includes(issue.key) && (
                          <Animated.View entering={ZoomIn.duration(200)}>
                            <View className="w-5 h-5 rounded-full bg-red-500 items-center justify-center">
                              <Text className="text-white text-xs font-bold">
                                ✓
                              </Text>
                            </View>
                          </Animated.View>
                        )}
                      </Pressable>
                    </Animated.View>
                  ))}
                </View>

                <View className="mt-4">
                  <TextInput
                    value={freeText}
                    onChangeText={setFreeText}
                    placeholder={t("feedback.poor_placeholder")}
                    placeholderTextColor="#9CA3AF"
                    className="bg-white rounded-xl px-4 py-3.5 text-base text-gray-900 border border-gray-200 min-h-[80px]"
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </>
            )}

            {satisfaction === "okay" && (
              <>
                <View className="mt-6 mb-4">
                  <Text className="text-lg font-bold text-gray-900">
                    {t("feedback.anything_to_share")}
                  </Text>
                  <Text className="text-sm text-gray-500 mt-1">
                    {t("feedback.optional_detail")}
                  </Text>
                </View>
                <Card variant="default">
                  <TextInput
                    value={freeText}
                    onChangeText={setFreeText}
                    placeholder={t("feedback.okay_placeholder")}
                    placeholderTextColor="#9CA3AF"
                    className="bg-gray-50 rounded-xl px-4 py-3.5 text-base text-gray-900 border border-gray-200 min-h-[100px]"
                    multiline
                    textAlignVertical="top"
                  />
                </Card>
              </>
            )}

            <View className="mt-6 gap-3">
              <Button
                onPress={handleFollowupNext}
                variant="primary"
                size="lg"
              >
                {params.opponentId
                  ? t("common.next")
                  : t("feedback.submit")}
              </Button>
              <Button
                onPress={handleFollowupNext}
                variant="ghost"
                size="lg"
              >
                {t("feedback.skip")}
              </Button>
            </View>
          </Animated.View>
        )}

        {/* Phase 3: Opponent skill rating */}
        {phase === "opponent" && (
          <Animated.View entering={FadeInUp.duration(400)}>
            <View className="mt-6 mb-4">
              <Text className="text-lg font-bold text-gray-900">
                {t("feedback.opponent_level")}
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                {t("feedback.opponent_level_desc")}
              </Text>
            </View>

            <View className="gap-3">
              {OPPONENT_SKILL_OPTIONS.map((opt, idx) => (
                <Animated.View
                  key={opt.key}
                  entering={FadeInUp.delay(idx * 80).duration(300)}
                >
                  <Pressable
                    onPress={() => setOpponentSkill(opt.key)}
                    className={`px-4 py-4 rounded-xl border ${
                      opponentSkill === opt.key
                        ? "bg-brand-50 border-brand-300"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <Text
                      className={`text-base font-semibold ${
                        opponentSkill === opt.key
                          ? "text-brand-700"
                          : "text-gray-800"
                      }`}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      className={`text-sm mt-0.5 ${
                        opponentSkill === opt.key
                          ? "text-brand-600"
                          : "text-gray-500"
                      }`}
                    >
                      {opt.description}
                    </Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>

            <View className="mt-6 gap-3">
              <Button
                onPress={handleSubmit}
                variant="primary"
                size="lg"
                disabled={mutation.isPending}
              >
                {mutation.isPending
                  ? t("common.loading")
                  : t("feedback.submit")}
              </Button>
              <Button onPress={handleSubmit} variant="ghost" size="lg">
                {t("feedback.skip")}
              </Button>
            </View>
          </Animated.View>
        )}

        {/* Phase 4: Done */}
        {phase === "done" && (
          <Animated.View
            entering={FadeIn.duration(500)}
            className="items-center mt-16"
          >
            <Animated.View entering={ZoomIn.delay(100).duration(400)}>
              <CheckIcon />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <Text className="text-2xl font-bold text-gray-900 mt-5 text-center">
                {t("feedback.thanks")}
              </Text>
              <Text className="text-base text-gray-500 mt-2 text-center px-4">
                {t("feedback.thanks_desc")}
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeInUp.delay(500).duration(400)}
              className="mt-10 w-full"
            >
              <Button
                onPress={() => router.back()}
                variant="primary"
                size="lg"
              >
                {t("feedback.done")}
              </Button>
            </Animated.View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Progress indicator */}
      {phase !== "done" && (
        <View className="px-5 pb-4">
          <View className="flex-row gap-2">
            {["satisfaction", "followup", "opponent"].map((p) => (
              <View
                key={p}
                className={`flex-1 h-1 rounded-full ${
                  phase === p
                    ? "bg-brand-500"
                    : ["satisfaction", "followup", "opponent"].indexOf(p) <
                        ["satisfaction", "followup", "opponent"].indexOf(phase)
                      ? "bg-brand-200"
                      : "bg-gray-200"
                }`}
              />
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
