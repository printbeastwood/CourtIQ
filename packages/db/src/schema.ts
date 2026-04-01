import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  real,
  vector,
} from "drizzle-orm/pg-core";

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    address: text("address"),
    amenities: jsonb("amenities").$type<string[]>().default([]),
    sourcePlatform: text("source_platform").notNull(),
    sourceId: text("source_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("uq_venue_source").on(t.sourcePlatform, t.sourceId),
    index("idx_venue_location").on(t.lat, t.lng),
  ]
);

export const courts = pgTable("courts", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .references(() => venues.id)
    .notNull(),
  name: text("name").notNull(),
  surface: text("surface").notNull(),
  indoor: boolean("indoor").default(false).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
});

export const availabilitySlots = pgTable(
  "availability_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courtId: uuid("court_id")
      .references(() => courts.id)
      .notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    priceCents: integer("price_cents"),
    currency: text("currency").default("THB").notNull(),
    status: text("status").default("available").notNull(),
    sourceBookingUrl: text("source_booking_url"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("uq_slot_court_time").on(t.courtId, t.startsAt),
    index("idx_slot_starts").on(t.startsAt),
    index("idx_slot_status").on(t.status),
  ]
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").unique().notNull(),
  firebaseUid: text("firebase_uid").unique(),
  displayName: text("display_name"),
  skillLevel: text("skill_level"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const preferences = pgTable(
  "preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    category: text("category").notNull(),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_preference_user").on(t.userId),
    index("idx_preference_category").on(t.userId, t.category),
  ]
);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id)
      .notNull(),
    role: text("role").notNull(), // 'user', 'assistant', 'system'
    content: text("content").notNull(),
    toolCalls: jsonb("tool_calls").$type<unknown[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_message_conversation").on(t.conversationId),
    index("idx_message_created").on(t.createdAt),
  ]
);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  slotId: uuid("slot_id")
    .references(() => availabilitySlots.id)
    .notNull(),
  status: text("status").default("pending").notNull(), // pending, confirmed, cancelled
  bookingMethod: text("booking_method"), // concierge, direct, redirect
  sourceConfirmationId: text("source_confirmation_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courtId: uuid("court_id").references(() => courts.id),
    bookingId: uuid("booking_id").references(() => bookings.id),
    platformBookingRef: text("platform_booking_ref"),
    format: text("format").notNull(), // singles, doubles
    status: text("status").default("completed").notNull(), // upcoming, active, completed, cancelled
    player1Id: uuid("player1_id")
      .references(() => users.id)
      .notNull(),
    player2Id: uuid("player2_id")
      .references(() => users.id)
      .notNull(),
    player1Score: integer("player1_score"),
    player2Score: integer("player2_score"),
    winnerId: uuid("winner_id").references(() => users.id),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    reportedById: uuid("reported_by_id")
      .references(() => users.id)
      .notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    confirmed: boolean("confirmed").default(false).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_match_player1").on(t.player1Id),
    index("idx_match_player2").on(t.player2Id),
    index("idx_match_played_at").on(t.playedAt),
    index("idx_match_status").on(t.status),
    index("idx_match_scheduled_at").on(t.scheduledAt),
  ]
);

export const matchPlayers = pgTable(
  "match_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .references(() => matches.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    role: text("role").default("guest").notNull(), // host, guest
    rsvpStatus: text("rsvp_status").default("pending").notNull(), // pending, accepted, declined
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("uq_match_player").on(t.matchId, t.userId),
    index("idx_match_player_match").on(t.matchId),
    index("idx_match_player_user").on(t.userId),
    index("idx_match_player_rsvp").on(t.rsvpStatus),
  ]
);

export const playerRatings = pgTable(
  "player_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .references(() => users.id)
      .notNull(),
    format: text("format").notNull(), // singles, doubles
    rating: real("rating").default(1500).notNull(),
    rd: real("rd").default(350).notNull(), // rating deviation
    volatility: real("volatility").default(0.06).notNull(),
    gamesPlayed: integer("games_played").default(0).notNull(),
    lastMatchAt: timestamp("last_match_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("uq_player_format_rating").on(t.playerId, t.format),
    index("idx_rating_player").on(t.playerId),
  ]
);

export const ratingHistory = pgTable(
  "rating_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .references(() => users.id)
      .notNull(),
    matchId: uuid("match_id")
      .references(() => matches.id)
      .notNull(),
    format: text("format").notNull(),
    ratingBefore: real("rating_before").notNull(),
    ratingAfter: real("rating_after").notNull(),
    rdBefore: real("rd_before").notNull(),
    rdAfter: real("rd_after").notNull(),
    opponentId: uuid("opponent_id")
      .references(() => users.id)
      .notNull(),
    opponentRating: real("opponent_rating").notNull(),
    result: real("result").notNull(), // 1 = win, 0.5 = draw, 0 = loss
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_rating_history_player").on(t.playerId),
    index("idx_rating_history_match").on(t.matchId),
  ]
);

export const matchFeedback = pgTable(
  "match_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").references(() => matches.id),
    bookingId: uuid("booking_id").references(() => bookings.id),
    playerId: uuid("player_id")
      .references(() => users.id)
      .notNull(),
    satisfaction: text("satisfaction").notNull(), // great, okay, poor
    freeText: text("free_text"),
    issueCategories: jsonb("issue_categories").$type<string[]>().default([]), // court_quality, opponent_level, time, location
    opponentSkillRating: text("opponent_skill_rating"), // too_easy, about_right, too_hard
    opponentId: uuid("opponent_id").references(() => users.id),
    preferenceExtracted: boolean("preference_extracted").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_feedback_player").on(t.playerId),
    index("idx_feedback_match").on(t.matchId),
    index("idx_feedback_booking").on(t.bookingId),
    index("idx_feedback_created").on(t.createdAt),
  ]
);

export const playerProfiles = pgTable("player_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .unique()
    .notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  preferredLocations: jsonb("preferred_locations").$type<string[]>().default([]),
  playFrequency: text("play_frequency"), // daily, weekly, biweekly, monthly, occasional
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    friendId: uuid("friend_id")
      .references(() => users.id)
      .notNull(),
    status: text("status").default("pending").notNull(), // pending, accepted, blocked
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("uq_connection_pair").on(t.userId, t.friendId),
    index("idx_connection_user").on(t.userId),
    index("idx_connection_friend").on(t.friendId),
    index("idx_connection_status").on(t.status),
  ]
);

export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    token: text("token").notNull(),
    platform: text("platform").notNull(), // ios, android
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("uq_device_token").on(t.token),
    index("idx_device_token_user").on(t.userId),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    type: text("type").notNull(), // post_match_feedback, booking_reminder, match_invite, system
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().default({}),
    status: text("status").default("pending").notNull(), // pending, sent, failed, cancelled
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_notification_user").on(t.userId),
    index("idx_notification_status").on(t.status),
    index("idx_notification_scheduled").on(t.scheduledFor),
    index("idx_notification_type").on(t.userId, t.type),
  ]
);

export const referralCodes = pgTable(
  "referral_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .references(() => users.id)
      .notNull(),
    code: text("code").unique().notNull(),
    ownerType: text("owner_type").default("player").notNull(), // player, venue, influencer
    clickCount: integer("click_count").default(0).notNull(),
    claimCount: integer("claim_count").default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_referral_code_owner").on(t.ownerId),
    index("idx_referral_code_active").on(t.active),
  ]
);

export const referralClaims = pgTable(
  "referral_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeId: uuid("code_id")
      .references(() => referralCodes.id)
      .notNull(),
    referrerId: uuid("referrer_id")
      .references(() => users.id)
      .notNull(),
    refereeId: uuid("referee_id")
      .references(() => users.id)
      .notNull(),
    status: text("status").default("pending").notNull(), // pending, confirmed, rewarded
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).defaultNow().notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [
    unique("uq_referral_claim_referee").on(t.refereeId),
    index("idx_referral_claim_referrer").on(t.referrerId),
    index("idx_referral_claim_code").on(t.codeId),
    index("idx_referral_claim_status").on(t.status),
  ]
);

export const adapterHealthLog = pgTable("adapter_health_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  platform: text("platform").notNull(),
  healthy: boolean("healthy").notNull(),
  errorMessage: text("error_message"),
  venuesFetched: integer("venues_fetched").default(0),
  slotsFetched: integer("slots_fetched").default(0),
  durationMs: integer("duration_ms"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Player data migration tables ───────────────────────────────────────────

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    platform: text("platform").notNull(),
    status: text("status").default("pending").notNull(), // pending, running, completed, failed
    progress: integer("progress").default(0).notNull(), // 0-100
    matchesImported: integer("matches_imported").default(0).notNull(),
    bookingsImported: integer("bookings_imported").default(0).notNull(),
    connectionsImported: integer("connections_imported").default(0).notNull(),
    preferencesSeeded: integer("preferences_seeded").default(0).notNull(),
    errorMessage: text("error_message"),
    platformCredentials: jsonb("platform_credentials").$type<Record<string, unknown>>(),
    summary: text("summary"), // AI-generated summary of imported play style
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_import_job_user").on(t.userId),
    index("idx_import_job_status").on(t.status),
  ]
);

export const matchHistory = pgTable(
  "match_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    importJobId: uuid("import_job_id")
      .references(() => importJobs.id),
    platform: text("platform").notNull(),
    platformMatchId: text("platform_match_id"),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    venueName: text("venue_name"),
    courtName: text("court_name"),
    format: text("format"), // singles, doubles, americano
    result: text("result"), // won, lost, draw
    score: text("score"), // e.g. "6-4 6-3"
    partnerNames: jsonb("partner_names").$type<string[]>().default([]),
    opponentNames: jsonb("opponent_names").$type<string[]>().default([]),
    durationMinutes: integer("duration_minutes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_match_user").on(t.userId),
    index("idx_match_played").on(t.playedAt),
    index("idx_match_platform").on(t.platform, t.platformMatchId),
  ]
);

export const userConnections = pgTable(
  "user_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    importJobId: uuid("import_job_id")
      .references(() => importJobs.id),
    platform: text("platform").notNull(),
    platformUserId: text("platform_user_id"),
    displayName: text("display_name").notNull(),
    skillLevel: text("skill_level"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_connection_user").on(t.userId),
    index("idx_connection_platform").on(t.platform, t.platformUserId),
  ]
);

// ─── Reflink / referral system tables ───────────────────────────────────────

export const reflinks = pgTable(
  "reflinks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    code: text("code").unique().notNull(), // e.g. "maria-padel", "kross-bkk"
    tier: text("tier").notNull(), // player, influencer, venue, coach
    commissionRate: real("commission_rate").notNull(), // decimal: 0.05 = 5%
    rewardType: text("reward_type").notNull(), // commission, credit
    rewardConfig: jsonb("reward_config").$type<Record<string, unknown>>().default({}),
    // e.g. { creditAmount: 500, creditCurrency: "THB", requiredReferrals: 3 }
    attributionWindowDays: integer("attribution_window_days").default(30).notNull(),
    active: boolean("active").default(true).notNull(),
    clicks: integer("clicks").default(0).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_reflink_user").on(t.userId),
    index("idx_reflink_code").on(t.code),
    index("idx_reflink_tier").on(t.tier),
  ]
);

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reflinkId: uuid("reflink_id")
      .references(() => reflinks.id)
      .notNull(),
    referrerId: uuid("referrer_id")
      .references(() => users.id)
      .notNull(),
    referredUserId: uuid("referred_user_id")
      .references(() => users.id)
      .notNull(),
    status: text("status").default("signed_up").notNull(), // signed_up, first_booking, qualified, expired
    attributedAt: timestamp("attributed_at", { withTimezone: true }).defaultNow().notNull(),
    qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
    bookingCount: integer("booking_count").default(0).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_referral_reflink").on(t.reflinkId),
    index("idx_referral_referrer").on(t.referrerId),
    index("idx_referral_referred").on(t.referredUserId),
    unique("uq_referral_user").on(t.reflinkId, t.referredUserId),
  ]
);

export const referralPayouts = pgTable(
  "referral_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerId: uuid("referrer_id")
      .references(() => users.id)
      .notNull(),
    reflinkId: uuid("reflink_id")
      .references(() => reflinks.id)
      .notNull(),
    referralId: uuid("referral_id")
      .references(() => referrals.id),
    bookingId: uuid("booking_id")
      .references(() => bookings.id),
    type: text("type").notNull(), // commission, credit, bonus
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("THB").notNull(),
    status: text("status").default("pending").notNull(), // pending, approved, paid, cancelled
    description: text("description"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_payout_referrer").on(t.referrerId),
    index("idx_payout_status").on(t.status),
    index("idx_payout_reflink").on(t.reflinkId),
  ]
);
