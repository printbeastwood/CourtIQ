import { Redirect } from "expo-router";
import { useAuthStore } from "../src/stores/auth";
import { LoadingScreen } from "../src/components/LoadingScreen";

export default function Index() {
  const { token, isOnboarded, isLoading } = useAuthStore();

  if (isLoading) return <LoadingScreen />;
  if (!token) return <Redirect href="/(auth)/login" />;
  if (!isOnboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/home" />;
}
