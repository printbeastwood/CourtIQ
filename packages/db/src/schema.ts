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
