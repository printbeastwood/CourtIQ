import type { FastifyPluginAsync } from "fastify";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import type { Db } from "@courtiq/db";
import { venues, courts, availabilitySlots } from "@courtiq/db";
import { slotSearchSchema } from "@courtiq/shared";

export function slotRoutes(db: Db): FastifyPluginAsync {
  return async (app) => {
    // Search slots across all venues
    app.get("/slots/search", async (request, reply) => {
      const parsed = slotSearchSchema.safeParse(request.query);
      if (!parsed.success) {
        reply.code(400);
        return { error: "Invalid query parameters", details: parsed.error.flatten() };
      }

      const q = parsed.data;
      const offset = (q.page - 1) * q.limit;
      const now = new Date();

      // Build conditions
      const conditions: ReturnType<typeof eq>[] = [
        eq(availabilitySlots.status, "available"),
        gte(availabilitySlots.startsAt, now),
      ];

      if (q.dateFrom) conditions.push(gte(availabilitySlots.startsAt, q.dateFrom));
      if (q.dateTo) conditions.push(lte(availabilitySlots.startsAt, q.dateTo));
      if (q.minPrice) conditions.push(gte(availabilitySlots.priceCents, q.minPrice));
      if (q.maxPrice) conditions.push(lte(availabilitySlots.priceCents, q.maxPrice));

      // Surface + indoor filter requires joining courts
      if (q.surface) conditions.push(inArray(courts.surface, q.surface));
      if (q.indoor !== undefined) conditions.push(eq(courts.indoor, q.indoor));
      if (q.venueId) conditions.push(eq(courts.venueId, q.venueId));

      // Location filter on venues
      let locationCondition;
      if (q.lat !== undefined && q.lng !== undefined) {
        const latDelta = q.radiusKm / 111.0;
        const lngDelta = q.radiusKm / (111.0 * Math.cos((q.lat * Math.PI) / 180));
        locationCondition = sql`${venues.lat} BETWEEN ${q.lat - latDelta} AND ${q.lat + latDelta}
          AND ${venues.lng} BETWEEN ${q.lng - lngDelta} AND ${q.lng + lngDelta}`;
      }

      const results = await db
        .select({
          slot: availabilitySlots,
          court: courts,
          venue: venues,
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
        .limit(q.limit)
        .offset(offset);

      // Compute staleness
      const enriched = results.map((r) => ({
        venue: r.venue,
        court: r.court,
        slot: r.slot,
        stalenessMinutes: Math.round(
          (now.getTime() - new Date(r.slot.fetchedAt).getTime()) / 60_000
        ),
      }));

      return {
        results: enriched,
        page: q.page,
        limit: q.limit,
        count: enriched.length,
      };
    });

    // Get slots for a specific venue
    app.get<{ Params: { id: string } }>("/venues/:id/slots", async (request, _reply) => {
      const { id } = request.params;
      const query = request.query as { dateFrom?: string; dateTo?: string };

      const now = new Date();
      const conditions = [
        eq(courts.venueId, id),
        eq(availabilitySlots.status, "available"),
        gte(availabilitySlots.startsAt, now),
      ];

      if (query.dateFrom) conditions.push(gte(availabilitySlots.startsAt, new Date(query.dateFrom)));
      if (query.dateTo) conditions.push(lte(availabilitySlots.startsAt, new Date(query.dateTo)));

      const results = await db
        .select({
          slot: availabilitySlots,
          court: courts,
        })
        .from(availabilitySlots)
        .innerJoin(courts, eq(availabilitySlots.courtId, courts.id))
        .where(and(...conditions))
        .orderBy(availabilitySlots.startsAt);

      return {
        slots: results.map((r) => ({
          ...r.slot,
          court: r.court,
          stalenessMinutes: Math.round(
            (now.getTime() - new Date(r.slot.fetchedAt).getTime()) / 60_000
          ),
        })),
      };
    });
  };
}
