import { eq, sql } from "drizzle-orm";
import type { Db } from "@courtiq/db";
import { deviceTokens, notifications } from "@courtiq/db/schema";
import type { ScheduleNotificationInput, NotificationType } from "@courtiq/shared";
import { Queue, Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import type { messaging } from "firebase-admin";

interface NotificationJobData {
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

const QUEUE_NAME = "notifications";

export class NotificationService {
  private queue: Queue;
  private worker: Worker | null = null;
  private db: Db;
  private fcm: messaging.Messaging | null;

  constructor(opts: {
    db: Db;
    redis: Redis;
    fcm: messaging.Messaging | null;
  }) {
    this.db = opts.db;
    this.fcm = opts.fcm;

    this.queue = new Queue(QUEUE_NAME, {
      connection: opts.redis,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });

    this.worker = new Worker<NotificationJobData>(
      QUEUE_NAME,
      async (job) => this.processJob(job),
      { connection: opts.redis, concurrency: 10 },
    );

    this.worker.on("failed", (job, err) => {
      console.error(`Notification job ${job?.id} failed:`, err.message);
    });
  }

  async scheduleNotification(input: ScheduleNotificationInput): Promise<string> {
    const [notification] = await this.db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        status: "pending",
        scheduledFor: input.sendAt ?? new Date(),
      })
      .returning();

    const jobData: NotificationJobData = {
      notificationId: notification.id,
      userId: input.userId,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
    };

    const delay = input.sendAt
      ? Math.max(0, input.sendAt.getTime() - Date.now())
      : 0;

    await this.queue.add("send", jobData, {
      delay,
      jobId: notification.id,
    });

    return notification.id;
  }

  async schedulePostMatchFeedback(
    userId: string,
    matchId: string,
    delayMinutes = 30,
  ): Promise<string> {
    const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    return this.scheduleNotification({
      userId,
      type: "post_match_feedback",
      title: "How was your match?",
      body: "Rate your experience and help us improve your future games.",
      data: { matchId, screen: "post-match-feedback" },
      sendAt,
    });
  }

  async scheduleBookingReminder(
    userId: string,
    bookingId: string,
    startsAt: Date,
    venueName: string,
    minutesBefore = 60,
  ): Promise<string> {
    const sendAt = new Date(startsAt.getTime() - minutesBefore * 60 * 1000);
    return this.scheduleNotification({
      userId,
      type: "booking_reminder",
      title: "Upcoming Game",
      body: `Your session at ${venueName} starts in ${minutesBefore} minutes.`,
      data: { bookingId, screen: "booking-detail" },
      sendAt,
    });
  }

  async cancelNotification(notificationId: string): Promise<void> {
    await this.queue.remove(notificationId);
    await this.db
      .update(notifications)
      .set({ status: "cancelled" })
      .where(eq(notifications.id, notificationId));
  }

  async getUserNotifications(
    userId: string,
    limit = 20,
  ): Promise<typeof notifications.$inferSelect[]> {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(sql`${notifications.createdAt} DESC`)
      .limit(limit);
  }

  private async processJob(job: Job<NotificationJobData>): Promise<void> {
    const { notificationId, userId, title, body, data } = job.data;

    const tokens = await this.db
      .select({ token: deviceTokens.token })
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, userId));

    if (tokens.length === 0) {
      await this.db
        .update(notifications)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(notifications.id, notificationId));
      return; // No devices registered — mark sent (nothing to deliver to)
    }

    if (!this.fcm) {
      console.warn("FCM not configured — skipping push delivery");
      await this.db
        .update(notifications)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(notifications.id, notificationId));
      return;
    }

    const tokenList = tokens.map((t) => t.token);

    try {
      const response = await this.fcm.sendEachForMulticast({
        tokens: tokenList,
        notification: { title, body },
        data: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)]),
        ),
      });

      // Remove tokens that are no longer valid
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (
          !resp.success &&
          resp.error?.code &&
          [
            "messaging/invalid-registration-token",
            "messaging/registration-token-not-registered",
          ].includes(resp.error.code)
        ) {
          failedTokens.push(tokenList[idx]);
        }
      });

      if (failedTokens.length > 0) {
        await this.db
          .delete(deviceTokens)
          .where(sql`${deviceTokens.token} = ANY(${failedTokens})`);
      }

      await this.db
        .update(notifications)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(notifications.id, notificationId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown FCM error";
      await this.db
        .update(notifications)
        .set({ status: "failed", errorMessage: message })
        .where(eq(notifications.id, notificationId));
      throw err; // Let BullMQ retry
    }
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}
