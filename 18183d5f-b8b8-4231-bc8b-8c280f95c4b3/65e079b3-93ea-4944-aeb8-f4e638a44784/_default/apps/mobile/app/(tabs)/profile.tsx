import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useAuthStore } from "../../src/stores/auth";
import { getUserPreferences } from "../../src/lib/api";
import { surfaceLabel } from "../../src/lib/format";

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
    // Use Share API when available
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

  const categoryLabels: Record<string, string> = {
    play_style: "Play Style",
    skill_level: "Skill Level",
    competitive_intent: "Competitive Intent",
    time: "Time Preferences",
    location: "Location",
    court_surface: "Court Surface",
    group_size: "Group Size",
    coaching: "Coaching",
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        {/* Header */}
        <View className="pt-4 pb-6">
          <Text className="text-2xl font-bold text-gray-900">
            {t("profile.title")}
          </Text>
        </View>

        {/* User info */}
        <View className="bg-white rounded-2xl p-5 mb-4 border border-gray-100">
          <View className="w-16 h-16 rounded-full bg-brand-100 items-center justify-center mb-3">
            <Text className="text-2xl">🏸</Text>
          </View>
          <Text className="text-xl font-semibold text-gray-900">
            {displayName ?? "Player"}
          </Text>
          <Text className="text-sm text-gray-500">{phone}</Text>
        </View>

        {/* Preferences */}
        <View className="bg-white rounded-2xl p-5 mb-4 border border-gray-100">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            {t("profile.preferences")}
          </Text>

          {Object.entries(groupedPrefs).map(([category, prefs]) => (
            <View key={category} className="mb-3">
              <Text className="text-xs font-medium text-gray-400 uppercase mb-1">
                {categoryLabels[category] ?? category}
              </Text>
              <View className="flex-row flex-wrap gap-1">
                {prefs.map((p) => (
                  <View key={p.id} className="bg-brand-50 px-3 py-1 rounded-full">
                    <Text className="text-sm text-brand-700">{p.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {preferences.length === 0 && (
            <Text className="text-sm text-gray-400">No preferences set yet</Text>
          )}
        </View>

        {/* Settings */}
        <View className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          <Pressable
            className="flex-row justify-between items-center px-5 py-4 border-b border-gray-50"
            onPress={toggleLanguage}
          >
            <Text className="text-base text-gray-900">
              {t("profile.language")}
            </Text>
            <Text className="text-sm text-gray-500">
              {i18n.language === "en" ? "English" : "ไทย"}
            </Text>
          </Pressable>

          <Pressable
            className="flex-row justify-between items-center px-5 py-4 border-b border-gray-50"
            onPress={handleShare}
          >
            <Text className="text-base text-gray-900">
              {t("profile.share")}
            </Text>
            <Text className="text-sm text-gray-400">→</Text>
          </Pressable>

          <Pressable
            className="flex-row justify-between items-center px-5 py-4"
            onPress={handleLogout}
          >
            <Text className="text-base text-red-500">
              {t("profile.logout")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
