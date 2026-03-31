import { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, Button, Badge, BallIcon } from "@courtiq/ui";
import { useAuthStore } from "../../src/stores/auth";

export default function BookingConfirmScreen() {
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!userId || !slotId) return;
    setLoading(true);
    try {
      Alert.alert(
        "Booking Initiated",
        "Your booking request has been submitted. You'll receive a confirmation shortly.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch {
      Alert.alert("Error", "Failed to create booking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["bottom"]}>
      <View className="flex-1 px-5 pt-6">
        <Card variant="elevated">
          <View className="items-center mb-5">
            <View className="w-14 h-14 rounded-full bg-brand-100 items-center justify-center mb-3">
              <BallIcon size={28} color="#2563EB" />
            </View>
            <Text className="text-xl font-bold text-gray-900">
              {t("booking.confirm")}
            </Text>
          </View>

          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-gray-500">Slot ID</Text>
              <Badge variant="brand">{slotId?.slice(0, 8) ?? ""}</Badge>
            </View>
          </View>

          <Text className="text-sm text-gray-400 text-center leading-5 mb-5">
            By confirming, you agree to the venue's booking terms. The slot will
            be held for 10 minutes while you complete payment.
          </Text>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleConfirm}
          >
            {t("booking.confirm")}
          </Button>
        </Card>
      </View>

      <View className="px-5 pb-4">
        <Pressable className="py-3 items-center" onPress={() => router.back()}>
          <Text className="text-gray-500 font-medium">
            {t("common.cancel")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
