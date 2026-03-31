export type SurfaceType = "glass" | "panoramic" | "concrete" | "turf";
export type SlotStatus = "available" | "held" | "booked";
export type Currency = "THB" | "USD" | "EUR";
export type Platform = "playtomic" | "reclub" | "book_and_go" | "club_direct";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Venue {
  id?: string;
  name: string;
  slug: string;
  location: Coordinates;
  address: string;
  amenities: string[];
  sourcePlatform: Platform;
  sourceId: string;
  metadata: Record<string, unknown>;
}

export interface Court {
  id?: string;
  venueId: string;
  name: string;
  surface: SurfaceType;
  indoor: boolean;
  metadata: Record<string, unknown>;
}

export interface Slot {
  id?: string;
  courtId: string;
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
  currency: Currency;
  status: SlotStatus;
  sourceBookingUrl: string;
  fetchedAt: Date;
}

export interface Region {
  center: Coordinates;
  radiusKm: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface AdapterHealth {
  platform: Platform;
  healthy: boolean;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  successRate: number;
}

export interface SlotSearchParams {
  region?: Region;
  date?: DateRange;
  surface?: SurfaceType[];
  indoor?: boolean;
  minPrice?: number;
  maxPrice?: number;
  venueId?: string;
}

export interface SlotSearchResult {
  venue: Venue;
  court: Court;
  slot: Slot;
  stalenessMinutes: number;
}

// Preference Store types

export type PreferenceCategory =
  | "play_style"
  | "skill_level"
  | "competitive_intent"
  | "time"
  | "location"
  | "court_surface"
  | "group_size"
  | "coaching";

export interface User {
  id?: string;
  phone: string;
  firebaseUid?: string;
  displayName?: string;
  skillLevel?: string;
  createdAt?: Date;
}

export interface Preference {
  id?: string;
  userId: string;
  category: PreferenceCategory;
  text: string;
  embedding?: number[];
  active: boolean;
  createdAt?: Date;
}

export interface PreferenceInput {
  text: string;
  category?: PreferenceCategory;
}

export interface PreferenceMatch {
  preference: Preference;
  similarity: number;
}

export interface PreferenceContext {
  userId: string;
  preferences: PreferenceMatch[];
  structured: Partial<Record<PreferenceCategory, string[]>>;
}
