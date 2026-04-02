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

// Scheduled match types

export type MatchStatus = "upcoming" | "active" | "completed" | "cancelled";
export type MatchPlayerRole = "host" | "guest";
export type RsvpStatus = "pending" | "accepted" | "declined";

export interface MatchPlayer {
  id?: string;
  matchId: string;
  userId: string;
  role: MatchPlayerRole;
  rsvpStatus: RsvpStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateMatchInput {
  format: MatchFormat;
  scheduledAt: string;
  courtId?: string;
  bookingId?: string;
  notes?: string;
  invitees?: string[]; // userIds to invite
}

export interface InvitePlayersInput {
  userIds: string[];
}

export interface UpdateMatchInput {
  status?: MatchStatus;
  scheduledAt?: string;
  notes?: string;
  player1Score?: number;
  player2Score?: number;
}

export interface ScheduledMatchDetail {
  id: string;
  format: MatchFormat;
  status: MatchStatus;
  scheduledAt: string;
  notes?: string;
  createdByUserId: string;
  court?: { id: string; name: string; surface: string; indoor: boolean };
  venue?: { id: string; name: string; address: string };
  players: Array<{
    userId: string;
    displayName: string | null;
    avatarUrl?: string | null;
    role: MatchPlayerRole;
    rsvpStatus: RsvpStatus;
  }>;
  createdAt: string;
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

// Player social types

export type ConnectionStatus = "pending" | "accepted" | "blocked";
export type PlayFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "occasional";

export interface PlayerProfile {
  id?: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  preferredLocations: string[];
  playFrequency?: PlayFrequency;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Connection {
  id?: string;
  userId: string;
  friendId: string;
  status: ConnectionStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlayerProfileInput {
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  preferredLocations?: string[];
  playFrequency?: PlayFrequency;
}

export interface DiscoveredPlayer {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  playFrequency?: PlayFrequency;
  rating?: number;
  gamesPlayed?: number;
  confidence?: number;
  connectionStatus?: ConnectionStatus | null;
}

export interface ConnectionWithProfile {
  connection: Connection;
  profile: DiscoveredPlayer;
}

// Push Notification types

export type NotificationType = "post_match_feedback" | "booking_reminder" | "match_invite" | "system";
export type NotificationStatus = "pending" | "sent" | "failed" | "cancelled";
export type DevicePlatform = "ios" | "android";

export interface DeviceToken {
  id?: string;
  userId: string;
  token: string;
  platform: DevicePlatform;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Notification {
  id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: NotificationStatus;
  scheduledFor?: Date;
  sentAt?: Date;
  errorMessage?: string;
  createdAt?: Date;
}

export interface ScheduleNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sendAt?: Date; // If omitted, sends immediately
}

export interface RegisterDeviceInput {
  token: string;
  platform: DevicePlatform;
}

// ─── Player data migration types ────────────────────────────────────────────

export type MigrationPlatform = "playtomic" | "matchi" | "reclub" | "padel_mates";

export type ImportJobStatus = "pending" | "running" | "completed" | "failed";

export interface ImportJob {
  id: string;
  userId: string;
  platform: MigrationPlatform;
  status: ImportJobStatus;
  progress: number;
  matchesImported: number;
  bookingsImported: number;
  connectionsImported: number;
  preferencesSeeded: number;
  errorMessage?: string;
  summary?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface ImportedMatch {
  platformMatchId?: string;
  playedAt: Date;
  venueName?: string;
  courtName?: string;
  format?: "singles" | "doubles" | "americano";
  result?: "won" | "lost" | "draw";
  score?: string;
  partnerNames: string[];
  opponentNames: string[];
  durationMinutes?: number;
  metadata: Record<string, unknown>;
}

export interface ImportedConnection {
  platformUserId?: string;
  displayName: string;
  skillLevel?: string;
  metadata: Record<string, unknown>;
}

export interface ImportedBooking {
  bookedAt: Date;
  venueName: string;
  courtName?: string;
  timeSlot: string; // e.g. "18:00-19:30"
  pricePaid?: number;
  currency?: string;
  metadata: Record<string, unknown>;
}

export interface ImportedPlayerProfile {
  displayName?: string;
  rating?: number;
  ratingSystem?: string; // e.g. "playtomic_level", "matchi_rating"
  preferredHand?: "left" | "right";
  preferredPosition?: "left" | "right" | "both";
  avatarUrl?: string;
  memberSince?: Date;
  metadata: Record<string, unknown>;
}

export interface MigrationData {
  profile?: ImportedPlayerProfile;
  matches: ImportedMatch[];
  bookings: ImportedBooking[];
  connections: ImportedConnection[];
}

export interface MigrationCredentials {
  platform: MigrationPlatform;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  cookies?: Record<string, string>;
}

// ─── Reflink / referral system types ────────────────────────────────────────

export type ReflinkTier = "player" | "influencer" | "venue" | "coach";
export type ReflinkRewardType = "commission" | "credit";
export type ReferralStatus = "signed_up" | "first_booking" | "qualified" | "expired";
export type PayoutStatus = "pending" | "approved" | "paid" | "cancelled";
export type PayoutType = "commission" | "credit" | "bonus";

export interface Reflink {
  id: string;
  userId: string;
  code: string;
  tier: ReflinkTier;
  commissionRate: number;
  rewardType: ReflinkRewardType;
  rewardConfig: Record<string, unknown>;
  attributionWindowDays: number;
  active: boolean;
  clicks: number;
  expiresAt?: Date;
  createdAt: Date;
}

export interface Referral {
  id: string;
  reflinkId: string;
  referrerId: string;
  referredUserId: string;
  status: ReferralStatus;
  attributedAt: Date;
  qualifiedAt?: Date;
  bookingCount: number;
  createdAt: Date;
}

export interface ReferralPayout {
  id: string;
  referrerId: string;
  reflinkId: string;
  referralId?: string;
  bookingId?: string;
  type: PayoutType;
  amountCents: number;
  currency: string;
  status: PayoutStatus;
  description?: string;
  paidAt?: Date;
  createdAt: Date;
}

export interface ReflinkDashboard {
  reflink: Reflink;
  totalClicks: number;
  totalSignups: number;
  totalQualified: number;
  totalEarningsCents: number;
  pendingPayoutCents: number;
  recentReferrals: Referral[];
  recentPayouts: ReferralPayout[];
}

/** Default commission rates and reward config per tier */
export const REFLINK_TIER_DEFAULTS: Record<
  ReflinkTier,
  { commissionRate: number; rewardType: ReflinkRewardType; rewardConfig: Record<string, unknown> }
> = {
  player: {
    commissionRate: 0,
    rewardType: "credit",
    rewardConfig: { creditAmountCents: 50000, creditCurrency: "THB", requiredReferralBookings: 3 },
  },
  influencer: {
    commissionRate: 0.05,
    rewardType: "commission",
    rewardConfig: { durationMonths: 12 },
  },
  venue: {
    commissionRate: 0.01,
    rewardType: "commission",
    rewardConfig: { appliesTo: "all_courtiq_bookings" },
  },
  coach: {
    commissionRate: 0.02,
    rewardType: "commission",
    rewardConfig: { appliesTo: "referred_player_bookings" },
  },
};
