import { View, Text, ScrollView, Pressable, Share, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import Svg, { Path } from "react-native-svg";
import { Card, Badge } from "@courtiq/ui";
import { useAuthStore } from "../src/stores/auth";
import { getMyReferrals, generateReferralCode } from "../src/lib/api";
import type { ReferralClaimItem } from "../src/lib/api";

function BackArrow() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5M5 12L12 19M5 12L12 5"
        stroke="#1F2937"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShareIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CopyIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z"
        stroke="#2563EB"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 bg-gray-50 rounded-xl py-3 px-2 items-center">
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
      <Text className="text-xs text-gray-500 mt-0.5">{label}</Text>
    </View>
  );
}

function ClaimRow({ claim }: { claim: ReferralClaimItem }) {
  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-amber-50", text: "text-amber-700", label: "Pending" },
    confirmed: { bg: "bg-green-50", text: "text-green-700", label: "Confirmed" },
    rewarded: { bg: "bg-brand-50", text: "text-brand-700", label: "Rewarded" },
  };
  const status = statusColors[claim.status] ?? statusColors.pending;

  return (
    <View className="flex-row items-center justify-between py-3 border-b border-gray-50">
      <View className="flex-1">
        <Text className="text-base font-medium text-gray-900">
          {claim.refereeDisplayName ?? "Unknown Player"}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {claim.claimedAt
            ? new Date(claim.claimedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—"}
        </Text>
      </View>
      <View className={`${status.bg} rounded-full px-3 py-1`}>
        <Text className={`text-xs font-medium ${status.text}`}>
          {status.label}
        </Text>
      </View>
    </View>
  );
}

export default function ReferralsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { displayName } = useAuthStore();

  const referralsQuery = useQuery({
    queryKey: ["referrals", "mine"],
    queryFn: () => getMyReferrals(),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateReferralCode("player"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referrals", "mine"] });
    },
  });

  const data = referralsQuery.data;
  const referral = data?.referral;
  const claims = data?.claims ?? [];
  const stats = data?.stats;

  const handleShare = async () => {
    if (!referral) return;
    try {
      await Share.share({
        message: `Join me on CourtIQ — your AI padel concierge! Use my referral code ${referral.code} or sign up here: ${referral.shareUrl}`,
      });
    } catch {
      // User cancelled
    }
  };

  const handleCopyCode = async () => {
    if (!referral) return;
    await Clipboard.setStringAsync(referral.code);
  };

  const handleCopyLink = async () => {
    if (!referral) return;
    await Clipboard.setStringAsync(referral.shareUrl);
  };

  const isLoading = referralsQuery.isLoading;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        {/* Header */}
        <View className="flex-row items-center px-5 pt-4 pb-3">
          <Pressable onPress={() => router.back()} className="mr-3 p-1">
            <BackArrow />
          </Pressable>
          <Text className="text-2xl font-bold text-gray-900">Referrals</Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : !referral ? (
          /* No code yet — generate one */
          <View className="px-5 mt-8">
            <Card variant="elevated">
              <View className="items-center py-6">
                <Text className="text-6xl mb-4">🎾</Text>
                <Text className="text-xl font-bold text-gray-900 text-center mb-2">
                  Invite Friends to CourtIQ
                </Text>
                <Text className="text-sm text-gray-500 text-center mb-6 px-4">
                  Share your personal referral code and help grow the padel
                  community. Track who joins through your link.
                </Text>
                <Pressable
                  onPress={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="bg-brand-600 rounded-xl py-3.5 px-8"
                >
                  <Text className="text-white font-semibold text-base">
                    {generateMutation.isPending
                      ? "Generating..."
                      : "Get My Referral Code"}
                  </Text>
                </Pressable>
              </View>
            </Card>
          </View>
        ) : (
          /* Has code — show dashboard */
          <View className="px-5">
            {/* Code card */}
            <Card variant="elevated">
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Your Referral Code
              </Text>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-3xl font-bold text-brand-600 tracking-widest">
                  {referral.code}
                </Text>
                <Pressable
                  onPress={handleCopyCode}
                  className="flex-row items-center bg-brand-50 rounded-lg px-3 py-2"
                >
                  <CopyIcon />
                  <Text className="text-sm font-medium text-brand-600 ml-1.5">
                    Copy
                  </Text>
                </Pressable>
              </View>

              {/* Share URL */}
              <Pressable
                onPress={handleCopyLink}
                className="bg-gray-50 rounded-xl px-4 py-3 flex-row items-center justify-between mb-4"
              >
                <Text
                  className="text-sm text-gray-600 flex-1"
                  numberOfLines={1}
                >
                  {referral.shareUrl}
                </Text>
                <CopyIcon />
              </Pressable>

              {/* Share button */}
              <Pressable
                onPress={handleShare}
                className="bg-brand-600 rounded-xl py-3.5 flex-row items-center justify-center"
              >
                <ShareIcon />
                <Text className="text-white font-semibold text-base ml-2">
                  Share with Friends
                </Text>
              </Pressable>
            </Card>

            {/* Stats */}
            {stats && (
              <View className="flex-row gap-3 mt-4">
                <StatBox label="Link Clicks" value={stats.totalClicks} />
                <StatBox label="Signups" value={stats.totalClaims} />
                <StatBox label="Confirmed" value={stats.confirmedClaims} />
              </View>
            )}

            {/* Referred players */}
            <View className="mt-4">
              <Card variant="default">
                <Text className="text-lg font-semibold text-gray-900 mb-1">
                  Referred Players
                </Text>
                <Text className="text-xs text-gray-400 mb-3">
                  People who signed up with your code
                </Text>

                {claims.length === 0 ? (
                  <View className="py-6 items-center">
                    <Text className="text-sm text-gray-400">
                      No referrals yet — share your code to get started!
                    </Text>
                  </View>
                ) : (
                  claims.map((claim) => (
                    <ClaimRow key={claim.id} claim={claim} />
                  ))
                )}
              </Card>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
