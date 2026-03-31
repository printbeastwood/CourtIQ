export type SurfaceType = "glass" | "panoramic" | "concrete" | "turf";
export type SlotStatus = "available" | "held" | "booked";
export type Currency = "THB" | "USD" | "EUR";
export type Platform = "playtomic" | "reclub" | "book_and_go" | "matchi" | "padel_mates" | "padel_society" | "club_direct";

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

// Rating System types

export type MatchFormat = "singles" | "doubles";

export interface Match {
  id?: string;
  courtId?: string;
  format: MatchFormat;
  player1Id: string;
  player2Id: string;
  player1Score?: number;
  player2Score?: number;
  winnerId?: string;
  playedAt: Date;
  reportedById: string;
  confirmed: boolean;
  createdAt?: Date;
}

export interface PlayerRating {
  id?: string;
  playerId: string;
  format: MatchFormat;
  rating: number;
  rd: number;
  volatility: number;
  gamesPlayed: number;
  lastMatchAt?: Date;
  updatedAt?: Date;
}

export interface RatingHistoryEntry {
  id?: string;
  playerId: string;
  matchId: string;
  format: MatchFormat;
  ratingBefore: number;
  ratingAfter: number;
  rdBefore: number;
  rdAfter: number;
  opponentId: string;
  opponentRating: number;
  result: number;
  createdAt?: Date;
}

export interface PlayerRatingResponse {
  rating: PlayerRating;
  confidence: number; // 0-1 based on RD
}

export interface MatchResultInput {
  opponentId: string;
  format: MatchFormat;
  player1Score: number;
  player2Score: number;
  playedAt: string;
  courtId?: string;
}

export interface MatchWithPlayers {
  match: Match;
  player1: { id: string; displayName?: string };
  player2: { id: string; displayName?: string };
  ratingChange?: number;
}

// Post-match feedback types

export type Satisfaction = "great" | "okay" | "poor";
export type IssueCategory = "court_quality" | "opponent_level" | "time" | "location";
export type OpponentSkillRating = "too_easy" | "about_right" | "too_hard";

export interface MatchFeedback {
  id?: string;
  matchId?: string;
  bookingId?: string;
  playerId: string;
  satisfaction: Satisfaction;
  freeText?: string;
  issueCategories: IssueCategory[];
  opponentSkillRating?: OpponentSkillRating;
  opponentId?: string;
  preferenceExtracted: boolean;
  createdAt?: Date;
}

export interface MatchFeedbackInput {
  matchId?: string;
  bookingId?: string;
  satisfaction: Satisfaction;
  freeText?: string;
  issueCategories?: IssueCategory[];
  opponentSkillRating?: OpponentSkillRating;
  opponentId?: string;
}

export interface FeedbackStats {
  total: number;
  great: number;
  okay: number;
  poor: number;
  satisfactionRate: number; // percentage of "great" ratings
}
