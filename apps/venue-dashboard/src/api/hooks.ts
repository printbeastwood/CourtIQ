import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Venue, Slot } from "../types";

// ---- Venue ----

export function useVenue(venueId: string | undefined) {
  return useQuery({
    queryKey: ["venue", venueId],
    queryFn: () =>
      api.get<{ venue: Venue; courts: Venue["courts"] }>(`/venues/${venueId}`),
    enabled: !!venueId,
  });
}

export function useUpdateVenue(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Venue>) =>
      api.patch<Venue>(`/venues/${venueId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", venueId] }),
  });
}

// ---- Slots / Availability ----

export function useVenueSlots(venueId: string | undefined) {
  return useQuery({
    queryKey: ["venue-slots", venueId],
    queryFn: () => api.get<{ slots: Slot[] }>(`/venues/${venueId}/slots`),
    enabled: !!venueId,
  });
}

// ---- Analytics (mock endpoint for v1) ----

interface AnalyticsData {
  totalBookings: number;
  revenue: number;
  popularSlots: { hour: number; count: number }[];
  weeklyBookings: { week: string; count: number }[];
}

export function useVenueAnalytics(venueId: string | undefined) {
  return useQuery({
    queryKey: ["venue-analytics", venueId],
    queryFn: () => api.get<AnalyticsData>(`/venues/${venueId}/analytics`),
    enabled: !!venueId,
    // Analytics endpoint may not exist yet — provide defaults
    placeholderData: {
      totalBookings: 0,
      revenue: 0,
      popularSlots: [],
      weeklyBookings: [],
    },
  });
}

// ---- Promotions ----

export interface Promotion {
  id: string;
  venueId: string;
  title: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export function usePromotions(venueId: string | undefined) {
  return useQuery({
    queryKey: ["promotions", venueId],
    queryFn: () =>
      api.get<{ promotions: Promotion[] }>(`/venues/${venueId}/promotions`),
    enabled: !!venueId,
    placeholderData: { promotions: [] },
  });
}

export function useCreatePromotion(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Promotion, "id" | "venueId">) =>
      api.post<Promotion>(`/venues/${venueId}/promotions`, data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["promotions", venueId] }),
  });
}

// ---- Bookings (venue-side) ----

export interface VenueBooking {
  id: string;
  startsAt: string;
  endsAt: string;
  courtName: string | null;
  playerName: string | null;
  priceCents: number | null;
  status: string;
  bookingMethod: string | null;
}

export function useVenueBookings(venueId: string | undefined) {
  return useQuery({
    queryKey: ["venue-bookings", venueId],
    queryFn: () =>
      api.get<{ bookings: VenueBooking[] }>(`/venues/${venueId}/bookings`),
    enabled: !!venueId,
    placeholderData: { bookings: [] },
  });
}

// ---- Payouts ----

export interface Payout {
  id: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  bookingCount: number;
  status: string;
}

export function useVenuePayouts(venueId: string | undefined) {
  return useQuery({
    queryKey: ["venue-payouts", venueId],
    queryFn: () =>
      api.get<{
        payouts: Payout[];
        stripeConnected: boolean;
        pendingBalance: number;
        totalPaid: number;
        commissionRate: number;
      }>(`/venues/${venueId}/payouts`),
    enabled: !!venueId,
    placeholderData: {
      payouts: [],
      stripeConnected: false,
      pendingBalance: 0,
      totalPaid: 0,
      commissionRate: 10,
    },
  });
}

// ---- Stripe Connect ----

export interface StripeAccountStatus {
  connected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  dashboardUrl: string | null;
  requirements: string[];
}

export function useStripeAccountStatus(venueId: string | undefined) {
  return useQuery({
    queryKey: ["stripe-account", venueId],
    queryFn: () =>
      api.get<StripeAccountStatus>(`/venues/${venueId}/stripe/status`),
    enabled: !!venueId,
    placeholderData: {
      connected: false,
      accountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      dashboardUrl: null,
      requirements: [],
    },
  });
}

export function useStripeOnboardingUrl(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ url: string }>(`/venues/${venueId}/stripe/onboard`, {}),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["stripe-account", venueId] }),
  });
}

export function useStripeDisconnect(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ success: boolean }>(`/venues/${venueId}/stripe/disconnect`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stripe-account", venueId] });
      qc.invalidateQueries({ queryKey: ["venue-payouts", venueId] });
    },
  });
}

// ---- Venue Claim ----

export function useClaimVenue() {
  return useMutation({
    mutationFn: (data: { venueId: string; verificationCode: string }) =>
      api.post<{ success: boolean }>("/venue-claims", data),
  });
}
