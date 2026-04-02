/**
 * E2E Rating + Feedback Flow — Record match -> submit feedback -> rating update
 *
 * Tests the post-match journey: match result is recorded, ratings are updated,
 * player submits feedback (satisfaction + opponent skill), and stats accumulate.
 */
import { describe, it, expect, vi, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  TEST_USER_ID,
  TEST_MATCH_ID,
  TEST_OPPONENT_ID,
  TEST_BOOKING_ID,
  mockDb,
  mockRatingService,
  buildTestApp,
  authHeaders,
} from "./helpers.js";

// ──────────────────── Tests ────────────────────

describe("E2E: Rating + Feedback Flow", () => {
  describe("Match -> Rating update -> Feedback -> Stats", () => {
    it("completes the full post-match flow", async () => {
      // Step 1: Record match result
      const ratingService = mockRatingService();
      const app1 = await buildTestApp({ ratingService });

      const matchRes = await app1.inject({
        method: "POST",
        url: "/api/v1/matches/result",
        headers: authHeaders,
        payload: {
          opponentId: TEST_OPPONENT_ID,
          format: "doubles",
          player1Score: 6,
          player2Score: 3,
          playedAt: "2026-04-01T10:00:00Z",
        },
      });

      expect(matchRes.statusCode).toBe(200);
      const matchBody = matchRes.json();
      expect(matchBody.match.player1Id).toBe(TEST_USER_ID);
      expect(matchBody.match.player2Id).toBe(TEST_OPPONENT_ID);
      expect(matchBody.match.winnerId).toBe(TEST_USER_ID);
      expect(matchBody.ratingChanges.you.ratingAfter).toBe(1530);
      expect(matchBody.ratingChanges.opponent.ratingAfter).toBe(1470);

      const matchId = matchBody.match.id;
      await app1.close();

      // Step 2: Verify updated rating
      const ratingService2 = mockRatingService({
        getPlayerRating: vi.fn().mockResolvedValue({
          rating: {
            playerId: TEST_USER_ID,
            format: "doubles",
            rating: 1530,
            rd: 320,
            gamesPlayed: 1,
            lastMatchAt: new Date("2026-04-01T10:00:00Z"),
            volatility: 0.059,
          },
          confidence: 0.25,
        }),
      });
      const app2 = await buildTestApp({ ratingService: ratingService2 });

      const ratingRes = await app2.inject({
        method: "GET",
        url: `/api/v1/players/${TEST_USER_ID}/rating`,
        query: { format: "doubles" },
        headers: authHeaders,
      });

      expect(ratingRes.statusCode).toBe(200);
      const ratingBody = ratingRes.json();
      expect(ratingBody.rating).toBe(1530);
      expect(ratingBody.gamesPlayed).toBe(1);
      expect(ratingBody.confidence).toBe(0.25);
      await app2.close();

      // Step 3: Submit post-match feedback
      const feedbackEntry = {
        id: "fb-001",
        matchId,
        playerId: TEST_USER_ID,
        satisfaction: "great",
        freeText: "Great game, opponent was well matched",
        issueCategories: [],
        opponentSkillRating: "about_right",
        opponentId: TEST_OPPONENT_ID,
        bookingId: null,
        createdAt: new Date(),
      };

      const app3 = await buildTestApp({
        db: mockDb({
          routeResult: [], // No existing feedback (duplicate check)
          insertReturn: [feedbackEntry],
        }),
      });

      const feedbackRes = await app3.inject({
        method: "POST",
        url: `/api/v1/matches/${matchId}/feedback`,
        headers: authHeaders,
        payload: {
          satisfaction: "great",
          freeText: "Great game, opponent was well matched",
          opponentSkillRating: "about_right",
          opponentId: TEST_OPPONENT_ID,
        },
      });

      expect(feedbackRes.statusCode).toBe(200);
      const fbBody = feedbackRes.json();
      expect(fbBody.feedback.satisfaction).toBe("great");
      expect(fbBody.feedback.opponentSkillRating).toBe("about_right");
      await app3.close();

      // Step 4: Check accumulated feedback stats
      const app4 = await buildTestApp({
        db: mockDb({
          routeResult: [
            { satisfaction: "great", count: 1 },
          ],
        }),
      });

      const statsRes = await app4.inject({
        method: "GET",
        url: `/api/v1/players/${TEST_USER_ID}/feedback-stats`,
        headers: authHeaders,
      });

      expect(statsRes.statusCode).toBe(200);
      const statsBody = statsRes.json();
      expect(statsBody.total).toBe(1);
      expect(statsBody.great).toBe(1);
      expect(statsBody.satisfactionRate).toBe(100);
      await app4.close();
    });
  });

  describe("Rating error paths", () => {
    it("rejects self-match", async () => {
      const app = await buildTestApp({ ratingService: mockRatingService() });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/matches/result",
        headers: authHeaders,
        payload: {
          opponentId: TEST_USER_ID, // same as authenticated user
          format: "doubles",
          player1Score: 6,
          player2Score: 3,
          playedAt: "2026-04-01T10:00:00Z",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/yourself/);
      await app.close();
    });

    it("rejects match missing required fields", async () => {
      const app = await buildTestApp({ ratingService: mockRatingService() });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/matches/result",
        headers: authHeaders,
        payload: {
          opponentId: TEST_OPPONENT_ID,
          // Missing format, scores, playedAt
        },
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });

  describe("Feedback error paths", () => {
    it("rejects invalid satisfaction value", async () => {
      const app = await buildTestApp({ db: mockDb() });

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/matches/${TEST_MATCH_ID}/feedback`,
        headers: authHeaders,
        payload: {
          satisfaction: "amazing", // invalid
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/satisfaction/);
      await app.close();
    });

    it("rejects duplicate feedback for the same match", async () => {
      const app = await buildTestApp({
        db: mockDb({
          routeResult: [{ id: "existing-fb" }], // feedback already exists
        }),
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/matches/${TEST_MATCH_ID}/feedback`,
        headers: authHeaders,
        payload: {
          satisfaction: "great",
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/already/i);
      await app.close();
    });

    it("rejects invalid opponent skill rating", async () => {
      const app = await buildTestApp({
        db: mockDb({ routeResult: [] }),
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/matches/${TEST_MATCH_ID}/feedback`,
        headers: authHeaders,
        payload: {
          satisfaction: "great",
          opponentSkillRating: "way_too_good", // invalid
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/opponentSkillRating/);
      await app.close();
    });
  });

  describe("Rating queries", () => {
    it("returns all format ratings (singles + doubles)", async () => {
      const ratingService = mockRatingService({
        getAllRatings: vi.fn().mockResolvedValue({
          singles: { rating: 1450, rd: 300, gamesPlayed: 3 },
          doubles: { rating: 1530, rd: 320, gamesPlayed: 1 },
        }),
      });
      const app = await buildTestApp({ ratingService });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/players/${TEST_USER_ID}/ratings`,
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ratings.singles.rating).toBe(1450);
      expect(body.ratings.doubles.rating).toBe(1530);
      await app.close();
    });

    it("returns rating history for chart display", async () => {
      const history = [
        { rating: 1500, rd: 350, matchId: "m1", playedAt: "2026-03-28" },
        { rating: 1530, rd: 320, matchId: "m2", playedAt: "2026-04-01" },
      ];
      const ratingService = mockRatingService({
        getRatingHistory: vi.fn().mockResolvedValue(history),
      });
      const app = await buildTestApp({ ratingService });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/players/${TEST_USER_ID}/rating-history`,
        query: { format: "doubles", limit: "10" },
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().history).toHaveLength(2);
      await app.close();
    });
  });
});
