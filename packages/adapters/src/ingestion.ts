import { eq, and } from "drizzle-orm";
import type { Db } from "@courtiq/db";
import { venues, courts, availabilitySlots, adapterHealthLog } from "@courtiq/db";
import type { PlatformAdapter, Region, DateRange, Venue } from "@courtiq/shared";

/**
 * Runs a full ingestion cycle for a single adapter:
 * 1. Fetch venues in the region
 * 2. Upsert venues into DB
 * 3. For each venue, fetch availability
 * 4. Upsert courts and slots
 * 5. Log health status
 */
export async function ingestAdapter(
  db: Db,
  adapter: PlatformAdapter,
  region: Region,
  dateRange: DateRange
): Promise<{ venueCount: number; slotCount: number }> {
  const start = Date.now();
  let venueCount = 0;
  let slotCount = 0;

  try {
    const fetchedVenues = await adapter.fetchVenues(region);
    venueCount = fetchedVenues.length;

    for (const v of fetchedVenues) {
      // Upsert venue
      const venueId = await upsertVenue(db, v);

      // Fetch availability for this venue
      const availability = await adapter.fetchAvailability(v.sourceId, dateRange);

      for (const { court: courtData, slots: slotData } of availability.courts) {
        // Upsert court
        const courtId = await upsertCourt(db, venueId, courtData);

        // Upsert slots
        for (const s of slotData) {
          await upsertSlot(db, courtId, s);
          slotCount++;
        }
      }
    }

    await db.insert(adapterHealthLog).values({
      platform: adapter.platform,
      healthy: true,
      venuesFetched: venueCount,
      slotsFetched: slotCount,
      durationMs: Date.now() - start,
    });

    return { venueCount, slotCount };
  } catch (err) {
    await db.insert(adapterHealthLog).values({
      platform: adapter.platform,
      healthy: false,
      errorMessage: err instanceof Error ? err.message : String(err),
      venuesFetched: venueCount,
      slotsFetched: slotCount,
      durationMs: Date.now() - start,
    });
    throw err;
  }
}

async function upsertVenue(db: Db, venue: Venue): Promise<string> {
  const existing = await db
    .select({ id: venues.id })
    .from(venues)
    .where(
      and(
        eq(venues.sourcePlatform, venue.sourcePlatform),
        eq(venues.sourceId, venue.sourceId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(venues)
      .set({
        name: venue.name,
        lat: venue.location.lat,
        lng: venue.location.lng,
        address: venue.address,
        amenities: venue.amenities,
        metadata: venue.metadata,
        updatedAt: new Date(),
      })
      .where(eq(venues.id, existing[0]!.id));
    return existing[0]!.id;
  }

  const [inserted] = await db
    .insert(venues)
    .values({
      name: venue.name,
      slug: venue.slug,
      lat: venue.location.lat,
      lng: venue.location.lng,
      address: venue.address,
      amenities: venue.amenities,
      sourcePlatform: venue.sourcePlatform,
      sourceId: venue.sourceId,
      metadata: venue.metadata,
    })
    .returning({ id: venues.id });

  return inserted!.id;
}

async function upsertCourt(
  db: Db,
  venueId: string,
  court: { name: string; surface: string; indoor: boolean; metadata: Record<string, unknown> }
): Promise<string> {
  const existing = await db
    .select({ id: courts.id })
    .from(courts)
    .where(and(eq(courts.venueId, venueId), eq(courts.name, court.name)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0]!.id;
  }

  const [inserted] = await db
    .insert(courts)
    .values({
      venueId,
      name: court.name,
      surface: court.surface,
      indoor: court.indoor,
      metadata: court.metadata,
    })
    .returning({ id: courts.id });

  return inserted!.id;
}

async function upsertSlot(
  db: Db,
  courtId: string,
  slot: Omit<import("@courtiq/shared").Slot, "id" | "courtId">
): Promise<void> {
  const existing = await db
    .select({ id: availabilitySlots.id })
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.courtId, courtId),
        eq(availabilitySlots.startsAt, slot.startsAt)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(availabilitySlots)
      .set({
        endsAt: slot.endsAt,
        priceCents: slot.priceCents,
        currency: slot.currency,
        status: slot.status,
        sourceBookingUrl: slot.sourceBookingUrl,
        fetchedAt: slot.fetchedAt,
      })
      .where(eq(availabilitySlots.id, existing[0]!.id));
    return;
  }

  await db.insert(availabilitySlots).values({
    courtId,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    priceCents: slot.priceCents,
    currency: slot.currency,
    status: slot.status,
    sourceBookingUrl: slot.sourceBookingUrl,
    fetchedAt: slot.fetchedAt,
  });
}
