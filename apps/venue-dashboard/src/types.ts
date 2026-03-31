// Re-export shared types and add dashboard-specific types

export type SurfaceType = "glass" | "panoramic" | "concrete" | "turf";
export type SlotStatus = "available" | "held" | "booked";
export type Currency = "THB" | "USD" | "EUR";

export interface Venue {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  address: string | null;
  amenities: string[];
  sourcePlatform: string;
  sourceId: string;
  metadata: Record<string, unknown>;
  courts?: Court[];
}

export interface Court {
  id: string;
  venueId: string;
  name: string;
  surface: SurfaceType;
  indoor: boolean;
  metadata: Record<string, unknown>;
}

export interface Slot {
  id: string;
  courtId: string;
  startsAt: string;
  endsAt: string;
  priceCents: number | null;
  currency: Currency;
  status: SlotStatus;
  sourceBookingUrl: string | null;
  fetchedAt: string;
  court?: Court;
  stalenessMinutes?: number;
}
