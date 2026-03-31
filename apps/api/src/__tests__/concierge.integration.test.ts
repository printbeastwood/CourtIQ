/**
 * Integration tests for the AI Concierge routes.
 * The Concierge class is mocked — tests validate the HTTP + conversation flow.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  buildTestApp,
  mockConcierge,
  authHeaders,
  TEST_USER_ID,
  TEST_CONVERSATION_ID,
} from "./helpers.js";

describe("concierge routes", () => {
  let app: FastifyInstance;
  const concierge = mockConcierge();

  beforeAll(async () => {
    app = await buildTestApp({ concierge });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/v1/concierge/conversations — create conversation", () => {
    it("creates a new conversation and returns conversationId", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/concierge/conversations",
        headers: { ...authHeaders, "content-type": "application/json" },
        payload: { userId: TEST_USER_ID },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().conversationId).toBe(TEST_CONVERSATION_ID);
      expect(concierge.startConversation).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("rejects missing userId", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/concierge/conversations",
        headers: { ...authHeaders, "content-type": "application/json" },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /api/v1/users/:userId/concierge/conversations — list conversations", () => {
    it("returns a list of conversations for the user", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/users/${TEST_USER_ID}/concierge/conversations`,
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("conversations");
      expect(body.conversations).toHaveLength(1);
      expect(body.conversations[0].id).toBe(TEST_CONVERSATION_ID);
    });
  });

  describe("POST /api/v1/concierge/conversations/:id/messages — send message", () => {
    it("sends a booking intent and receives tool-use response", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/concierge/conversations/${TEST_CONVERSATION_ID}/messages`,
        headers: { ...authHeaders, "content-type": "application/json" },
        payload: {
          userId: TEST_USER_ID,
          message: "Find me a competitive doubles game Saturday morning near Thonglor",
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("response");
      expect(body.response).toContain("courts");
      expect(body).toHaveProperty("toolsUsed");
      expect(body.toolsUsed).toContain("search_courts");
      expect(body.toolsUsed).toContain("get_user_preferences");
      expect(body.conversationId).toBe(TEST_CONVERSATION_ID);
    });

    it("rejects missing userId or message", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/concierge/conversations/${TEST_CONVERSATION_ID}/messages`,
        headers: { ...authHeaders, "content-type": "application/json" },
        payload: { userId: TEST_USER_ID },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 404 for non-existent conversation", async () => {
      const mgr = concierge.getConversationManager();
      (mgr.getConversation as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/concierge/conversations/nonexistent-id/messages",
        headers: { ...authHeaders, "content-type": "application/json" },
        payload: { userId: TEST_USER_ID, message: "hello" },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /api/v1/concierge/conversations/:id/messages — get history", () => {
    it("returns conversation message history", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/concierge/conversations/${TEST_CONVERSATION_ID}/messages`,
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("messages");
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe("user");
      expect(body.messages[1].role).toBe("assistant");
    });

    it("returns 404 for non-existent conversation", async () => {
      const mgr = concierge.getConversationManager();
      (mgr.getConversation as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/concierge/conversations/nonexistent-id/messages",
        headers: authHeaders,
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
