import type Anthropic from "@anthropic-ai/sdk";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import {
  venues,
  courts,
  availabilitySlots,
  bookings,
  type Db,
} from "@courtiq/db";
import type { PreferenceStore } from "@courtiq/preference-store";
import type { PreferenceCategory } from "@courtiq/shared";

/**
 * Claude tool-use definitions for the AI concierge.
 */
export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "search_courts",
    description:
      "Search for available padel courts and time slots. Use this when the user wants to find courts, check availability, or book a session. Supports filtering by date, time, location, surface type, and price.",
    input_schema: {
      type: "object" as const,
      properties: {
        date_from: {
          type: "string",
          description: "Start date/time in ISO 8601 format (e.g. 2026-04-01T17:00:00+07:00)",
        },
        date_to: {
          type: "string",
          description: "End date/time in ISO 8601 format",
        },
        surface: {
          type: "array",
          items: { type: "string", enum: ["glass", "panoramic", "concrete", "turf"] },
          description: "Filter by court surface type(s)",
        },
        indoor: {
          type: "boolean",
          description: "Filter for indoor (true) or outdoor (false) courts",
        },
        min_price: {
          type: "number",
          description: "Minimum price in THB",
        },
        max_price: {
          type: "number",
          description: "Maximum price in THB",
        },
        venue_id: {
          type: "string",
          description: "Filter by specific venue ID",
        },
        lat: {
          type: "number",
          description: "Latitude for location-based search (Bangkok default: 13.7563)",
        },
        lng: {
          type: "number",
          description: "Longitude for location-based search (Bangkok default: 100.5018)",
        },
        radius_km: {
          type: "number",
          description: "Search radius in kilometers (default: 15)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_user_preferences",
    description:
      "Retrieve the user's stored preferences to personalize court recommendations. Returns preferences across categories like play style, preferred times, location, court surface, skill level, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Optional semantic query to find the most relevant preferences (e.g. 'What courts would this user like for Saturday evening?')",
        },
        categories: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "play_style",
              "skill_level",
              "competitive_intent",
              "time",
              "location",
              "court_surface",
              "group_size",
              "coaching",
            ],
          },
          description: "Filter by specific preference categories",
        },
      },
      required: [],
    },
  },
  {
    name: "check_weather",
    description:
      "Check the weather forecast for a specific date and location in Bangkok. Use this to advise on outdoor vs indoor court selection.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date to check weather for (ISO 8601 format)",
        },
        lat: {
          type: "number",
          description: "Latitude (default: Bangkok 13.7563)",
        },
        lng: {
          type: "number",
          description: "Longitude (default: Bangkok 100.5018)",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "initiate_booking",
    description:
      "Start a booking for a specific court time slot. Returns a booking confirmation or a redirect URL to complete the booking on the platform.",
    input_schema: {
      type: "object" as const,
      properties: {
        slot_id: {
          type: "string",
          description: "The availability slot ID to book",
        },
      },
      required: ["slot_id"],
    },
  },
  {
    name: "update_preference",
    description:
      "Store or update a user preference. Use this when the user expresses a preference about courts, timing, location, play style, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description:
            "The preference in natural language (e.g. 'I prefer glass courts in the evening')",
        },
        category: {
          type: "string",
          enum: [
            "play_style",
            "skill_level",
            "competitive_intent",
            "time",
            "location",
            "court_surface",
            "group_size",
            "coaching",
          ],
          description: "Optional category hint for the preference",
        },
      },
      required: ["text"],
    },
  },
];

export interface ToolExecutorDeps {
  db: Db;
  preferenceStore: PreferenceStore;
  userId: string;
}

/**
 * Execute a tool call and return the result as a string.
 */
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  deps: ToolExecutorDeps
): Promise<string> {
  switch (toolName) {
    case "search_courts":
      return executeSearchCourts(toolInput, deps);
    case "get_user_preferences":
      return executeGetUserPreferences(toolInput, deps);
    case "check_weather":
      return executeCheckWeather(toolInput);
    case "initiate_booking":
      return executeInitiateBooking(toolInput, deps);
    case "update_preference":
      return executeUpdatePreference(toolInput, deps);
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

async function executeSearchCourts(
  input: Record<string, unknown>,
  deps: ToolExecutorDeps
): Promise<string> {
  const { db } = deps;
  const now = new Date();
  const limit = Math.min((input.limit as number) || 10, 20);

  const conditions: ReturnType<typeof eq>[] = [
    eq(availabilitySlots.status, "available"),
    gte(availabilitySlots.startsAt, now),
  ];

  if (input.date_from) {
    conditions.push(gte(availabilitySlots.startsAt, new Date(input.date_from as string)));
  }
  if (input.date_to) {
    conditions.push(lte(availabilitySlots.startsAt, new Date(input.date_to as string)));
  }
  if (input.min_price) {
    conditions.push(gte(availabilitySlots.priceCents, (input.min_price as number) * 100));
  }
  if (input.max_price) {
    conditions.push(lte(availabilitySlots.priceCents, (input.max_price as number) * 100));
  }
  if (input.surface) {
    conditions.push(inArray(courts.surface, input.surface as string[]));
  }
  if (input.indoor !== undefined) {
    conditions.push(eq(courts.indoor, input.indoor as boolean));
  }
  if (input.venue_id) {
    conditions.push(eq(courts.venueId, input.venue_id as string));
  }

  let locationCondition;
  const lat = (input.lat as number) ?? 13.7563;
  const lng = (input.lng as number) ?? 100.5018;
  const radiusKm = (input.radius_km as number) ?? 15;

  if (input.lat !== undefined || input.lng !== undefined) {
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
    locationCondition = sql`${venues.lat} BETWEEN ${lat - latDelta} AND ${lat + latDelta}
      AND ${venues.lng} BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}`;
  }

  const results = await db
    .select({
      slotId: availabilitySlots.id,
      startsAt: availabilitySlots.startsAt,
      endsAt: availabilitySlots.endsAt,
      priceCents: availabilitySlots.priceCents,
      currency: availabilitySlots.currency,
      sourceBookingUrl: availabilitySlots.sourceBookingUrl,
      fetchedAt: availabilitySlots.fetchedAt,
      courtName: courts.name,
      surface: courts.surface,
      indoor: courts.indoor,
      venueName: venues.name,
      venueAddress: venues.address,
      venueId: venues.id,
    })
    .from(availabilitySlots)
    .innerJoin(courts, eq(availabilitySlots.courtId, courts.id))
    .innerJoin(venues, eq(courts.venueId, venues.id))
    .where(
      locationCondition
        ? and(...conditions, locationCondition)
        : and(...conditions)
    )
    .orderBy(availabilitySlots.startsAt)
    .limit(limit);

  const formatted = results.map((r) => ({
    slot_id: r.slotId,
    venue: r.venueName,
    venue_id: r.venueId,
    address: r.venueAddress,
    court: r.courtName,
    surface: r.surface,
    indoor: r.indoor,
    starts_at: r.startsAt.toISOString(),
    ends_at: r.endsAt.toISOString(),
    price: r.priceCents ? `${r.priceCents / 100} ${r.currency}` : "Price not listed",
    booking_url: r.sourceBookingUrl,
    data_freshness_min: Math.round(
      (now.getTime() - r.fetchedAt.getTime()) / 60000
    ),
  }));

  if (formatted.length === 0) {
    return JSON.stringify({
      results: [],
      message: "No available courts found matching your criteria. Try adjusting your filters.",
    });
  }

  return JSON.stringify({ results: formatted, total: formatted.length });
}

async function executeGetUserPreferences(
  input: Record<string, unknown>,
  deps: ToolExecutorDeps
): Promise<string> {
  const { preferenceStore, userId } = deps;

  if (input.query) {
    const context = await preferenceStore.getPreferenceContext(
      userId,
      input.query as string,
      10
    );
    return JSON.stringify({
      semantic_matches: context.preferences.map((m) => ({
        category: m.preference.category,
        text: m.preference.text,
        relevance: Math.round(m.similarity * 100) / 100,
      })),
      all_preferences: context.structured,
    });
  }

  const prefs = await preferenceStore.getPreferences(userId, {
    categories: input.categories as PreferenceCategory[] | undefined,
  });

  return JSON.stringify({
    preferences: prefs.map((p) => ({
      category: p.category,
      text: p.text,
    })),
  });
}

async function executeCheckWeather(
  input: Record<string, unknown>
): Promise<string> {
  // Weather API integration placeholder
  // In production, integrate with OpenWeatherMap or similar
  const date = new Date(input.date as string);
  const month = date.getMonth() + 1;

  // Bangkok seasonal weather approximation
  const isRainySeason = month >= 5 && month <= 10;
  const hour = date.getHours();
  const isEvening = hour >= 17;

  return JSON.stringify({
    date: date.toISOString().split("T")[0],
    location: "Bangkok, Thailand",
    forecast: isRainySeason
      ? {
          condition: isEvening ? "Thunderstorms likely" : "Hot and humid, afternoon showers possible",
          temperature_c: isEvening ? 28 : 34,
          rain_chance: isEvening ? 70 : 50,
          recommendation: "Consider booking an indoor court to avoid rain disruptions.",
        }
      : {
          condition: "Clear and warm",
          temperature_c: isEvening ? 30 : 36,
          rain_chance: 10,
          recommendation: "Great conditions for outdoor play. Stay hydrated!",
        },
    note: "Forecast is approximate. Check closer to the date for accuracy.",
  });
}

async function executeInitiateBooking(
  input: Record<string, unknown>,
  deps: ToolExecutorDeps
): Promise<string> {
  const { db, userId } = deps;
  const slotId = input.slot_id as string;

  // Look up the slot
  const slot = await db
    .select({
      id: availabilitySlots.id,
      status: availabilitySlots.status,
      sourceBookingUrl: availabilitySlots.sourceBookingUrl,
      startsAt: availabilitySlots.startsAt,
      endsAt: availabilitySlots.endsAt,
      priceCents: availabilitySlots.priceCents,
      currency: availabilitySlots.currency,
      courtName: courts.name,
      venueName: venues.name,
    })
    .from(availabilitySlots)
    .innerJoin(courts, eq(availabilitySlots.courtId, courts.id))
    .innerJoin(venues, eq(courts.venueId, venues.id))
    .where(eq(availabilitySlots.id, slotId))
    .limit(1);

  if (slot.length === 0) {
    return JSON.stringify({ error: "Slot not found. It may no longer be available." });
  }

  const s = slot[0];
  if (s.status !== "available") {
    return JSON.stringify({ error: "This slot is no longer available." });
  }

  // Create a pending booking
  const [booking] = await db
    .insert(bookings)
    .values({
      userId,
      slotId,
      status: "pending",
      bookingMethod: "concierge",
    })
    .returning();

  // Mark slot as held
  await db
    .update(availabilitySlots)
    .set({ status: "held" })
    .where(eq(availabilitySlots.id, slotId));

  return JSON.stringify({
    booking_id: booking.id,
    status: "pending",
    venue: s.venueName,
    court: s.courtName,
    starts_at: s.startsAt.toISOString(),
    ends_at: s.endsAt.toISOString(),
    price: s.priceCents ? `${s.priceCents / 100} ${s.currency}` : "Price not listed",
    booking_url: s.sourceBookingUrl,
    message: s.sourceBookingUrl
      ? "Booking initiated! Complete your booking using the link provided."
      : "Booking initiated! You will receive a confirmation shortly.",
  });
}

async function executeUpdatePreference(
  input: Record<string, unknown>,
  deps: ToolExecutorDeps
): Promise<string> {
  const { preferenceStore, userId } = deps;

  const stored = await preferenceStore.storePreferences(userId, [
    {
      text: input.text as string,
      category: input.category as PreferenceCategory | undefined,
    },
  ]);

  return JSON.stringify({
    stored: stored.map((p) => ({
      category: p.category,
      text: p.text,
    })),
    message: "Preference saved! I'll use this to personalize your recommendations.",
  });
}
