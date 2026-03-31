import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState("+66");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (phone.length < 10) return;
    setLoading(true);
    try {
      // TODO: integrate Firebase Auth signInWithPhoneNumber
      // For now, navigate to verify screen with phone as param
      router.push({ pathname: "/(auth)/verify", params: { phone } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-brand-950"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 justify-center px-8">
        <Text className="text-4xl font-bold text-white mb-2">CourtIQ</Text>
        <Text className="text-lg text-brand-300 mb-12">
          {t("onboarding.subtitle")}
        </Text>

        <Text className="text-white text-base mb-3">
          {t("auth.phone_title")}
        </Text>
        <TextInput
          className="bg-white/10 text-white text-lg px-4 py-4 rounded-xl mb-6"
          placeholder={t("auth.phone_placeholder")}
          placeholderTextColor="#94A3B8"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoFocus
        />

        <Pressable
          className={`py-4 rounded-xl items-center ${
            phone.length >= 10 ? "bg-brand-500" : "bg-brand-500/30"
          }`}
          onPress={handleSendOtp}
          disabled={phone.length < 10 || loading}
        >
          <Text className="text-white text-lg font-semibold">
            {loading ? t("common.loading") : t("auth.send_otp")}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
