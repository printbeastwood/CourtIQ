/**
 * E2E Concierge Flow — NL query -> preference extraction -> recommendation -> action
 *
 * Tests the AI concierge journey: user stores preferences, starts a conversation,
 * sends natural language queries, and receives personalised recommendations.
 */
import { describe, it, expect, vi, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { ChatResult } from "@courtiq/concierge";
import {
  TEST_USER_ID,
  TEST_CONVERSATION_ID,
  mockPreferenceStore,
  mockConcierge,
  buildTestApp,
  authHeaders,
} from "./helpers.js";

// ──────────────────── Tests ────────────────────

describe("E2E: Concierge Flow", () => {
  describe("Preferences -> Conversation -> NL Query -> Recommendation", () => {
    it("completes the full concierge journey", async () => {
      // Step 1: Store user preferences during onboarding
      const prefStore = mockPreferenceStore();
      const app1 = await buildTestApp({ preferenceStore: prefStore });

      const prefRes = await app1.inject({
        method: "POST",
        url: "/api/v1/preferences",
        headers: authHeaders,
        payload: {
          userId: TEST_USER_ID,
          preferences: [
            { category: "play_style", text: "I prefer competitive doubles near Sukhumvit" },
            { category: "time", text: "I usually play Saturday mornings 8-10am" },
            { category: "skill_level", text: "I enjoy playing with people at a similar level" },
          ],
        },
      });

      expect(prefRes.statusCode).toBe(201);
      expect(prefStore.storePreferences).toHaveBeenCalled();
      await app1.close();

      // Step 2: Query stored preferences via semantic search
      const prefStore2 = mockPreferenceStore({
        queryPreferences: vi.fn().mockResolvedValue([
          {
            preference: {
              id: "pref-1",
              userId: TEST_USER_ID,
              category: "play_style",
              text: "I prefer competitive doubles near Sukhumvit",
              active: true,
              createdAt: new Date(),
            },
            similarity: 0.95,
          },
          {
            preference: {
              id: "pref-2",
              userId: TEST_USER_ID,
              category: "schedule",
              text: "I usually play Saturday mornings 8-10am",
              active: true,
              createdAt: new Date(),
            },
            similarity: 0.88,
          },
        ]),
      });
      const app2 = await buildTestApp({ preferenceStore: prefStore2 });

      const queryRes = await app2.inject({
        method: "POST",
        url: "/api/v1/preferences/query",
        headers: authHeaders,
        payload: {
          userId: TEST_USER_ID,
          query: "competitive doubles Saturday",
          topK: 5,
        },
      });

      expect(queryRes.statusCode).toBe(200);
      const queryResults = queryRes.json().matches;
      expect(queryResults).toHaveLength(2);
      expect(queryResults[0].similarity).toBeGreaterThan(0.9);
      await app2.close();

      // Step 3: Start a concierge conversation
      const concierge = mockConcierge();
      const app3 = await buildTestApp({ concierge });

      const convRes = await app3.inject({
        method: "POST",
        url: "/api/v1/concierge/conversations",
        headers: authHeaders,
        payload: { userId: TEST_USER_ID },
      });

      expect(convRes.statusCode).toBeLessThan(300);
      expect(convRes.json().conversationId).toBe(TEST_CONVERSATION_ID);

      // Step 4: Send a natural language query
      const chatResult: ChatResult = {
        response:
          "Based on your preference for competitive doubles near Sukhumvit, " +
          "I found 3 courts available Saturday 8-10am:\n" +
          "1. Padel City Bangkok - Court 1 (glass, outdoor) - 800 THB\n" +
          "2. The Racquet Club - Court 3 (covered) - 1,200 THB\n" +
          "3. Sukhumvit Padel - Court 2 (indoor) - 1,500 THB\n\n" +
          "Would you like to book any of these?",
        toolsUsed: ["get_user_preferences", "search_courts", "check_availability"],
        conversationId: TEST_CONVERSATION_ID,
      };
      (concierge.chat as ReturnType<typeof vi.fn>).mockResolvedValue(chatResult);

      const msgRes = await app3.inject({
        method: "POST",
        url: `/api/v1/concierge/conversations/${TEST_CONVERSATION_ID}/messages`,
        headers: authHeaders,
        payload: {
          userId: TEST_USER_ID,
          message: "Find me a competitive doubles game this Saturday morning near Sukhumvit",
        },
      });

      expect(msgRes.statusCode).toBe(200);
      const msgBody = msgRes.json();
      expect(msgBody.response).toContain("Padel City Bangkok");
      expect(msgBody.response).toContain("competitive doubles");
      expect(msgBody.toolsUsed).toContain("get_user_preferences");
      expect(msgBody.toolsUsed).toContain("search_courts");

      // Step 5: Retrieve conversation history to verify persistence
      const historyRes = await app3.inject({
        method: "GET",
        url: `/api/v1/concierge/conversations/${TEST_CONVERSATION_ID}/messages`,
        headers: authHeaders,
      });

      expect(historyRes.statusCode).toBe(200);
      expect(historyRes.json().messages).toHaveLength(2);
      await app3.close();
    });
  });

  describe("Preference context for concierge", () => {
    it("retrieves structured preference context", async () => {
      const prefStore = mockPreferenceStore({
        getPreferenceContext: vi.fn().mockResolvedValue({
          userId: TEST_USER_ID,
          preferences: [
            {
              id: "pref-1",
              category: "play_style",
              text: "I prefer competitive doubles",
              active: true,
            },
          ],
          structured: {
            play_style: ["I prefer competitive doubles"],
            schedule: ["Saturday mornings 8-10am"],
          },
        }),
      });

      const app = await buildTestApp({ preferenceStore: prefStore });

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/users/${TEST_USER_ID}/preferences/context`,
        headers: authHeaders,
        payload: {
          query: "What are my play preferences?",
          topK: 10,
        },
      });

      expect(res.statusCode).toBe(200);
      const ctx = res.json();
      expect(ctx.structured.play_style).toContain("I prefer competitive doubles");
      await app.close();
    });
  });

  describe("Concierge error paths", () => {
    it("rejects message to non-existent conversation", async () => {
      const concierge = mockConcierge({
        chat: vi.fn().mockRejectedValue(new Error("Conversation not found")),
      });
      const app = await buildTestApp({ concierge });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/concierge/conversations/nonexistent-id/messages",
        headers: authHeaders,
        payload: {
          userId: TEST_USER_ID,
          message: "Hello",
        },
      });

      // Should get an error response (404 or 500 depending on error handling)
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      await app.close();
    });

    it("requires userId for conversation creation", async () => {
      const app = await buildTestApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/concierge/conversations",
        headers: authHeaders,
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      await app.close();
    });
  });
});
