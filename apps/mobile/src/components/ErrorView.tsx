import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorView({ message, onRetry }: ErrorViewProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-lg font-semibold text-gray-900 mb-2">
        {t("common.error")}
      </Text>
      {message && (
        <Text className="text-sm text-gray-500 text-center mb-4">
          {message}
        </Text>
      )}
      {onRetry && (
        <Pressable
          className="bg-brand-600 px-6 py-3 rounded-full"
          onPress={onRetry}
        >
          <Text className="text-white font-semibold">{t("common.retry")}</Text>
        </Pressable>
      )}
    </View>
  );
}
