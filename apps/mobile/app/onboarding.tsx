import { useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";
import { useAuthStore } from "../src/stores/auth";
import { storePreferences } from "../src/lib/api";

const { width } = Dimensions.get("window");

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Pro"];
const PLAY_STYLES = [
  "Casual rallies",
  "Competitive matches",
  "Training & drills",
  "Social games",
];
const SURFACES = ["Glass", "Panoramic", "Turf", "No preference"];
const TIME_PREFS = ["Mornings", "Afternoons", "Evenings", "Weekends only"];

type Step = "skill" | "style" | "surface" | "time" | "extra";
const STEPS: Step[] = ["skill", "style", "surface", "time", "extra"];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const setOnboarded = useAuthStore((s) => s.setOnboarded);
  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({
    skill: [],
    style: [],
    surface: [],
    time: [],
  });
  const [extraText, setExtraText] = useState("");
  const [saving, setSaving] = useState(false);

  const step = STEPS[stepIndex];

  const toggle = (category: string, value: string) => {
    setSelections((prev) => {
      const arr = prev[category] ?? [];
      return {
        ...prev,
        [category]: arr.includes(value)
          ? arr.filter((v) => v !== value)
          : [...arr, value],
      };
    });
  };

  const handleNext = async () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
      return;
    }

    // Final step — save preferences and complete onboarding
    setSaving(true);
    try {
      if (userId) {
        const prefs: Array<{ text: string; category?: string }> = [];
        for (const level of selections.skill) {
          prefs.push({ text: level, category: "skill_level" });
        }
        for (const style of selections.style) {
          prefs.push({ text: style, category: "play_style" });
        }
        for (const surface of selections.surface) {
          if (surface !== "No preference") {
            prefs.push({ text: `Prefer ${surface.toLowerCase()} courts`, category: "court_surface" });
          }
        }
        for (const time of selections.time) {
          prefs.push({ text: `Prefer playing ${time.toLowerCase()}`, category: "time" });
        }
        if (extraText.trim()) {
          prefs.push({ text: extraText.trim() });
        }
        if (prefs.length > 0) {
          await storePreferences(userId, prefs);
        }
      }
      await setOnboarded(true);
      router.replace("/(tabs)/home");
    } catch {
      // Still complete onboarding even if preference save fails
      await setOnboarded(true);
      router.replace("/(tabs)/home");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    await setOnboarded(true);
    router.replace("/(tabs)/home");
  };

  const optionsForStep: Record<string, string[]> = {
    skill: SKILL_LEVELS,
    style: PLAY_STYLES,
    surface: SURFACES,
    time: TIME_PREFS,
  };

  const titlesForStep: Record<string, string> = {
    skill: t("onboarding.skill_level"),
    style: t("onboarding.play_style"),
    surface: "Preferred court surface?",
    time: "When do you usually play?",
    extra: t("onboarding.preferences"),
  };

  return (
    <View className="flex-1 bg-brand-950">
      <View className="flex-1 justify-center px-8 pt-20">
        {/* Progress dots */}
        <View className="flex-row justify-center mb-8 gap-2">
          {STEPS.map((_, i) => (
            <View
              key={i}
              className={`h-2 rounded-full ${
                i <= stepIndex ? "bg-brand-500 w-8" : "bg-white/20 w-2"
              }`}
            />
          ))}
        </View>

        <Animated.View
          key={step}
          entering={FadeInRight.duration(300)}
          exiting={FadeOutLeft.duration(200)}
        >
          <Text className="text-2xl font-bold text-white mb-6">
            {titlesForStep[step]}
          </Text>

          {step === "extra" ? (
            <TextInput
              className="bg-white/10 text-white text-base px-4 py-4 rounded-xl min-h-[120px]"
              placeholder="e.g. I like playing near Sukhumvit, prefer courts under 500 THB/hr..."
              placeholderTextColor="#94A3B8"
              value={extraText}
              onChangeText={setExtraText}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <View className="gap-3">
              {(optionsForStep[step] ?? []).map((option) => {
                const selected = (selections[step] ?? []).includes(option);
                return (
                  <Pressable
                    key={option}
                    className={`px-5 py-4 rounded-xl border ${
                      selected
                        ? "bg-brand-500/20 border-brand-500"
                        : "bg-white/5 border-white/10"
                    }`}
                    onPress={() => toggle(step, option)}
                  >
                    <Text
                      className={`text-base ${
                        selected ? "text-brand-300 font-semibold" : "text-white"
                      }`}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Animated.View>
      </View>

      <View className="px-8 pb-12 pt-4">
        <Pressable
          className="bg-brand-500 py-4 rounded-xl items-center mb-3"
          onPress={handleNext}
          disabled={saving}
        >
          <Text className="text-white text-lg font-semibold">
            {saving
              ? t("common.loading")
              : stepIndex === STEPS.length - 1
                ? t("onboarding.done")
                : t("onboarding.next")}
          </Text>
        </Pressable>
        <Pressable className="items-center py-2" onPress={handleSkip}>
          <Text className="text-brand-400">{t("onboarding.skip")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
