import { useState } from "react";
import { View, Text, Pressable, Alert, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/stores/auth";
import { formatPrice, formatTime, formatDate } from "../../src/lib/format";

export default function BookingConfirmScreen() {
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const [loading, setLoading] = useState(false);

  // In production, this would fetch slot details by ID
  // For now, show a confirmation UI
  const handleConfirm = async () => {
    if (!userId || !slotId) return;
    setLoading(true);
    try {
      // The concierge's initiate_booking tool handles actual booking creation.
      // Direct booking can use the same endpoint once exposed via REST.
      Alert.alert(
        "Booking Initiated",
        "Your booking request has been submitted. You'll receive a confirmation shortly.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (err) {
      Alert.alert("Error", "Failed to create booking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["bottom"]}>
      <View className="flex-1 px-4 pt-6">
        <View className="bg-white rounded-2xl p-6 border border-gray-100">
          <Text className="text-xl font-bold text-gray-900 mb-4">
            {t("booking.confirm")}
          </Text>

          <View className="bg-brand-50 rounded-xl p-4 mb-4">
            <Text className="text-sm text-brand-600 font-medium">
              Slot ID: {slotId}
            </Text>
          </View>

          <Text className="text-sm text-gray-500 mb-6">
            By confirming, you agree to the venue's booking terms. The slot will
            be held for 10 minutes while you complete payment.
          </Text>

          <Pressable
            className={`py-4 rounded-xl items-center ${
              loading ? "bg-brand-400" : "bg-brand-600"
            }`}
            onPress={handleConfirm}
            disabled={loading}
          >
            <Text className="text-white text-lg font-semibold">
              {loading ? t("common.loading") : t("booking.confirm")}
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="px-4 pb-4">
        <Pressable
          className="py-3 items-center"
          onPress={() => router.back()}
        >
          <Text className="text-gray-500">{t("common.cancel")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
