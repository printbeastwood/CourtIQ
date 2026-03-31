import type { FastifyPluginAsync } from "fastify";
import { eq, sql } from "drizzle-orm";
import type { Db } from "@courtiq/db";
import { venues, courts } from "@courtiq/db";

export function venueRoutes(db: Db): FastifyPluginAsync {
  return async (app) => {
    // List/search venues
    app.get("/venues", async (request, _reply) => {
      const query = request.query as {
        lat?: string;
        lng?: string;
        radiusKm?: string;
        search?: string;
        page?: string;
        limit?: string;
      };

      const page = parseInt(query.page || "1", 10);
      const limit = Math.min(parseInt(query.limit || "20", 10), 100);
      const offset = (page - 1) * limit;

      let results;
      if (query.lat && query.lng) {
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusKm = parseFloat(query.radiusKm || "15");

        // Simple bounding box filter (good enough for MVP, avoids PostGIS dependency)
        const latDelta = radiusKm / 111.0;
        const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));

        results = await db
          .select()
          .from(venues)
          .where(
            sql`${venues.lat} BETWEEN ${lat - latDelta} AND ${lat + latDelta}
                AND ${venues.lng} BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}`
          )
          .limit(limit)
          .offset(offset);
      } else if (query.search) {
        results = await db
          .select()
          .from(venues)
          .where(sql`${venues.name} ILIKE ${"%" + query.search + "%"}`)
          .limit(limit)
          .offset(offset);
      } else {
        results = await db.select().from(venues).limit(limit).offset(offset);
      }

      return { venues: results, page, limit };
    });

    // Get venue detail with courts
    app.get<{ Params: { id: string } }>("/venues/:id", async (request, reply) => {
      const { id } = request.params;

      const [venue] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
      if (!venue) {
        reply.code(404);
        return { error: "Venue not found" };
      }

      const venueCourts = await db.select().from(courts).where(eq(courts.venueId, id));

      return { venue, courts: venueCourts };
    });
  };
}
