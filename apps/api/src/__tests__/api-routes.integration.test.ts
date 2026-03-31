/**
 * Integration tests for API routes: venues, slots, bookings, health, feedback, ratings.
 * Uses Fastify inject() with mocked DB and auth to test the full HTTP layer.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  buildTestApp,
  mockDb,
  authHeaders,
  testVenue,
  testCourt,
  testSlot,
  testBooking,
  TEST_USER_ID,
  TEST_VENUE_ID,
  TEST_SLOT_ID,
  TEST_BOOKING_ID,
  TEST_MATCH_ID,
  TEST_OPPONENT_ID,
} from "./helpers.js";

// ──────────────────── Venue Routes ────────────────────

describe("GET /api/v1/venues", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const db = mockDb({ routeResult: [testVenue] });
    app = await buildTestApp({ db });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without auth header", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/venues" });
    expect(res.statusCode).toBe(401);
  });

  it("returns venues list with auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/venues",
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("venues");
    expect(Array.isArray(body.venues)).toBe(true);
  });

  it("accepts lat/lng query params for location search", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/venues?lat=13.75&lng=100.50&radiusKm=10",
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(200);
  });

  it("accepts search query param", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/venues?search=Padel",
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /api/v1/venues/:id", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const db = mockDb({ routeResult: [testVenue] });
    app = await buildTestApp({ db });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns venue detail with courts", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/venues/${TEST_VENUE_ID}`,
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(200);
  });
});

// ──────────────────── Booking Routes ────────────────────

describe("POST /api/v1/bookings/redirect", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const db = mockDb({
      // The booking route uses innerJoin chain, which now resolves to routeResult
      routeResult: [{ slot: testSlot, court: testCourt, venue: testVenue }],
      insertReturn: [testBooking],
    });
    app = await buildTestApp({ db });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 400 when slotId is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/bookings/redirect",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("creates a redirect booking and returns booking URL", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/bookings/redirect",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: { slotId: TEST_SLOT_ID },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("booking");
    expect(body.booking.status).toBe("pending");
    expect(body.booking.bookingMethod).toBe("redirect");
    expect(body).toHaveProperty("bookingUrl");
    expect(body.bookingUrl).toContain("playtomic.io");
  });
});

describe("PATCH /api/v1/bookings/:id/confirm", () => {
  it("rejects invalid status values", async () => {
    const db = mockDb();
    const app = await buildTestApp({ db });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/bookings/${TEST_BOOKING_ID}/confirm`,
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: { status: "invalid" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("confirms a pending booking", async () => {
    const db = mockDb({
      routeResult: [testBooking],
      updateReturn: [{ ...testBooking, status: "confirmed" }],
    });
    const app = await buildTestApp({ db });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/bookings/${TEST_BOOKING_ID}/confirm`,
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: { status: "confirmed" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().booking.status).toBe("confirmed");
    await app.close();
  });
});

// ──────────────────── Rating Routes ────────────────────

describe("rating routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /players/:id/rating returns rating with confidence", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/players/${TEST_USER_ID}/rating?format=doubles`,
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.rating).toBe(1500);
    expect(body.format).toBe("doubles");
    expect(typeof body.confidence).toBe("number");
  });

  it("GET /players/:id/ratings returns all formats", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/players/${TEST_USER_ID}/ratings`,
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("ratings");
  });

  it("POST /matches/result records match and returns rating changes", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/matches/result",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: {
        opponentId: TEST_OPPONENT_ID,
        format: "doubles",
        player1Score: 6,
        player2Score: 3,
        playedAt: "2026-04-01T10:00:00Z",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("match");
    expect(body).toHaveProperty("ratingChanges");
    expect(body.ratingChanges.you.ratingAfter).toBeGreaterThan(body.ratingChanges.you.ratingBefore);
  });

  it("POST /matches/result rejects self-matches", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/matches/result",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: {
        opponentId: TEST_USER_ID,
        format: "doubles",
        player1Score: 6,
        player2Score: 3,
        playedAt: "2026-04-01T10:00:00Z",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("yourself");
  });
});

// ──────────────────── Feedback Routes ────────────────────

describe("feedback routes", () => {
  it("POST /matches/:matchId/feedback validates satisfaction", async () => {
    const db = mockDb();
    const app = await buildTestApp({ db });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/matches/${TEST_MATCH_ID}/feedback`,
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: { satisfaction: "terrible" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("satisfaction");
    await app.close();
  });

  it("POST /matches/:matchId/feedback creates feedback", async () => {
    const feedbackRow = {
      id: "fb-1",
      matchId: TEST_MATCH_ID,
      playerId: TEST_USER_ID,
      satisfaction: "great",
      freeText: "Amazing match!",
      issueCategories: [],
      opponentSkillRating: "about_right",
      opponentId: TEST_OPPONENT_ID,
      preferenceExtracted: false,
      createdAt: new Date(),
    };
    // routeResult: empty → no existing feedback (duplicate check)
    const db = mockDb({
      routeResult: [],
      insertReturn: [feedbackRow],
    });
    const app = await buildTestApp({ db });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/matches/${TEST_MATCH_ID}/feedback`,
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: {
        satisfaction: "great",
        freeText: "Amazing match!",
        opponentSkillRating: "about_right",
        opponentId: TEST_OPPONENT_ID,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().feedback.satisfaction).toBe("great");
    await app.close();
  });

  it("POST /feedback creates standalone feedback without match", async () => {
    const feedbackRow = {
      id: "fb-2",
      playerId: TEST_USER_ID,
      satisfaction: "okay",
      freeText: "Court was slippery",
      issueCategories: ["court_quality"],
      createdAt: new Date(),
    };
    const db = mockDb({ insertReturn: [feedbackRow] });
    const app = await buildTestApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/feedback",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: {
        satisfaction: "okay",
        freeText: "Court was slippery",
        issueCategories: ["court_quality"],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().feedback.satisfaction).toBe("okay");
    await app.close();
  });

  it("GET /players/:id/feedback-stats returns aggregated stats", async () => {
    const db = mockDb({
      routeResult: [
        { satisfaction: "great", count: 8 },
        { satisfaction: "okay", count: 2 },
      ],
    });
    const app = await buildTestApp({ db });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/players/${TEST_USER_ID}/feedback-stats`,
      headers: authHeaders,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(10);
    expect(body.great).toBe(8);
    expect(body.satisfactionRate).toBe(80);
    await app.close();
  });
});
