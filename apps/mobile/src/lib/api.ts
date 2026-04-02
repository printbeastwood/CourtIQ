import { config } from "../config";
import { useAuthStore } from "../stores/auth";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${config.apiUrl}${path}`, {
    ...options,
    headers,
  });

  // On 401, attempt a single token refresh and retry
  if (res.status === 401 && token) {
    const newToken = await useAuthStore.getState().refreshToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      const retry = await fetch(`${config.apiUrl}${path}`, {
        ...options,
        headers,
      });
      if (retry.ok) return retry.json() as Promise<T>;
      const retryBody = await retry.text();
      throw new Error(`API ${retry.status}: ${retryBody}`);
    }
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// --- Venues ---

export interface VenueListResponse {
  venues: Array<{
    id: string;
    name: string;
    slug: string;
    lat: number;
    lng: number;
    address: string;
    amenities: string[];
    sourcePlatform: string;
    courtCount?: number;
    distance_km?: number;
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface VenueDetailResponse {
  venue: {
    id: string;
    name: string;
    slug: string;
    lat: number;
    lng: number;
    address: string;
    amenities: string[];
    sourcePlatform: string;
    courts: Array<{
      id: string;
      name: string;
      surface: string;
      indoor: boolean;
    }>;
  };
}

export interface SlotSearchResponse {
  results: Array<{
    venue: { id: string; name: string; slug: string; address: string; lat: number; lng: number };
    court: { id: string; name: string; surface: string; indoor: boolean };
    slot: {
      id: string;
      startsAt: string;
      endsAt: string;
      priceCents: number;
      currency: string;
      status: string;
      sourceBookingUrl: string;
    };
    stalenessMinutes: number;
  }>;
  total: number;
  page: number;
  limit: number;
}

export function fetchVenues(params: {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null) qs.set(k, String(v));
  }
  return api.get<VenueListResponse>(`/venues?${qs}`);
}

export function fetchVenueDetail(venueId: string) {
  return api.get<VenueDetailResponse>(`/venues/${venueId}`);
}

export function searchSlots(params: {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  dateFrom?: string;
  dateTo?: string;
  surface?: string[];
  indoor?: boolean;
  minPrice?: number;
  maxPrice?: number;
  venueId?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      v.forEach((item) => qs.append(k, item));
    } else {
      qs.set(k, String(v));
    }
  }
  return api.get<SlotSearchResponse>(`/slots/search?${qs}`);
}

export function fetchVenueSlots(venueId: string, date?: string) {
  const qs = date ? `?date=${date}` : "";
  return api.get<{ slots: SlotSearchResponse["results"] }>(
    `/venues/${venueId}/slots${qs}`,
  );
}

// --- Preferences ---

export function storePreferences(
  userId: string,
  preferences: Array<{ text: string; category?: string }>,
) {
  return api.post("/preferences", { userId, preferences });
}

export function getUserPreferences(userId: string) {
  return api.get<{
    preferences: Array<{
      id: string;
      category: string;
      text: string;
      active: boolean;
    }>;
  }>(`/users/${userId}/preferences`);
}

export function deletePreference(userId: string, prefId: string) {
  return api.delete(`/users/${userId}/preferences/${prefId}`);
}

// --- Bookings ---

export interface RedirectBookingResponse {
  booking: {
    id: string;
    status: string;
    bookingMethod: string;
    createdAt: string;
  };
  bookingUrl: string;
  slot: {
    id: string;
    startsAt: string;
    endsAt: string;
    priceCents: number;
    currency: string;
  };
  court: {
    id: string;
    name: string;
    surface: string;
    indoor: boolean;
  };
  venue: {
    id: string;
    name: string;
    sourcePlatform: string;
  };
}

export interface BookingListItem {
  id: string;
  status: "pending" | "confirmed" | "cancelled";
  bookingMethod: string;
  createdAt: string;
  slot: {
    startsAt: string;
    endsAt: string;
    priceCents: number;
    currency: string;
    sourceBookingUrl: string;
  };
  venue: {
    id: string;
    name: string;
    sourcePlatform: string;
  };
  court: {
    id: string;
    name: string;
    surface: string;
    indoor: boolean;
  };
}

export function createRedirectBooking(slotId: string) {
  return api.post<RedirectBookingResponse>("/bookings/redirect", { slotId });
}

export function confirmBooking(bookingId: string, status: "confirmed" | "cancelled") {
  return api.patch<{ booking: { id: string; status: string } }>(
    `/bookings/${bookingId}/confirm`,
    { status },
  );
}

export function fetchBookings() {
  return api.get<{ bookings: BookingListItem[] }>("/bookings");
}

export function fetchBookingDetail(bookingId: string) {
  return api.get<{ booking: BookingDetail }>(`/bookings/${bookingId}`);
}

// --- Payments (Stripe) ---

export interface PaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  ephemeralKey: string;
  customerId: string;
  booking: {
    id: string;
    status: string;
    createdAt: string;
  };
  slot: {
    id: string;
    startsAt: string;
    endsAt: string;
    priceCents: number;
    currency: string;
  };
  court: {
    id: string;
    name: string;
    surface: string;
    indoor: boolean;
  };
  venue: {
    id: string;
    name: string;
    address: string;
    sourcePlatform: string;
  };
  breakdown: {
    subtotalCents: number;
    commissionCents: number;
    commissionRate: number;
    totalCents: number;
    currency: string;
  };
}

export interface BookingDetail {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "payment_failed";
  bookingMethod: "direct" | "redirect" | "concierge";
  paymentStatus: "pending" | "succeeded" | "failed" | "refunded" | null;
  paymentIntentId: string | null;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  slot: {
    startsAt: string;
    endsAt: string;
    priceCents: number;
    currency: string;
    sourceBookingUrl: string;
  };
  venue: {
    id: string;
    name: string;
    address: string;
    sourcePlatform: string;
  };
  court: {
    id: string;
    name: string;
    surface: string;
    indoor: boolean;
  };
  breakdown: {
    subtotalCents: number;
    commissionCents: number;
    commissionRate: number;
    totalCents: number;
    currency: string;
  } | null;
  cancellation: {
    refundStatus: "pending" | "processed" | "denied" | null;
    refundAmountCents: number | null;
    reason: string | null;
  } | null;
}

export function createPaymentIntent(slotId: string) {
  return api.post<PaymentIntentResponse>("/bookings/payment-intent", { slotId });
}

export function confirmPayment(bookingId: string, paymentIntentId: string) {
  return api.post<{ booking: { id: string; status: string; confirmedAt: string } }>(
    `/bookings/${bookingId}/confirm-payment`,
    { paymentIntentId },
  );
}

export function cancelBooking(bookingId: string, reason?: string) {
  return api.post<{
    booking: { id: string; status: string; cancelledAt: string };
    refund: { status: string; amountCents: number } | null;
  }>(`/bookings/${bookingId}/cancel`, { reason });
}

// --- Concierge ---

export function createConversation(userId: string) {
  return api.post<{ conversationId: string }>("/concierge/conversations", {
    userId,
  });
}

export function sendMessage(conversationId: string, userId: string, message: string) {
  return api.post<{
    response: string;
    conversationId: string;
    toolsUsed: string[];
  }>(`/concierge/conversations/${conversationId}/messages`, {
    userId,
    message,
  });
}

export function getConversationMessages(conversationId: string) {
  return api.get<{
    messages: Array<{ role: string; content: string }>;
    conversationId: string;
  }>(`/concierge/conversations/${conversationId}/messages`);
}

export function listConversations(userId: string) {
  return api.get<{
    conversations: Array<{
      id: string;
      userId: string;
      startedAt: string;
    }>;
  }>(`/users/${userId}/concierge/conversations`);
}

// --- Ratings ---

export interface PlayerRatingResponse {
  playerId: string;
  format: string;
  rating: number;
  rd: number;
  gamesPlayed: number;
  confidence: number;
  lastMatchAt: string | null;
}

export interface RatingHistoryItem {
  id: string;
  playerId: string;
  matchId: string;
  format: string;
  ratingBefore: number;
  ratingAfter: number;
  rdBefore: number;
  rdAfter: number;
  opponentId: string;
  opponentRating: number;
  result: number;
  createdAt: string;
}

export interface MatchItem {
  match: {
    id: string;
    format: string;
    player1Id: string;
    player2Id: string;
    player1Score: number;
    player2Score: number;
    winnerId: string | null;
    playedAt: string;
    confirmed: boolean;
  };
  player1: { id: string; displayName: string | null };
  player2: { id: string; displayName: string | null };
  ratingChange?: number;
}

export interface MatchResultResponse {
  match: MatchItem["match"];
  ratingChanges: {
    you: { before: { rating: number; rd: number }; after: { rating: number; rd: number }; change: number };
    opponent: { before: { rating: number; rd: number }; after: { rating: number; rd: number }; change: number };
  };
}

export function getPlayerRating(playerId: string, format = "doubles") {
  return api.get<PlayerRatingResponse>(`/players/${playerId}/rating?format=${format}`);
}

export function getRatingHistory(playerId: string, format = "doubles", limit = 50) {
  return api.get<{ playerId: string; format: string; history: RatingHistoryItem[] }>(
    `/players/${playerId}/rating-history?format=${format}&limit=${limit}`,
  );
}

export function getMatchHistory(playerId: string, limit = 20) {
  return api.get<{ playerId: string; matches: MatchItem[] }>(
    `/players/${playerId}/matches?limit=${limit}`,
  );
}

export function submitMatchResult(data: {
  opponentId: string;
  format: "singles" | "doubles";
  player1Score: number;
  player2Score: number;
  playedAt: string;
  courtId?: string;
}) {
  return api.post<MatchResultResponse>("/matches/result", data);
}

// --- Feedback ---

export type Satisfaction = "great" | "okay" | "poor";
export type IssueCategory = "court_quality" | "opponent_level" | "time" | "location";
export type OpponentSkillRating = "too_easy" | "about_right" | "too_hard";

export interface FeedbackResponse {
  feedback: {
    id: string;
    matchId: string | null;
    bookingId: string | null;
    playerId: string;
    satisfaction: Satisfaction;
    freeText: string | null;
    issueCategories: IssueCategory[];
    opponentSkillRating: OpponentSkillRating | null;
    opponentId: string | null;
    createdAt: string;
  };
}

export interface FeedbackStatsResponse {
  total: number;
  great: number;
  okay: number;
  poor: number;
  satisfactionRate: number;
}

export function submitMatchFeedback(
  matchId: string,
  data: {
    satisfaction: Satisfaction;
    freeText?: string;
    issueCategories?: IssueCategory[];
    opponentSkillRating?: OpponentSkillRating;
    opponentId?: string;
    bookingId?: string;
  },
) {
  return api.post<FeedbackResponse>(`/matches/${matchId}/feedback`, data);
}

export function submitSessionFeedback(data: {
  satisfaction: Satisfaction;
  freeText?: string;
  issueCategories?: IssueCategory[];
  bookingId?: string;
}) {
  return api.post<FeedbackResponse>("/feedback", data);
}

export function getFeedbackStats(playerId: string) {
  return api.get<FeedbackStatsResponse>(`/players/${playerId}/feedback-stats`);
}

// --- Players / Social ---

export interface PlayerProfileResponse {
  profile: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    playFrequency: string | null;
    preferredLocations?: string[];
    rating?: number | null;
    gamesPlayed?: number;
    confidence?: number | null;
    connectionStatus?: string | null;
  } | null;
}

export interface DiscoveredPlayerItem {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  playFrequency: string | null;
  rating: number | null;
  gamesPlayed: number;
  confidence: number | null;
  connectionStatus: string | null;
}

export interface ConnectionItem {
  connectionId: string;
  status: string;
  connectedAt: string;
  isIncoming: boolean;
  profile: DiscoveredPlayerItem;
}

export interface ConnectionRequest {
  connectionId: string;
  senderId: string;
  displayName: string;
  avatarUrl: string | null;
  sentAt: string;
}

export function getMyProfile() {
  return api.get<PlayerProfileResponse>("/players/me/profile");
}

export function upsertMyProfile(data: {
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  preferredLocations?: string[];
  playFrequency?: string;
}) {
  return api.put<PlayerProfileResponse>("/players/me/profile", data);
}

export function getPlayerProfile(playerId: string) {
  return api.get<PlayerProfileResponse>(`/players/${playerId}/profile`);
}

export function discoverPlayers(params: {
  search?: string;
  minRating?: number;
  maxRating?: number;
  playFrequency?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null) qs.set(k, String(v));
  }
  return api.get<{ players: DiscoveredPlayerItem[]; page: number; limit: number }>(
    `/players/discover?${qs}`,
  );
}

export function sendConnectionRequest(playerId: string) {
  return api.post<{ connection: { id: string; status: string }; action: string }>(
    `/players/${playerId}/connect`,
    {},
  );
}

export function respondToConnection(connectionId: string, action: "accept" | "decline" | "block") {
  return api.patch<{ connection?: { id: string; status: string }; status?: string }>(
    `/connections/${connectionId}`,
    { action },
  );
}

export function removeConnection(connectionId: string) {
  return api.delete<{ status: string }>(`/connections/${connectionId}`);
}

export function getMyConnections(status = "accepted", page = 1, limit = 50) {
  return api.get<{ connections: ConnectionItem[]; page: number; limit: number }>(
    `/players/me/connections?status=${status}&page=${page}&limit=${limit}`,
  );
}

export function getConnectionRequests() {
  return api.get<{ requests: ConnectionRequest[] }>("/players/me/requests");
}

// --- Scheduled Matches ---

export interface ScheduledMatchPlayer {
  userId: string;
  displayName: string | null;
  avatarUrl?: string | null;
  role: "host" | "guest";
  rsvpStatus: "pending" | "accepted" | "declined";
}

export interface ScheduledMatchItem {
  id: string;
  format: "singles" | "doubles";
  status: "upcoming" | "active" | "completed" | "cancelled";
  scheduledAt: string;
  playedAt?: string;
  notes?: string;
  createdByUserId: string;
  player1Id?: string;
  player2Id?: string;
  player1Score?: number;
  player2Score?: number;
  player1Name?: string;
  player2Name?: string;
  winnerId?: string;
  court?: { id: string; name: string; surface: string; indoor: boolean } | null;
  venue?: { id: string; name: string; address: string } | null;
  players: ScheduledMatchPlayer[];
  createdAt: string;
}

export function createMatch(data: {
  format: "singles" | "doubles";
  scheduledAt: string;
  courtId?: string;
  bookingId?: string;
  notes?: string;
  invitees?: string[];
}) {
  return api.post<{ match: { id: string; format: string; status: string; scheduledAt: string } }>(
    "/matches",
    data,
  );
}

export function invitePlayers(matchId: string, userIds: string[]) {
  return api.post<{ invited: number }>(`/matches/${matchId}/invite`, { userIds });
}

export function rsvpMatch(matchId: string, rsvpStatus: "accepted" | "declined") {
  return api.patch<{ rsvpStatus: string }>(`/matches/${matchId}/rsvp`, { rsvpStatus });
}

export function updateMatch(
  matchId: string,
  data: {
    status?: string;
    scheduledAt?: string;
    notes?: string;
    player1Score?: number;
    player2Score?: number;
  },
) {
  return api.patch<{ match: ScheduledMatchItem }>(`/matches/${matchId}`, data);
}

export function getUpcomingMatches(limit = 20) {
  return api.get<{ matches: ScheduledMatchItem[] }>(`/matches/upcoming?limit=${limit}`);
}

export function getMatchHistoryFull(limit = 20, page = 1) {
  return api.get<{ matches: ScheduledMatchItem[]; page: number; limit: number }>(
    `/matches/history?limit=${limit}&page=${page}`,
  );
}

export function getMatchDetail(matchId: string) {
  return api.get<{ match: ScheduledMatchItem }>(`/matches/${matchId}`);
}

// --- Notifications ---

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface DeviceItem {
  id: string;
  platform: string;
  createdAt: string;
}

export function registerDevice(token: string, platform: "ios" | "android") {
  return api.post<{ device: { id: string; token: string; platform: string } }>(
    "/devices/register",
    { token, platform },
  );
}

export function removeDevice(tokenId: string) {
  return api.delete<{ success: boolean }>(`/devices/${tokenId}`);
}

export function getMyDevices() {
  return api.get<{ devices: DeviceItem[] }>("/devices");
}

export function getNotifications(limit = 20) {
  return api.get<{ notifications: NotificationItem[] }>(
    `/notifications?limit=${limit}`,
  );
}

export function cancelNotification(notificationId: string) {
  return api.delete<{ success: boolean }>(`/notifications/${notificationId}`);
}

// --- Referrals ---

export interface ReferralCodeResponse {
  referral: {
    id: string;
    code: string;
    ownerType: "player" | "venue" | "influencer";
    shareUrl: string;
    clickCount: number;
    claimCount: number;
    createdAt: string;
  };
}

export interface ReferralClaimItem {
  id: string;
  refereeDisplayName: string | null;
  status: "pending" | "confirmed" | "rewarded";
  claimedAt: string | null;
  confirmedAt: string | null;
}

export interface ReferralMineResponse {
  referral: ReferralCodeResponse["referral"] | null;
  claims: ReferralClaimItem[];
  stats: {
    totalClicks: number;
    totalClaims: number;
    pendingClaims: number;
    confirmedClaims: number;
  };
}

export interface ReferralResolveResponse {
  referral: {
    code: string;
    ownerType: string;
    referrerName: string | null;
  };
}

export function generateReferralCode(ownerType: "player" | "venue" | "influencer" = "player") {
  return api.post<ReferralCodeResponse>("/referrals/generate", { ownerType });
}

export function getMyReferrals(page = 1, limit = 20) {
  return api.get<ReferralMineResponse>(`/referrals/mine?page=${page}&limit=${limit}`);
}

export function claimReferralCode(code: string) {
  return api.post<{ claim: { id: string; referrerId: string; status: string; claimedAt: string | null } }>(
    "/referrals/claim",
    { code },
  );
}

export function resolveReferralCode(code: string) {
  return api.get<ReferralResolveResponse>(`/referrals/resolve/${code}`);
}
