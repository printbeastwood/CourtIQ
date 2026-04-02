import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Linking,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeInUp,
  FadeInDown,
  SlideInRight,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Calendar from "expo-calendar";
import { Card, Button, Badge, SurfaceBadge, BallIcon } from "@courtiq/ui";
import { useAuthStore } from "../../src/stores/auth";
import {
  createPaymentIntent,
  confirmPayment,
  createRedirectBooking,
  confirmBooking,
  type PaymentIntentResponse,
  type RedirectBookingResponse,
} from "../../src/lib/api";
import { formatPrice, formatTime, formatDate } from "../../src/lib/format";

const PLATFORM_LABELS: Record<string, string> = {
  playtomic: "Playtomic",
  reclub: "Reclub",
  matchi: "MATCHi",
  book_and_go: "Book & Go",
  padel_mates: "Padel Mates",
  padel_society: "Padel Society",
  club_direct: "Venue Website",
};

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

type BookingPhase =
  | "loading"
  | "summary"
  | "processing"
  | "success"
  | "failure"
  | "redirect_confirm";

export default function BookingPaymentScreen() {
  const { slotId, mode } = useLocalSearchParams<{
    slotId: string;
    mode?: "redirect" | "payment";
  }>();
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<BookingPhase>("loading");
  const [paymentData, setPaymentData] =
    useState<PaymentIntentResponse | null>(null);
  const [redirectData, setRedirectData] =
    useState<RedirectBookingResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calendarAdded, setCalendarAdded] = useState(false);

  const isRedirectFlow = mode === "redirect";

  // --- Payment flow: create payment intent ---
  const paymentIntentMutation = useMutation({
    mutationFn: async () => {
      if (!slotId) throw new Error("No slot selected");
      return createPaymentIntent(slotId);
    },
    onSuccess: (data) => {
      setPaymentData(data);
      setPhase("summary");
    },
    onError: (err) => {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load booking details",
      );
      setPhase("failure");
    },
  });

  // --- Redirect flow: create redirect booking ---
  const redirectMutation = useMutation({
    mutationFn: async () => {
      if (!slotId) throw new Error("No slot selected");
      return createRedirectBooking(slotId);
    },
    onSuccess: async (data) => {
      setRedirectData(data);
      if (data.bookingUrl) {
        await Linking.openURL(data.bookingUrl);
      }
      setPhase("redirect_confirm");
    },
    onError: (err) => {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to create booking",
      );
      setPhase("failure");
    },
  });

  // --- Payment confirmation ---
  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!paymentData) throw new Error("No payment data");
      // In production, the Stripe payment sheet handles the actual payment.
      // This confirms the booking on our backend after Stripe succeeds.
      return confirmPayment(
        paymentData.booking.id,
        paymentData.paymentIntentId,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setPhase("success");
    },
    onError: (err) => {
      setErrorMessage(
        err instanceof Error ? err.message : "Payment failed",
      );
      setPhase("failure");
    },
  });

  // --- Redirect confirmation ---
  const confirmRedirectMutation = useMutation({
    mutationFn: async (status: "confirmed" | "cancelled") => {
      if (!redirectData) throw new Error("No booking data");
      return confirmBooking(redirectData.booking.id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      router.back();
    },
  });

  // --- Initialize on mount ---
  const initializeMutation = useMutation({
    mutationFn: async () => {
      if (isRedirectFlow) {
        return redirectMutation.mutateAsync();
      } else {
        return paymentIntentMutation.mutateAsync();
      }
    },
  });

  // Start loading on first render
  if (phase === "loading" && !initializeMutation.isPending && !initializeMutation.isSuccess && !initializeMutation.isError) {
    initializeMutation.mutate();
  }

  // --- Handle Stripe payment ---
  const handlePay = useCallback(async () => {
    if (!paymentData) return;
    setPhase("processing");

    try {
      // TODO: When @stripe/stripe-react-native is integrated, use:
      // const { error } = await presentPaymentSheet();
      // if (error) { throw new Error(error.message); }
      //
      // For now, simulate Stripe payment sheet success and confirm on backend.
      await confirmPaymentMutation.mutateAsync();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Payment could not be processed",
      );
      setPhase("failure");
    }
  }, [paymentData, confirmPaymentMutation]);

  // --- Add to calendar ---
  const handleAddToCalendar = useCallback(async () => {
    const slot = paymentData?.slot ?? redirectData?.slot;
    const venue = paymentData?.venue ?? redirectData?.venue;
    if (!slot || !venue) return;

    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Calendar Access",
          "Please enable calendar access in Settings to add this booking.",
        );
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(
        Calendar.EntityTypes.EVENT,
      );
      const defaultCalendar =
        Platform.OS === "ios"
          ? calendars.find((cal: Calendar.Calendar) => cal.allowsModifications && cal.source?.name === "Default")
          : calendars.find((cal: Calendar.Calendar) => cal.allowsModifications);
      const calendarId = defaultCalendar?.id ?? calendars[0]?.id;
      if (!calendarId) return;

      await Calendar.createEventAsync(calendarId, {
        title: `Padel @ ${venue.name}`,
        startDate: new Date(slot.startsAt),
        endDate: new Date(slot.endsAt),
        location: "address" in venue ? (venue as { address: string }).address : venue.name,
        notes: "Booked via CourtIQ",
        timeZone: "Asia/Bangkok",
      });

      setCalendarAdded(true);
    } catch {
      Alert.alert("Error", "Could not add event to calendar.");
    }
  }, [paymentData, redirectData]);

  // ========== RENDER ==========

  // --- Loading ---
  if (phase === "loading") {
    return (
      <SafeAreaView
        className="flex-1 bg-slate-50 items-center justify-center"
        edges={["bottom"]}
      >
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-sm text-gray-500 mt-3">
          {t("common.loading")}
        </Text>
      </SafeAreaView>
    );
  }

  // --- Booking Summary ---
  if (phase === "summary" && paymentData) {
    const { slot, court, venue, breakdown } = paymentData;
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={["bottom"]}>
        <ScrollView className="flex-1 px-5 pt-4">
          <Animated.View entering={FadeInUp.duration(400)}>
            {/* Venue & Court */}
            <Card variant="elevated">
              <View className="items-center mb-4">
                <View className="w-14 h-14 rounded-full bg-brand-100 items-center justify-center mb-3">
                  <BallIcon size={28} color="#2563EB" />
                </View>
                <Text className="text-xl font-bold text-gray-900">
                  {t("booking.confirm")}
                </Text>
              </View>

              <View className="bg-gray-50 rounded-xl p-4 gap-3">
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Venue</Text>
                  <Text className="text-sm font-semibold text-gray-900 text-right flex-shrink ml-4">
                    {venue.name}
                  </Text>
                </View>
                {venue.address ? (
                  <View className="flex-row justify-between items-center">
                    <Text className="text-sm text-gray-500">Address</Text>
                    <Text className="text-xs text-gray-500 text-right flex-shrink ml-4">
                      {venue.address}
                    </Text>
                  </View>
                ) : null}
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Court</Text>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm font-medium text-gray-900">
                      {court.name}
                    </Text>
                    <SurfaceBadge surface={court.surface as any} />
                  </View>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Date</Text>
                  <Text className="text-sm font-medium text-gray-900">
                    {formatDate(slot.startsAt)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Time</Text>
                  <Text className="text-sm font-medium text-gray-900">
                    {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Price Breakdown */}
            <Card variant="elevated" className="mt-3">
              <Text className="text-base font-semibold text-gray-900 mb-3">
                Price Breakdown
              </Text>
              <View className="gap-2.5">
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Court rental</Text>
                  <Text className="text-sm text-gray-900">
                    {formatPrice(breakdown.subtotalCents, breakdown.currency)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">
                    Service fee ({(breakdown.commissionRate * 100).toFixed(0)}%)
                  </Text>
                  <Text className="text-sm text-gray-900">
                    {formatPrice(
                      breakdown.commissionCents,
                      breakdown.currency,
                    )}
                  </Text>
                </View>
                <View className="h-px bg-gray-100 my-1" />
                <View className="flex-row justify-between items-center">
                  <Text className="text-base font-bold text-gray-900">
                    Total
                  </Text>
                  <Text className="text-lg font-bold text-brand-600">
                    {formatPrice(breakdown.totalCents, breakdown.currency)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Secure payment notice */}
            <View className="flex-row items-center justify-center mt-4 gap-1.5">
              <Ionicons name="lock-closed" size={14} color="#6B7280" />
              <Text className="text-xs text-gray-500">
                Secured by Stripe. Your card details are never stored.
              </Text>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Bottom CTA */}
        <View className="px-5 pb-4 pt-3 border-t border-gray-100 bg-white">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handlePay}
          >
            {`Pay ${formatPrice(breakdown.totalCents, breakdown.currency)}`}
          </Button>
          <Pressable
            className="py-3 items-center mt-1"
            onPress={() => router.back()}
          >
            <Text className="text-gray-500 font-medium">
              {t("common.cancel")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --- Processing ---
  if (phase === "processing") {
    return (
      <SafeAreaView
        className="flex-1 bg-slate-50 items-center justify-center"
        edges={["bottom"]}
      >
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="items-center px-8"
        >
          <View className="w-20 h-20 rounded-full bg-brand-100 items-center justify-center mb-5">
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
          <Text className="text-xl font-bold text-gray-900 text-center">
            Processing Payment
          </Text>
          <Text className="text-sm text-gray-500 mt-2 text-center">
            Please wait while we confirm your booking...
          </Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // --- Success ---
  if (phase === "success") {
    const slot = paymentData?.slot;
    const venue = paymentData?.venue;
    const court = paymentData?.court;
    const breakdown = paymentData?.breakdown;

    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={["bottom"]}>
        <ScrollView className="flex-1 px-5 pt-6">
          <Animated.View
            entering={FadeInUp.duration(500)}
            className="items-center"
          >
            {/* Success icon */}
            <View className="w-20 h-20 rounded-full bg-emerald-100 items-center justify-center mb-4">
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 text-center">
              Booking Confirmed!
            </Text>
            <Text className="text-sm text-gray-500 mt-1 text-center">
              Your court is reserved. See you on the court!
            </Text>
          </Animated.View>

          {/* Receipt card */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <Card variant="elevated" className="mt-6">
              <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Receipt
              </Text>
              <View className="gap-2.5">
                {venue && (
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-gray-500">Venue</Text>
                    <Text className="text-sm font-medium text-gray-900">
                      {venue.name}
                    </Text>
                  </View>
                )}
                {court && (
                  <View className="flex-row justify-between items-center">
                    <Text className="text-sm text-gray-500">Court</Text>
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-sm font-medium text-gray-900">
                        {court.name}
                      </Text>
                      <SurfaceBadge surface={court.surface as any} />
                    </View>
                  </View>
                )}
                {slot && (
                  <>
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-gray-500">Date</Text>
                      <Text className="text-sm font-medium text-gray-900">
                        {formatDate(slot.startsAt)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-gray-500">Time</Text>
                      <Text className="text-sm font-medium text-gray-900">
                        {formatTime(slot.startsAt)} –{" "}
                        {formatTime(slot.endsAt)}
                      </Text>
                    </View>
                  </>
                )}
                {breakdown && (
                  <>
                    <View className="h-px bg-gray-100 my-1" />
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-gray-500">
                        Court rental
                      </Text>
                      <Text className="text-sm text-gray-900">
                        {formatPrice(
                          breakdown.subtotalCents,
                          breakdown.currency,
                        )}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-gray-500">
                        Service fee
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
                        Total paid
                      </Text>
                      <Text className="text-base font-bold text-brand-600">
                        {formatPrice(
                          breakdown.totalCents,
                          breakdown.currency,
                        )}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </Card>
          </Animated.View>

          {/* Actions */}
          <Animated.View
            entering={FadeInUp.delay(350).duration(400)}
            className="mt-4 gap-3"
          >
            <Pressable
              className={`flex-row items-center justify-center py-3.5 rounded-xl border ${
                calendarAdded
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-white border-gray-200"
              }`}
              onPress={handleAddToCalendar}
              disabled={calendarAdded}
            >
              <Ionicons
                name={calendarAdded ? "checkmark-circle" : "calendar-outline"}
                size={20}
                color={calendarAdded ? "#10B981" : "#2563EB"}
              />
              <Text
                className={`ml-2 font-medium text-sm ${
                  calendarAdded ? "text-emerald-600" : "text-brand-600"
                }`}
              >
                {calendarAdded ? "Added to Calendar" : "Add to Calendar"}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>

        <View className="px-5 pb-4 pt-3 border-t border-gray-100 bg-white">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => {
              queryClient.invalidateQueries({ queryKey: ["bookings"] });
              router.dismiss();
            }}
          >
            Done
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // --- Failure ---
  if (phase === "failure") {
    return (
      <SafeAreaView
        className="flex-1 bg-slate-50 items-center justify-center"
        edges={["bottom"]}
      >
        <Animated.View
          entering={FadeInUp.duration(400)}
          className="items-center px-8"
        >
          <View className="w-20 h-20 rounded-full bg-red-100 items-center justify-center mb-5">
            <Ionicons name="close-circle" size={48} color="#EF4444" />
          </View>
          <Text className="text-xl font-bold text-gray-900 text-center">
            Payment Failed
          </Text>
          <Text className="text-sm text-gray-500 mt-2 text-center leading-5">
            {errorMessage ?? "Something went wrong. Please try again."}
          </Text>

          <View className="w-full gap-3 mt-8">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => {
                setErrorMessage(null);
                setPhase("loading");
                initializeMutation.reset();
                paymentIntentMutation.reset();
              }}
            >
              Try Again
            </Button>
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              onPress={() => router.back()}
            >
              Go Back
            </Button>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // --- Redirect Confirm (legacy external platform flow) ---
  if (phase === "redirect_confirm" && redirectData) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={["bottom"]}>
        <View className="flex-1 px-5 pt-6">
          <Animated.View entering={FadeInUp.duration(400)}>
            <Card variant="elevated">
              <View className="items-center mb-5">
                <View className="w-14 h-14 rounded-full bg-emerald-100 items-center justify-center mb-3">
                  <BallIcon size={28} color="#10B981" />
                </View>
                <Text className="text-xl font-bold text-gray-900">
                  Did you complete your booking?
                </Text>
              </View>

              <View className="bg-gray-50 rounded-xl p-4 mb-4 gap-2.5">
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Venue</Text>
                  <Text className="text-sm font-medium text-gray-900">
                    {redirectData.venue.name}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Court</Text>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm font-medium text-gray-900">
                      {redirectData.court.name}
                    </Text>
                    <SurfaceBadge
                      surface={redirectData.court.surface as any}
                    />
                  </View>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Date</Text>
                  <Text className="text-sm font-medium text-gray-900">
                    {formatDate(redirectData.slot.startsAt)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Time</Text>
                  <Text className="text-sm font-medium text-gray-900">
                    {formatTime(redirectData.slot.startsAt)} –{" "}
                    {formatTime(redirectData.slot.endsAt)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Price</Text>
                  <Text className="text-base font-bold text-brand-600">
                    {formatPrice(
                      redirectData.slot.priceCents,
                      redirectData.slot.currency,
                    )}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-gray-500">Platform</Text>
                  <Badge variant="brand">
                    {platformLabel(redirectData.venue.sourcePlatform)}
                  </Badge>
                </View>
              </View>

              <View className="gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={
                    confirmRedirectMutation.isPending &&
                    confirmRedirectMutation.variables === "confirmed"
                  }
                  onPress={() => confirmRedirectMutation.mutate("confirmed")}
                >
                  Yes, I booked it
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  fullWidth
                  loading={
                    confirmRedirectMutation.isPending &&
                    confirmRedirectMutation.variables === "cancelled"
                  }
                  onPress={() => confirmRedirectMutation.mutate("cancelled")}
                >
                  No, I didn't book
                </Button>
              </View>
            </Card>

            {redirectData.bookingUrl && (
              <Pressable
                className="mt-4 py-3 items-center"
                onPress={() => {
                  if (redirectData.bookingUrl) {
                    Linking.openURL(redirectData.bookingUrl);
                  }
                }}
              >
                <Text className="text-brand-600 font-medium text-sm">
                  Open{" "}
                  {platformLabel(redirectData.venue.sourcePlatform)} again
                </Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // Fallback — should not reach here
  return (
    <SafeAreaView
      className="flex-1 bg-slate-50 items-center justify-center"
      edges={["bottom"]}
    >
      <ActivityIndicator size="large" color="#2563EB" />
    </SafeAreaView>
  );
}
