/**
 * Integration tests for the Preference Store routes.
 * PreferenceStore methods are mocked (the store itself needs Voyage + Anthropic).
 * Tests validate the full HTTP request → route → store → response chain.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  buildTestApp,
  mockPreferenceStore,
  authHeaders,
  TEST_USER_ID,
} from "./helpers.js";

describe("preference routes", () => {
  let app: FastifyInstance;
  const store = mockPreferenceStore();

  beforeAll(async () => {
    app = await buildTestApp({ preferenceStore: store });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/v1/preferences — store preferences", () => {
    it("stores preferences and returns 201", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/preferences",
        headers: { ...authHeaders, "content-type": "application/json" },
        payload: {
          userId: TEST_USER_ID,
          preferences: [
            { text: "I prefer competitive doubles on glass courts" },
            { text: "I like playing in the morning before 9am", category: "time" },
          ],
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty("preferences");
      expect(Array.isArray(body.preferences)).toBe(true);
      expect(store.storePreferences).toHaveBeenCalledWith(TEST_USER_ID, [
        { text: "I prefer competitive doubles on glass courts" },
        { text: "I like playing in the morning before 9am", category: "time" },
      ]);
    });

    it("rejects invalid input (missing userId)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/preferences",
        headers: { ...authHeaders, "content-type": "application/json" },
        payload: { preferences: [{ text: "test" }] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error");
    });
  });

  describe("POST /api/v1/preferences/query — semantic search", () => {
    it("returns semantically matched preferences", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/preferences/query",
        headers: { ...authHeaders, "content-type": "application/json" },
        payload: {
          userId: TEST_USER_ID,
          query: "What does this user prefer for doubles partners?",
          topK: 5,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("matches");
      expect(body.matches[0]).toHaveProperty("similarity");
      expect(body.matches[0].similarity).toBeGreaterThan(0.5);
      expect(store.queryPreferences).toHaveBeenCalledWith(
        TEST_USER_ID,
        "What does this user prefer for doubles partners?",
        { topK: 5, categories: undefined }
      );
    });

    it("accepts category filter", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/preferences/query",
        headers: { ...authHeaders, "content-type": "application/json" },
        payload: {
          userId: TEST_USER_ID,
          query: "time preferences",
          categories: ["time", "location"],
        },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/v1/users/:userId/preferences — bulk retrieve", () => {
    it("returns all active preferences for a user", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/users/${TEST_USER_ID}/preferences`,
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("preferences");
      expect(Array.isArray(body.preferences)).toBe(true);
    });
  });

  describe("POST /api/v1/users/:userId/preferences/context — concierge context", () => {
    it("returns structured preference context for concierge", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/users/${TEST_USER_ID}/preferences/context`,
        headers: { ...authHeaders, "content-type": "application/json" },
        payload: { query: "Find me a competitive doubles game", topK: 5 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("structured");
      expect(body.structured).toHaveProperty("play_style");
    });

    it("rejects missing query", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/users/${TEST_USER_ID}/preferences/context`,
        headers: { ...authHeaders, "content-type": "application/json" },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/v1/users/:userId/preferences/:prefId — deactivate", () => {
    it("deactivates a preference", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${TEST_USER_ID}/preferences/pref-1`,
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it("returns 404 for non-existent preference", async () => {
      (store.deactivatePreference as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${TEST_USER_ID}/preferences/nonexistent`,
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/v1/users/:userId/preferences — GDPR delete all", () => {
    it("deletes all preferences and returns count", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${TEST_USER_ID}/preferences`,
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().deleted).toBe(1);
    });
  });

  describe("GET /api/v1/users/:userId/preferences/export — GDPR export", () => {
    it("exports all preferences (including inactive)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/users/${TEST_USER_ID}/preferences/export`,
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty("preferences");
    });
  });
});
