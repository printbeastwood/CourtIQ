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
    format: text("format").notNull(), // singles, doubles
    player1Id: uuid("player1_id")
      .references(() => users.id)
      .notNull(),
    player2Id: uuid("player2_id")
      .references(() => users.id)
      .notNull(),
    player1Score: integer("player1_score"),
    player2Score: integer("player2_score"),
    winnerId: uuid("winner_id").references(() => users.id),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    reportedById: uuid("reported_by_id")
      .references(() => users.id)
      .notNull(),
    confirmed: boolean("confirmed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_match_player1").on(t.player1Id),
    index("idx_match_player2").on(t.player2Id),
    index("idx_match_played_at").on(t.playedAt),
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
