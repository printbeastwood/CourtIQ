import { useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, {
  FadeInRight,
  FadeOutLeft,
  FadeInUp,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, RacketIcon } from "@courtiq/ui";
import { useAuthStore } from "../src/stores/auth";
import { storePreferences } from "../src/lib/api";

const SKILL_LEVELS = [
  { label: "Beginner", desc: "Just starting out" },
  { label: "Intermediate", desc: "Know the basics, improving my game" },
  { label: "Advanced", desc: "Consistent player, competitive level" },
  { label: "Pro", desc: "Tournament-level player" },
];

const PLAY_STYLES = [
  { label: "Casual rallies", emoji: "🎾" },
  { label: "Competitive matches", emoji: "🏆" },
  { label: "Training & drills", emoji: "💪" },
  { label: "Social games", emoji: "👥" },
];

const SURFACES = [
  { label: "Glass", color: "#06B6D4" },
  { label: "Panoramic", color: "#8B5CF6" },
  { label: "Turf", color: "#22C55E" },
  { label: "No preference", color: "#94A3B8" },
];

const TIME_PREFS = [
  { label: "Mornings", desc: "6am – 12pm" },
  { label: "Afternoons", desc: "12pm – 5pm" },
  { label: "Evenings", desc: "5pm – 10pm" },
  { label: "Weekends only", desc: "Sat & Sun" },
];

type Step = "welcome" | "skill" | "style" | "surface" | "time" | "extra";
const STEPS: Step[] = ["welcome", "skill", "style", "surface", "time", "extra"];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const displayName = useAuthStore((s) => s.displayName);
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
            prefs.push({
              text: `Prefer ${surface.toLowerCase()} courts`,
              category: "court_surface",
            });
          }
        }
        for (const time of selections.time) {
          prefs.push({
            text: `Prefer playing ${time.toLowerCase()}`,
            category: "time",
          });
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

  const handleBack = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const progressSteps = STEPS.filter((s) => s !== "welcome");
  const progressIndex = stepIndex - 1;

  return (
    <SafeAreaView className="flex-1 bg-brand-950" edges={["top", "bottom"]}>
      <View className="flex-1 justify-between">
        {/* Top area */}
        <View className="flex-1 px-6 pt-4">
          {/* Back button + progress (hidden on welcome) */}
          {step !== "welcome" && (
            <View className="flex-row items-center mb-6">
              <Pressable onPress={handleBack} className="mr-4 py-2 pr-4">
                <Text className="text-white text-lg">←</Text>
              </Pressable>
              <View className="flex-1 flex-row gap-1.5">
                {progressSteps.map((_, i) => (
                  <View
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i <= progressIndex
                        ? "bg-brand-400"
                        : "bg-white/10"
                    }`}
                  />
                ))}
              </View>
            </View>
          )}

          <Animated.View
            key={step}
            entering={FadeInRight.duration(300)}
            exiting={FadeOutLeft.duration(200)}
            className="flex-1"
          >
            {step === "welcome" && (
              <View className="flex-1 justify-center items-center px-4">
                <Animated.View entering={FadeInUp.delay(100).duration(400)}>
                  <View className="w-20 h-20 rounded-full bg-brand-500/20 items-center justify-center mb-6 self-center">
                    <RacketIcon size={40} color="#60A5FA" />
                  </View>
                </Animated.View>
                <Animated.View entering={FadeInUp.delay(250).duration(400)}>
                  <Text className="text-3xl font-extrabold text-white text-center mb-3">
                    Welcome{displayName ? `, ${displayName}` : ""}!
                  </Text>
                </Animated.View>
                <Animated.View entering={FadeInUp.delay(400).duration(400)}>
                  <Text className="text-base text-brand-300 text-center leading-6">
                    Let's learn how you play so we can find you the perfect
                    courts in Bangkok. This takes about 30 seconds.
                  </Text>
                </Animated.View>
              </View>
            )}

            {step === "skill" && (
              <View>
                <Text className="text-sm font-semibold text-brand-400 uppercase tracking-wider mb-2">
                  About you
                </Text>
                <Text className="text-2xl font-bold text-white mb-2">
                  What's your skill level?
                </Text>
                <Text className="text-sm text-brand-300/70 mb-6">
                  This helps us match you with the right games
                </Text>
                <View className="gap-3">
                  {SKILL_LEVELS.map((item) => {
                    const selected = selections.skill.includes(item.label);
                    return (
                      <Pressable
                        key={item.label}
                        className={`px-5 py-4 rounded-2xl border ${
                          selected
                            ? "bg-brand-500/20 border-brand-400"
                            : "bg-white/5 border-white/10"
                        }`}
                        onPress={() => toggle("skill", item.label)}
                      >
                        <Text
                          className={`text-base font-medium ${
                            selected ? "text-white" : "text-white/90"
                          }`}
                        >
                          {item.label}
                        </Text>
                        <Text className="text-sm text-brand-300/60 mt-0.5">
                          {item.desc}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {step === "style" && (
              <View>
                <Text className="text-sm font-semibold text-brand-400 uppercase tracking-wider mb-2">
                  Play style
                </Text>
                <Text className="text-2xl font-bold text-white mb-2">
                  How do you like to play?
                </Text>
                <Text className="text-sm text-brand-300/70 mb-6">
                  Pick all that apply
                </Text>
                <View className="gap-3">
                  {PLAY_STYLES.map((item) => {
                    const selected = selections.style.includes(item.label);
                    return (
                      <Pressable
                        key={item.label}
                        className={`flex-row items-center px-5 py-4 rounded-2xl border ${
                          selected
                            ? "bg-brand-500/20 border-brand-400"
                            : "bg-white/5 border-white/10"
                        }`}
                        onPress={() => toggle("style", item.label)}
                      >
                        <Text className="text-2xl mr-4">{item.emoji}</Text>
                        <Text
                          className={`text-base font-medium ${
                            selected ? "text-white" : "text-white/90"
                          }`}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {step === "surface" && (
              <View>
                <Text className="text-sm font-semibold text-brand-400 uppercase tracking-wider mb-2">
                  Court preference
                </Text>
                <Text className="text-2xl font-bold text-white mb-2">
                  Preferred court surface?
                </Text>
                <Text className="text-sm text-brand-300/70 mb-6">
                  We'll prioritize these in your recommendations
                </Text>
                <View className="gap-3">
                  {SURFACES.map((item) => {
                    const selected = selections.surface.includes(item.label);
                    return (
                      <Pressable
                        key={item.label}
                        className={`flex-row items-center px-5 py-4 rounded-2xl border ${
                          selected
                            ? "bg-brand-500/20 border-brand-400"
                            : "bg-white/5 border-white/10"
                        }`}
                        onPress={() => toggle("surface", item.label)}
                      >
                        <View
                          className="w-3 h-3 rounded-full mr-4"
                          style={{ backgroundColor: item.color }}
                        />
                        <Text
                          className={`text-base font-medium ${
                            selected ? "text-white" : "text-white/90"
                          }`}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {step === "time" && (
              <View>
                <Text className="text-sm font-semibold text-brand-400 uppercase tracking-wider mb-2">
                  Schedule
                </Text>
                <Text className="text-2xl font-bold text-white mb-2">
                  When do you usually play?
                </Text>
                <Text className="text-sm text-brand-300/70 mb-6">
                  Pick all that apply
                </Text>
                <View className="gap-3">
                  {TIME_PREFS.map((item) => {
                    const selected = selections.time.includes(item.label);
                    return (
                      <Pressable
                        key={item.label}
                        className={`px-5 py-4 rounded-2xl border ${
                          selected
                            ? "bg-brand-500/20 border-brand-400"
                            : "bg-white/5 border-white/10"
                        }`}
                        onPress={() => toggle("time", item.label)}
                      >
                        <Text
                          className={`text-base font-medium ${
                            selected ? "text-white" : "text-white/90"
                          }`}
                        >
                          {item.label}
                        </Text>
                        <Text className="text-sm text-brand-300/60 mt-0.5">
                          {item.desc}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {step === "extra" && (
              <View>
                <Text className="text-sm font-semibold text-brand-400 uppercase tracking-wider mb-2">
                  Almost done
                </Text>
                <Text className="text-2xl font-bold text-white mb-2">
                  {t("onboarding.preferences")}
                </Text>
                <Text className="text-sm text-brand-300/70 mb-6">
                  Tell us anything else — budget, area, group size, whatever matters
                </Text>
                <TextInput
                  className="bg-white/10 text-white text-base px-5 py-4 rounded-2xl min-h-[140px] border border-white/10"
                  placeholder="e.g. I like playing near Sukhumvit, prefer courts under 500 THB/hr, usually play with 3 friends..."
                  placeholderTextColor="#64748B"
                  value={extraText}
                  onChangeText={setExtraText}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            )}
          </Animated.View>
        </View>

        {/* Bottom actions */}
        <View className="px-6 pb-4 pt-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={saving}
            onPress={handleNext}
          >
            {step === "welcome"
              ? "Let's go"
              : stepIndex === STEPS.length - 1
                ? t("onboarding.done")
                : t("onboarding.next")}
          </Button>
          {step !== "welcome" && (
            <Pressable className="items-center py-3 mt-1" onPress={handleSkip}>
              <Text className="text-brand-400 text-sm">
                {t("onboarding.skip")}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
