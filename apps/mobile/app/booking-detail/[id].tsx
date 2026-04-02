import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Card, Button, Badge, SurfaceBadge } from "@courtiq/ui";
import {
  fetchBookingDetail,
  cancelBooking,
  type BookingDetail,
} from "../../src/lib/api";
import { formatPrice, formatTime, formatDate } from "../../src/lib/format";

const STATUS_CONFIG: Record<
  string,
  { variant: "success" | "warning" | "error" | "default"; icon: string; label: string }
> = {
  confirmed: { variant: "success", icon: "checkmark-circle", label: "Confirmed" },
  pending: { variant: "warning", icon: "time", label: "Pending" },
  cancelled: { variant: "error", icon: "close-circle", label: "Cancelled" },
  payment_failed: { variant: "error", icon: "alert-circle", label: "Payment Failed" },
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  succeeded: "Paid",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded",
};

function isUpcoming(endsAt: string): boolean {
  return new Date(endsAt).getTime() > Date.now();
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const detailQuery = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: () => fetchBookingDetail(id!),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No booking ID");
      return cancelBooking(id, cancelReason || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking-detail", id] });
      setShowCancelForm(false);
      Alert.alert("Booking Cancelled", "Your booking has been cancelled. Any refund will be processed shortly.");
    },
  });

  const handleCancelPress = () => {
    if (showCancelForm) {
      Alert.alert(
        "Cancel Booking",
        "Are you sure you want to cancel this booking?",
        [
          { text: "Keep Booking", style: "cancel" },
          {
            text: "Cancel Booking",
            style: "destructive",
            onPress: () => cancelMutation.mutate(),
          },
        ],
      );
    } else {
      setShowCancelForm(true);
    }
  };

  if (detailQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center px-8">
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text className="text-lg font-semibold text-gray-900 mt-3">
          Could not load booking
        </Text>
        <Button
          variant="primary"
          size="md"
          onPress={() => detailQuery.refetch()}
          className="mt-4"
        >
          {t("common.retry")}
        </Button>
      </SafeAreaView>
    );
  }

  const booking = detailQuery.data.booking;
  const { slot, court, venue, breakdown, cancellation } = booking;
  const statusConfig = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const upcoming = isUpcoming(slot.endsAt);
  const canCancel =
    upcoming && (booking.status === "confirmed" || booking.status === "pending");

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-2 pb-3">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-white border border-gray-100"
        >
          <Ionicons name="chevron-back" size={20} color="#1F2937" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900 ml-3 flex-1">
          Booking Details
        </Text>
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
      </View>

      <ScrollView className="flex-1 px-5">
        {/* Status banner */}
        <Animated.View entering={FadeInUp.duration(300)}>
          {booking.status === "cancelled" && cancellation && (
            <View className="bg-red-50 rounded-xl p-4 mb-3 border border-red-100">
              <View className="flex-row items-center gap-2 mb-1">
                <Ionicons name="close-circle" size={18} color="#EF4444" />
                <Text className="text-sm font-semibold text-red-700">
                  Booking Cancelled
                </Text>
              </View>
              {cancellation.reason && (
                <Text className="text-sm text-red-600 mt-1">
                  Reason: {cancellation.reason}
                </Text>
              )}
              {cancellation.refundStatus && (
                <View className="flex-row items-center mt-2 gap-1.5">
                  <Ionicons
                    name={
                      cancellation.refundStatus === "processed"
                        ? "checkmark-circle"
                        : "time"
                    }
                    size={14}
                    color={
                      cancellation.refundStatus === "processed"
                        ? "#10B981"
                        : "#F59E0B"
                    }
                  />
                  <Text className="text-sm text-gray-700">
                    Refund:{" "}
                    {cancellation.refundStatus === "processed"
                      ? `${formatPrice(cancellation.refundAmountCents ?? 0, breakdown?.currency ?? "THB")} refunded`
                      : cancellation.refundStatus === "pending"
                        ? "Processing..."
                        : "Not eligible"}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* Venue & Court Info */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <Card variant="elevated">
            <View className="flex-row items-start gap-3">
              <View className="w-12 h-12 rounded-xl bg-brand-100 items-center justify-center">
                <Ionicons name="location" size={24} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-900">
                  {venue.name}
                </Text>
                {venue.address ? (
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {venue.address}
                  </Text>
                ) : null}
                <View className="flex-row items-center gap-1.5 mt-2">
                  <Text className="text-sm text-gray-700">{court.name}</Text>
                  <SurfaceBadge surface={court.surface as any} />
                  {court.indoor && (
                    <Badge variant="default">Indoor</Badge>
                  )}
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Date & Time */}
        <Animated.View entering={FadeInUp.delay(150).duration(400)}>
          <Card variant="elevated" className="mt-3">
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 rounded-xl bg-amber-100 items-center justify-center">
                <Ionicons name="calendar" size={24} color="#F59E0B" />
              </View>
              <View>
                <Text className="text-base font-semibold text-gray-900">
                  {formatDate(slot.startsAt)}
                </Text>
                <Text className="text-sm text-gray-500 mt-0.5">
                  {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Payment Info */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <Card variant="elevated" className="mt-3">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-semibold text-gray-900">
                Payment
              </Text>
              {booking.paymentStatus && (
                <Badge
                  variant={
                    booking.paymentStatus === "succeeded"
                      ? "success"
                      : booking.paymentStatus === "refunded"
                        ? "warning"
                        : booking.paymentStatus === "failed"
                          ? "error"
                          : "default"
                  }
                >
                  {PAYMENT_STATUS_LABELS[booking.paymentStatus] ??
                    booking.paymentStatus}
                </Badge>
              )}
            </View>

            {breakdown ? (
              <View className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-gray-500">Court rental</Text>
                  <Text className="text-sm text-gray-900">
                    {formatPrice(breakdown.subtotalCents, breakdown.currency)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-gray-500">
                    Service fee ({(breakdown.commissionRate * 100).toFixed(0)}
                    %)
                  </Text>
                  <Text className="text-sm text-gray-900">
                    {formatPrice(
                      breakdown.commissionCents,
                      breakdown.currency,
                    )}
                  </Text>
                </View>
                <View className="h-px bg-gray-100 my-1" />
                <View className="flex-row justify-between">
                  <Text className="text-base font-bold text-gray-900">
                    Total
                  </Text>
                  <Text className="text-base font-bold text-brand-600">
                    {formatPrice(breakdown.totalCents, breakdown.currency)}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-500">Price</Text>
                <Text className="text-base font-bold text-brand-600">
                  {formatPrice(slot.priceCents, slot.currency)}
                </Text>
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Cancel Form */}
        {showCancelForm && canCancel && (
          <Animated.View entering={FadeInUp.duration(300)}>
            <Card variant="elevated" className="mt-3">
              <Text className="text-base font-semibold text-gray-900 mb-2">
                Cancel This Booking
              </Text>
              <Text className="text-sm text-gray-500 mb-3">
                Please tell us why you're cancelling (optional)
              </Text>
              <TextInput
                className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 border border-gray-200 mb-3"
                placeholder="Reason for cancellation..."
                placeholderTextColor="#9CA3AF"
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Button
                    variant="ghost"
                    size="md"
                    fullWidth
                    onPress={() => setShowCancelForm(false)}
                  >
                    Keep Booking
                  </Button>
                </View>
                <View className="flex-1">
                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    loading={cancelMutation.isPending}
                    onPress={handleCancelPress}
                    className="bg-red-500"
                  >
                    Confirm Cancel
                  </Button>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Spacer */}
        <View className="h-24" />
      </ScrollView>

      {/* Bottom Actions */}
      {canCancel && !showCancelForm && (
        <View className="px-5 pb-4 pt-3 border-t border-gray-100 bg-white">
          <Pressable
            className="py-3.5 items-center rounded-xl border border-red-200 bg-red-50"
            onPress={handleCancelPress}
          >
            <Text className="text-sm font-semibold text-red-600">
              Cancel Booking
            </Text>
          </Pressable>
        </View>
      )}

      {/* Feedback CTA for past confirmed bookings */}
      {!upcoming && booking.status === "confirmed" && (
        <View className="px-5 pb-4 pt-3 border-t border-gray-100 bg-white">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={() =>
              router.push({
                pathname: "/post-match-feedback",
                params: { bookingId: booking.id, venueName: venue.name },
              })
            }
          >
            Rate This Session
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}
