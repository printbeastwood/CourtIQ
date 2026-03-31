import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@courtiq/db";
import { bookings, availabilitySlots, courts, venues } from "@courtiq/db";

export function bookingRoutes(db: Db): FastifyPluginAsync {
  return async (app) => {
    // Create a redirect booking — records intent and returns the source platform URL
    app.post<{ Body: { slotId: string } }>("/bookings/redirect", async (request, reply) => {
      const { slotId } = request.body ?? {};
      if (!slotId) {
        reply.code(400);
        return { error: "slotId is required" };
      }

      // Look up the slot with court + venue info
      const [result] = await db
        .select({
          slot: availabilitySlots,
          court: courts,
          venue: venues,
        })
        .from(availabilitySlots)
        .innerJoin(courts, eq(availabilitySlots.courtId, courts.id))
        .innerJoin(venues, eq(courts.venueId, venues.id))
        .where(eq(availabilitySlots.id, slotId))
        .limit(1);

      if (!result) {
        reply.code(404);
        return { error: "Slot not found" };
      }

      if (result.slot.status !== "available") {
        reply.code(409);
        return { error: "Slot is no longer available" };
      }

      // Create pending booking with redirect method
      const [booking] = await db
        .insert(bookings)
        .values({
          userId: request.userId,
          slotId,
          status: "pending",
          bookingMethod: "redirect",
        })
        .returning();

      return {
        booking: {
          id: booking.id,
          status: booking.status,
          bookingMethod: booking.bookingMethod,
          createdAt: booking.createdAt,
        },
        bookingUrl: result.slot.sourceBookingUrl,
        slot: {
          id: result.slot.id,
          startsAt: result.slot.startsAt,
          endsAt: result.slot.endsAt,
          priceCents: result.slot.priceCents,
          currency: result.slot.currency,
        },
        court: {
          id: result.court.id,
          name: result.court.name,
          surface: result.court.surface,
          indoor: result.court.indoor,
        },
        venue: {
          id: result.venue.id,
          name: result.venue.name,
          sourcePlatform: result.venue.sourcePlatform,
        },
      };
    });

    // Confirm or cancel a redirect booking (post-redirect user feedback)
    app.patch<{ Params: { id: string }; Body: { status: "confirmed" | "cancelled" } }>(
      "/bookings/:id/confirm",
      async (request, reply) => {
        const { id } = request.params;
        const { status } = request.body ?? {};

        if (!status || !["confirmed", "cancelled"].includes(status)) {
          reply.code(400);
          return { error: "status must be 'confirmed' or 'cancelled'" };
        }

        const [existing] = await db
          .select()
          .from(bookings)
          .where(and(eq(bookings.id, id), eq(bookings.userId, request.userId)))
          .limit(1);

        if (!existing) {
          reply.code(404);
          return { error: "Booking not found" };
        }

        if (existing.status !== "pending") {
          reply.code(409);
          return { error: `Booking is already ${existing.status}` };
        }

        const [updated] = await db
          .update(bookings)
          .set({ status })
          .where(eq(bookings.id, id))
          .returning();

        return { booking: updated };
      }
    );

    // List bookings for the authenticated user
    app.get("/bookings", async (request) => {
      const results = await db
        .select({
          booking: bookings,
          slot: availabilitySlots,
          court: courts,
          venue: venues,
        })
        .from(bookings)
        .innerJoin(availabilitySlots, eq(bookings.slotId, availabilitySlots.id))
        .innerJoin(courts, eq(availabilitySlots.courtId, courts.id))
        .innerJoin(venues, eq(courts.venueId, venues.id))
        .where(eq(bookings.userId, request.userId))
        .orderBy(desc(bookings.createdAt));

      return {
        bookings: results.map((r) => ({
          id: r.booking.id,
          status: r.booking.status,
          bookingMethod: r.booking.bookingMethod,
          createdAt: r.booking.createdAt,
          slot: {
            startsAt: r.slot.startsAt,
            endsAt: r.slot.endsAt,
            priceCents: r.slot.priceCents,
            currency: r.slot.currency,
            sourceBookingUrl: r.slot.sourceBookingUrl,
          },
          venue: {
            id: r.venue.id,
            name: r.venue.name,
            sourcePlatform: r.venue.sourcePlatform,
          },
          court: {
            id: r.court.id,
            name: r.court.name,
            surface: r.court.surface,
            indoor: r.court.indoor,
          },
        })),
      };
    });
  };
}
