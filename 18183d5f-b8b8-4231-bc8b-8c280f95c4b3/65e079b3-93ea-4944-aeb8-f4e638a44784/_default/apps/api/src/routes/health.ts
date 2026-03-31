import type { FastifyPluginAsync } from "fastify";
import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "@courtiq/db";
import { adapterHealthLog, venues, availabilitySlots } from "@courtiq/db";
import { getAllAdapters } from "@courtiq/adapters";

export function healthRoutes(db: Db): FastifyPluginAsync {
  return async (app) => {
    // Adapter health dashboard
    app.get("/health/adapters", async () => {
      const adapters = getAllAdapters();
      const health = await Promise.all(
        adapters.map(async (adapter) => {
          const runtime = await adapter.healthCheck();

          // Get last 10 health log entries from DB
          const logs = await db
            .select()
            .from(adapterHealthLog)
            .where(eq(adapterHealthLog.platform, adapter.platform))
            .orderBy(desc(adapterHealthLog.checkedAt))
            .limit(10);

          const recentSuccessRate =
            logs.length > 0
              ? logs.filter((l) => l.healthy).length / logs.length
              : null;

          return {
            platform: adapter.platform,
            runtime,
            recentLogs: logs,
            recentSuccessRate,
          };
        })
      );

      return { adapters: health };
    });

    // Coverage stats
    app.get("/health/coverage", async () => {
      const [venueCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(venues);

      const [slotCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(availabilitySlots)
        .where(eq(availabilitySlots.status, "available"));

      const platformCounts = await db
        .select({
          platform: venues.sourcePlatform,
          count: sql<number>`count(*)::int`,
        })
        .from(venues)
        .groupBy(venues.sourcePlatform);

      // Staleness: average age of latest fetch per venue
      const [staleness] = await db
        .select({
          avgMinutes: sql<number>`avg(extract(epoch from now() - ${availabilitySlots.fetchedAt}) / 60)::int`,
          maxMinutes: sql<number>`max(extract(epoch from now() - ${availabilitySlots.fetchedAt}) / 60)::int`,
        })
        .from(availabilitySlots);

      return {
        totalVenues: venueCount?.count ?? 0,
        totalAvailableSlots: slotCount?.count ?? 0,
        venuesByPlatform: platformCounts,
        staleness: staleness
          ? { avgMinutes: staleness.avgMinutes, maxMinutes: staleness.maxMinutes }
          : null,
      };
    });
  };
}
