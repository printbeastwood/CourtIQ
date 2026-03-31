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

// ---- Venue Claim ----

export function useClaimVenue() {
  return useMutation({
    mutationFn: (data: { venueId: string; verificationCode: string }) =>
      api.post<{ success: boolean }>("/venue-claims", data),
  });
}
