import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/stores/auth";

export default function VerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      // TODO: integrate Firebase Auth confirmationResult.confirm(code)
      // For now, simulate successful auth
      await setAuth({
        token: "demo-jwt-token",
        userId: "00000000-0000-0000-0000-000000000001",
        phone: phone ?? "+66000000000",
        displayName: undefined,
      });
      router.replace("/onboarding");
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
        <Text className="text-2xl font-bold text-white mb-2">
          {t("auth.otp_title")}
        </Text>
        <Text className="text-brand-300 mb-8">
          Sent to {phone}
        </Text>

        <TextInput
          className="bg-white/10 text-white text-2xl px-4 py-4 rounded-xl mb-6 text-center tracking-[12px]"
          placeholder={t("auth.otp_placeholder")}
          placeholderTextColor="#94A3B8"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />

        <Pressable
          className={`py-4 rounded-xl items-center ${
            code.length === 6 ? "bg-brand-500" : "bg-brand-500/30"
          }`}
          onPress={handleVerify}
          disabled={code.length !== 6 || loading}
        >
          <Text className="text-white text-lg font-semibold">
            {loading ? t("common.loading") : t("auth.verify")}
          </Text>
        </Pressable>

        <Pressable className="mt-4 items-center" onPress={() => {}}>
          <Text className="text-brand-400">{t("auth.resend")}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
