import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import type { Db } from "@courtiq/db";
import { deviceTokens, notifications } from "@courtiq/db/schema";
import type { DevicePlatform, NotificationType } from "@courtiq/shared";
import type { NotificationService } from "../services/notifications.js";

const VALID_PLATFORMS: DevicePlatform[] = ["ios", "android"];
const VALID_TYPES: NotificationType[] = [
  "post_match_feedback",
  "booking_reminder",
  "match_invite",
  "system",
];

export function notificationRoutes(
  db: Db,
  notificationService: NotificationService,
): FastifyPluginAsync {
  return async (app) => {
    // Register a device token for push notifications
    app.post<{
      Body: { token: string; platform: DevicePlatform };
    }>("/devices/register", async (request, reply) => {
      const { token, platform } = request.body ?? {};

      if (!token || typeof token !== "string") {
        reply.code(400);
        return { error: "token is required" };
      }

      if (!platform || !VALID_PLATFORMS.includes(platform)) {
        reply.code(400);
        return { error: "platform must be one of: ios, android" };
      }

      // Upsert: if this token already exists (maybe for a different user), update it
      const existing = await db
        .select({ id: deviceTokens.id, userId: deviceTokens.userId })
        .from(deviceTokens)
        .where(eq(deviceTokens.token, token))
        .limit(1);

      if (existing.length > 0) {
        // Re-assign token to current user if needed
        if (existing[0].userId !== request.userId) {
          await db
            .update(deviceTokens)
            .set({
              userId: request.userId,
              platform,
              updatedAt: new Date(),
            })
            .where(eq(deviceTokens.id, existing[0].id));
        }
        return { device: { id: existing[0].id, token, platform } };
      }

      const [device] = await db
        .insert(deviceTokens)
        .values({
          userId: request.userId,
          token,
          platform,
        })
        .returning();

      reply.code(201);
      return { device: { id: device.id, token: device.token, platform: device.platform } };
    });

    // Remove a device token
    app.delete<{
      Params: { tokenId: string };
    }>("/devices/:tokenId", async (request, reply) => {
      const { tokenId } = request.params;

      const deleted = await db
        .delete(deviceTokens)
        .where(
          and(
            eq(deviceTokens.id, tokenId),
            eq(deviceTokens.userId, request.userId),
          ),
        )
        .returning();

      if (deleted.length === 0) {
        reply.code(404);
        return { error: "Device token not found" };
      }

      return { success: true };
    });

    // Get user's registered devices
    app.get("/devices", async (request) => {
      const devices = await db
        .select({
          id: deviceTokens.id,
          platform: deviceTokens.platform,
          createdAt: deviceTokens.createdAt,
        })
        .from(deviceTokens)
        .where(eq(deviceTokens.userId, request.userId));

      return { devices };
    });

    // Get user's notification history
    app.get<{
      Querystring: { limit?: string; type?: NotificationType };
    }>("/notifications", async (request) => {
      const limit = parseInt(request.query.limit ?? "20", 10);

      const rows = await notificationService.getUserNotifications(
        request.userId,
        Math.min(limit, 100),
      );

      return { notifications: rows };
    });

    // Send a test notification (useful for debugging, gated to own user)
    app.post<{
      Body: {
        type: NotificationType;
        title: string;
        body: string;
        data?: Record<string, unknown>;
        sendAt?: string;
      };
    }>("/notifications/send", async (request, reply) => {
      const { type, title, body, data, sendAt } = request.body ?? {};

      if (!type || !VALID_TYPES.includes(type)) {
        reply.code(400);
        return { error: `type must be one of: ${VALID_TYPES.join(", ")}` };
      }

      if (!title || !body) {
        reply.code(400);
        return { error: "title and body are required" };
      }

      const notificationId = await notificationService.scheduleNotification({
        userId: request.userId,
        type,
        title,
        body,
        data,
        sendAt: sendAt ? new Date(sendAt) : undefined,
      });

      reply.code(201);
      return { notificationId };
    });

    // Cancel a scheduled notification
    app.delete<{
      Params: { notificationId: string };
    }>("/notifications/:notificationId", async (request, reply) => {
      const { notificationId } = request.params;

      // Verify ownership
      const [notification] = await db
        .select({ userId: notifications.userId, status: notifications.status })
        .from(notifications)
        .where(eq(notifications.id, notificationId))
        .limit(1);

      if (!notification) {
        reply.code(404);
        return { error: "Notification not found" };
      }

      if (notification.userId !== request.userId) {
        reply.code(403);
        return { error: "Not authorized" };
      }

      if (notification.status !== "pending") {
        reply.code(400);
        return { error: "Only pending notifications can be cancelled" };
      }

      await notificationService.cancelNotification(notificationId);
      return { success: true };
    });
  };
}
