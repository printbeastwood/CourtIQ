/**
 * E2E Booking Flow — Search courts -> select slot -> book -> confirm
 *
 * Tests the full booking journey from venue search through slot selection,
 * redirect booking creation, and confirmation.
 */
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  TEST_USER_ID,
  TEST_VENUE_ID,
  TEST_COURT_ID,
  TEST_SLOT_ID,
  TEST_BOOKING_ID,
  testVenue,
  testCourt,
  testSlot,
  testBooking,
  mockDb,
  buildTestApp,
  authHeaders,
} from "./helpers.js";

// ──────────────────── Tests ────────────────────

describe("E2E: Booking Flow", () => {
  describe("Search -> Select -> Book -> Confirm", () => {
    it("completes the full booking journey", async () => {
      // Step 1: Search for venues
      const searchApp = await buildTestApp({
        db: mockDb({
          routeResult: [testVenue],
        }),
      });

      const searchRes = await searchApp.inject({
        method: "GET",
        url: "/api/v1/venues",
        headers: authHeaders,
      });

      expect(searchRes.statusCode).toBe(200);
      const venues = searchRes.json().venues;
      expect(venues).toHaveLength(1);
      expect(venues[0].name).toBe("Padel City Bangkok");
      const venueId = venues[0].id;

      await searchApp.close();

      // Step 2: Get venue details with courts
      const venueApp = await buildTestApp({
        db: mockDb({
          routeResult: [{ venue: testVenue, court: testCourt }],
        }),
      });

      const venueRes = await venueApp.inject({
        method: "GET",
        url: `/api/v1/venues/${venueId}`,
        headers: authHeaders,
      });

      expect(venueRes.statusCode).toBe(200);
      await venueApp.close();

      // Step 3: Search for available slots
      const slotApp = await buildTestApp({
        db: mockDb({
          routeResult: [
            {
              slot: testSlot,
              court: testCourt,
              venue: testVenue,
            },
          ],
        }),
      });

      const slotRes = await slotApp.inject({
        method: "GET",
        url: "/api/v1/slots/search",
        query: { venueId: TEST_VENUE_ID },
        headers: authHeaders,
      });

      expect(slotRes.statusCode).toBe(200);
      const slotResults = slotRes.json().results;
      expect(slotResults).toHaveLength(1);
      expect(slotResults[0].slot.priceCents).toBe(80000);
      expect(slotResults[0].slot.currency).toBe("THB");
      const slotId = slotResults[0].slot.id;

      await slotApp.close();

      // Step 4: Create redirect booking
      const bookApp = await buildTestApp({
        db: mockDb({
          // Join query finds slot + court + venue
          routeResult: [
            {
              slot: { ...testSlot, status: "available" },
              court: testCourt,
              venue: testVenue,
            },
          ],
          insertReturn: [
            {
              id: TEST_BOOKING_ID,
              userId: TEST_USER_ID,
              slotId: TEST_SLOT_ID,
              status: "pending",
              bookingMethod: "redirect",
              createdAt: new Date(),
            },
          ],
        }),
      });

      const bookRes = await bookApp.inject({
        method: "POST",
        url: "/api/v1/bookings/redirect",
        headers: authHeaders,
        payload: { slotId },
      });

      expect(bookRes.statusCode).toBe(200);
      const bookBody = bookRes.json();
      expect(bookBody.booking.status).toBe("pending");
      expect(bookBody.booking.bookingMethod).toBe("redirect");
      expect(bookBody.bookingUrl).toBeDefined();
      expect(bookBody.court.name).toBe("Court 1");
      expect(bookBody.venue.name).toBe("Padel City Bangkok");
      const bookingId = bookBody.booking.id;

      await bookApp.close();

      // Step 5: Confirm booking after redirect
      const confirmApp = await buildTestApp({
        db: mockDb({
          routeResult: [
            {
              id: bookingId,
              userId: TEST_USER_ID,
              slotId: TEST_SLOT_ID,
              status: "pending",
              bookingMethod: "redirect",
            },
          ],
          updateReturn: [
            {
              id: bookingId,
              userId: TEST_USER_ID,
              slotId: TEST_SLOT_ID,
              status: "confirmed",
              bookingMethod: "redirect",
            },
          ],
        }),
      });

      const confirmRes = await confirmApp.inject({
        method: "PATCH",
        url: `/api/v1/bookings/${bookingId}/confirm`,
        headers: authHeaders,
        payload: { status: "confirmed" },
      });

      expect(confirmRes.statusCode).toBe(200);
      expect(confirmRes.json().booking.status).toBe("confirmed");

      await confirmApp.close();
    });
  });

  describe("Booking error paths", () => {
    it("rejects booking for unavailable slot", async () => {
      const app = await buildTestApp({
        db: mockDb({
          routeResult: [
            {
              slot: { ...testSlot, status: "booked" },
              court: testCourt,
              venue: testVenue,
            },
          ],
        }),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/bookings/redirect",
        headers: authHeaders,
        payload: { slotId: TEST_SLOT_ID },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/available/i);
      await app.close();
    });

    it("rejects booking without slotId", async () => {
      const app = await buildTestApp({ db: mockDb() });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/bookings/redirect",
        headers: authHeaders,
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/slotId/);
      await app.close();
    });

    it("rejects confirming an already confirmed booking", async () => {
      const app = await buildTestApp({
        db: mockDb({
          routeResult: [
            {
              id: TEST_BOOKING_ID,
              userId: TEST_USER_ID,
              status: "confirmed",
            },
          ],
        }),
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/bookings/${TEST_BOOKING_ID}/confirm`,
        headers: authHeaders,
        payload: { status: "confirmed" },
      });

      expect(res.statusCode).toBe(409);
      await app.close();
    });

    it("rejects booking for non-existent slot", async () => {
      const app = await buildTestApp({
        db: mockDb({ routeResult: [] }),
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/bookings/redirect",
        headers: authHeaders,
        payload: { slotId: "nonexistent-slot" },
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });
  });

  describe("Booking list", () => {
    it("lists user bookings with slot, court, and venue details", async () => {
      const app = await buildTestApp({
        db: mockDb({
          routeResult: [
            {
              booking: { ...testBooking, status: "confirmed" },
              slot: testSlot,
              court: testCourt,
              venue: testVenue,
            },
          ],
        }),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/bookings",
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.bookings).toHaveLength(1);
      expect(body.bookings[0].status).toBe("confirmed");
      expect(body.bookings[0].venue.name).toBe("Padel City Bangkok");
      expect(body.bookings[0].court.surface).toBe("glass");
      await app.close();
    });
  });
});
