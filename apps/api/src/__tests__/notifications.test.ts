import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { notificationRoutes } from "../routes/notifications.js";
import type { Db } from "@courtiq/db";
import {
  TEST_USER_ID,
  TEST_FIREBASE_UID,
  mockDb,
  authHeaders,
} from "./helpers.js";
import type { NotificationService } from "../services/notifications.js";

// ──────────────────── Mock Notification Service ────────────────────

function mockNotificationService(
  overrides: Partial<NotificationService> = {},
): NotificationService {
  return {
    scheduleNotification: vi.fn().mockResolvedValue("notif-001"),
    schedulePostMatchFeedback: vi.fn().mockResolvedValue("notif-002"),
    scheduleBookingReminder: vi.fn().mockResolvedValue("notif-003"),
    cancelNotification: vi.fn().mockResolvedValue(undefined),
    getUserNotifications: vi.fn().mockResolvedValue([
      {
        id: "notif-001",
        userId: TEST_USER_ID,
        type: "booking_reminder",
        title: "Upcoming Game",
        body: "Your session starts in 60 minutes.",
        data: { bookingId: "b-1", screen: "booking-detail" },
        status: "sent",
        scheduledFor: new Date("2026-04-01T10:00:00Z"),
        sentAt: new Date("2026-04-01T10:00:00Z"),
        errorMessage: null,
        createdAt: new Date("2026-04-01T09:00:00Z"),
      },
    ]),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as NotificationService;
}

// ──────────────────── Test Setup ────────────────────

const TEST_DEVICE_ID = "dev-token-001";
const testDevice = {
  id: TEST_DEVICE_ID,
  userId: TEST_USER_ID,
  token: "fcm-token-abc123",
  platform: "ios",
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function buildNotifApp(opts: {
  dbOverrides?: Parameters<typeof mockDb>[0];
  serviceOverrides?: Partial<NotificationService>;
} = {}): Promise<FastifyInstance> {
  const db = mockDb(opts.dbOverrides);
  const service = mockNotificationService(opts.serviceOverrides);

  const app = Fastify({ logger: false });

  await app.register(
    async (scope) => {
      scope.addHook("onRequest", async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          reply.code(401).send({ error: "Unauthorized" });
          return;
        }
        request.userId = TEST_USER_ID;
        request.firebaseUid = TEST_FIREBASE_UID;
      });

      await scope.register(notificationRoutes(db, service));
    },
    { prefix: "/api/v1" },
  );

  return app;
}

// ──────────────────── Tests ────────────────────

describe("Notification Routes", () => {
  let app: FastifyInstance;

  describe("POST /devices/register", () => {
    beforeAll(async () => {
      app = await buildNotifApp({
        dbOverrides: {
          routeResult: [], // No existing token
          insertReturn: [testDevice],
        },
      });
    });

    afterAll(() => app.close());

    it("registers a new device token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/devices/register",
        headers: authHeaders,
        payload: { token: "fcm-token-abc123", platform: "ios" },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.device).toBeDefined();
      expect(body.device.platform).toBe("ios");
    });

    it("rejects invalid platform", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/devices/register",
        headers: authHeaders,
        payload: { token: "fcm-token", platform: "windows" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/platform/);
    });

    it("rejects missing token", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/devices/register",
        headers: authHeaders,
        payload: { platform: "ios" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/token/);
    });

    it("requires auth", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/devices/register",
        payload: { token: "fcm-token", platform: "ios" },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("DELETE /devices/:tokenId", () => {
    it("deletes a device token", async () => {
      const localApp = await buildNotifApp({
        dbOverrides: { deleteReturn: [testDevice] },
      });

      const res = await localApp.inject({
        method: "DELETE",
        url: `/api/v1/devices/${TEST_DEVICE_ID}`,
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      await localApp.close();
    });

    it("returns 404 for non-existent token", async () => {
      const localApp = await buildNotifApp({
        dbOverrides: { deleteReturn: [] },
      });

      const res = await localApp.inject({
        method: "DELETE",
        url: "/api/v1/devices/nonexistent-id",
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(404);
      await localApp.close();
    });
  });

  describe("GET /devices", () => {
    it("lists registered devices", async () => {
      const localApp = await buildNotifApp({
        dbOverrides: {
          routeResult: [
            { id: TEST_DEVICE_ID, platform: "ios", createdAt: new Date() },
          ],
        },
      });

      const res = await localApp.inject({
        method: "GET",
        url: "/api/v1/devices",
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().devices).toHaveLength(1);
      expect(res.json().devices[0].platform).toBe("ios");
      await localApp.close();
    });
  });

  describe("GET /notifications", () => {
    it("returns notification history", async () => {
      const localApp = await buildNotifApp();

      const res = await localApp.inject({
        method: "GET",
        url: "/api/v1/notifications",
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().notifications).toHaveLength(1);
      expect(res.json().notifications[0].type).toBe("booking_reminder");
      await localApp.close();
    });
  });

  describe("POST /notifications/send", () => {
    it("schedules a notification", async () => {
      const localApp = await buildNotifApp();

      const res = await localApp.inject({
        method: "POST",
        url: "/api/v1/notifications/send",
        headers: authHeaders,
        payload: {
          type: "system",
          title: "Test Notification",
          body: "This is a test.",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().notificationId).toBe("notif-001");
      await localApp.close();
    });

    it("rejects invalid type", async () => {
      const localApp = await buildNotifApp();

      const res = await localApp.inject({
        method: "POST",
        url: "/api/v1/notifications/send",
        headers: authHeaders,
        payload: {
          type: "invalid_type",
          title: "Test",
          body: "Test",
        },
      });

      expect(res.statusCode).toBe(400);
      await localApp.close();
    });

    it("rejects missing title/body", async () => {
      const localApp = await buildNotifApp();

      const res = await localApp.inject({
        method: "POST",
        url: "/api/v1/notifications/send",
        headers: authHeaders,
        payload: { type: "system" },
      });

      expect(res.statusCode).toBe(400);
      await localApp.close();
    });
  });

  describe("DELETE /notifications/:notificationId", () => {
    it("cancels a pending notification", async () => {
      const localApp = await buildNotifApp({
        dbOverrides: {
          routeResult: [{ userId: TEST_USER_ID, status: "pending" }],
        },
      });

      const res = await localApp.inject({
        method: "DELETE",
        url: "/api/v1/notifications/notif-001",
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      await localApp.close();
    });

    it("rejects cancelling a sent notification", async () => {
      const localApp = await buildNotifApp({
        dbOverrides: {
          routeResult: [{ userId: TEST_USER_ID, status: "sent" }],
        },
      });

      const res = await localApp.inject({
        method: "DELETE",
        url: "/api/v1/notifications/notif-001",
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/pending/);
      await localApp.close();
    });

    it("returns 404 for unknown notification", async () => {
      const localApp = await buildNotifApp({
        dbOverrides: { routeResult: [] },
      });

      const res = await localApp.inject({
        method: "DELETE",
        url: "/api/v1/notifications/nonexistent",
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(404);
      await localApp.close();
    });
  });
});
