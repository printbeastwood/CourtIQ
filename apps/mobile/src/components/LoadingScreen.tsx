import { View, ActivityIndicator, Text } from "react-native";
import { useTranslation } from "react-i18next";

export function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-brand-950 items-center justify-center">
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text className="text-white mt-4 text-base">{t("common.loading")}</Text>
    </View>
  );
}
