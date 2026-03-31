import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Avatar, Card, Badge } from "@courtiq/ui";
import { useAuthStore } from "../../src/stores/auth";
import { getUserPreferences } from "../../src/lib/api";
import Svg, { Path, Circle, Rect } from "react-native-svg";

function ChevronRight({ color = "#CBD5E1" }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18l6-6-6-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  play_style: "Play Style",
  skill_level: "Skill Level",
  competitive_intent: "Competitive",
  time: "Schedule",
  location: "Location",
  court_surface: "Court Surface",
  group_size: "Group Size",
  coaching: "Coaching",
};

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { userId, phone, displayName, logout } = useAuthStore();

  const prefsQuery = useQuery({
    queryKey: ["preferences", userId],
    queryFn: () => getUserPreferences(userId!),
    enabled: !!userId,
  });

  const preferences = prefsQuery.data?.preferences ?? [];
  const groupedPrefs = preferences.reduce(
    (acc, p) => {
      if (!acc[p.category]) acc[p.category] = [];
      acc[p.category].push(p);
      return acc;
    },
    {} as Record<string, typeof preferences>,
  );

  const toggleLanguage = () => {
    const next = i18n.language === "en" ? "th" : "en";
    i18n.changeLanguage(next);
  };

  const handleShare = async () => {
    const url = Linking.createURL("/", {
      queryParams: { ref: userId ?? "" },
    });
    Alert.alert("Share CourtIQ", `Invite link: ${url}`);
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.logout"),
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8">
        {/* Header */}
        <View className="pt-4 pb-5">
          <Text className="text-2xl font-bold text-gray-900">
            {t("profile.title")}
          </Text>
        </View>

        {/* User card */}
        <Card variant="elevated">
          <View className="flex-row items-center">
            <Avatar size="lg" name={displayName ?? "Player"} />
            <View className="ml-4 flex-1">
              <Text className="text-xl font-semibold text-gray-900">
                {displayName ?? "Player"}
              </Text>
              <Text className="text-sm text-gray-400 mt-0.5">{phone}</Text>
            </View>
          </View>
        </Card>

        {/* Preferences */}
        <View className="mt-4">
          <Card variant="default">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-semibold text-gray-900">
                {t("profile.preferences")}
              </Text>
              <Pressable onPress={() => router.push("/onboarding")}>
                <Text className="text-sm font-medium text-brand-600">
                  Edit
                </Text>
              </Pressable>
            </View>

            {Object.entries(groupedPrefs).map(([category, prefs]) => (
              <View key={category} className="mb-3">
                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  {CATEGORY_LABELS[category] ?? category}
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {prefs.map((p) => (
                    <Badge key={p.id} variant="brand">
                      {p.text}
                    </Badge>
                  ))}
                </View>
              </View>
            ))}

            {preferences.length === 0 && (
              <View className="py-4 items-center">
                <Text className="text-sm text-gray-400 mb-2">
                  No preferences set yet
                </Text>
                <Pressable onPress={() => router.push("/onboarding")}>
                  <Text className="text-sm font-medium text-brand-600">
                    Set up preferences
                  </Text>
                </Pressable>
              </View>
            )}
          </Card>
        </View>

        {/* Settings */}
        <View className="mt-4">
          <Card variant="default" padded={false}>
            <Pressable
              className="flex-row justify-between items-center px-5 py-4 border-b border-gray-50"
              onPress={toggleLanguage}
            >
              <Text className="text-base text-gray-900">
                {t("profile.language")}
              </Text>
              <View className="flex-row items-center">
                <Text className="text-sm text-gray-400 mr-1.5">
                  {i18n.language === "en" ? "English" : "ไทย"}
                </Text>
                <ChevronRight />
              </View>
            </Pressable>

            <Pressable
              className="flex-row justify-between items-center px-5 py-4 border-b border-gray-50"
              onPress={handleShare}
            >
              <Text className="text-base text-gray-900">
                {t("profile.share")}
              </Text>
              <ChevronRight />
            </Pressable>

            <Pressable
              className="flex-row justify-between items-center px-5 py-4"
              onPress={handleLogout}
            >
              <Text className="text-base text-red-500">
                {t("profile.logout")}
              </Text>
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
