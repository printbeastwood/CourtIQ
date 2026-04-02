import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ReflinkService } from "../services/reflink.js";

const createReflinkSchema = z.object({
  userId: z.string().uuid(),
  tier: z.enum(["player", "influencer", "venue", "coach"]),
  customCode: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Code must be lowercase alphanumeric with hyphens")
    .optional(),
});

const attributeSignupSchema = z.object({
  reflinkCode: z.string(),
  referredUserId: z.string().uuid(),
});

const recordBookingSchema = z.object({
  referredUserId: z.string().uuid(),
  bookingId: z.string().uuid(),
  bookingAmountCents: z.number().int().positive(),
});

const approvePayoutsSchema = z.object({
  payoutIds: z.array(z.string().uuid()).min(1),
});

export function reflinkRoutes(reflinkService: ReflinkService): FastifyPluginAsync {
  return async (app) => {
    // Create a reflink
    app.post("/reflinks", async (request, reply) => {
      const parsed = createReflinkSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: { code: "INVALID_INPUT", message: parsed.error.flatten() } };
      }

      try {
        const reflink = await reflinkService.createReflink(
          parsed.data.userId,
          parsed.data.tier,
          parsed.data.customCode
        );
        reply.code(201);
        return { data: reflink };
      } catch (err) {
        if (err instanceof Error && err.message.includes("unique")) {
          reply.code(409);
          return { error: { code: "CODE_TAKEN", message: "This reflink code is already in use" } };
        }
        throw err;
      }
    });

    // Get reflink by code (public — used for link resolution)
    app.get<{ Params: { code: string } }>("/reflinks/:code", async (request, reply) => {
      const reflink = await reflinkService.getReflink(request.params.code);
      if (!reflink) {
        reply.code(404);
        return { error: { code: "NOT_FOUND", message: "Reflink not found" } };
      }
      return { data: reflink };
    });

    // Track click on a reflink
    app.post<{ Params: { code: string } }>("/reflinks/:code/click", async (request, reply) => {
      const reflink = await reflinkService.trackClick(request.params.code);
      if (!reflink) {
        reply.code(404);
        return { error: { code: "NOT_FOUND", message: "Reflink not found or inactive" } };
      }
      return { data: { clicks: reflink.clicks } };
    });

    // Get user's reflinks
    app.get<{ Params: { userId: string } }>("/users/:userId/reflinks", async (request, reply) => {
      const reflinks = await reflinkService.getUserReflinks(request.params.userId);
      return { data: reflinks };
    });

    // Deactivate a reflink
    app.delete<{ Params: { reflinkId: string }; Querystring: { userId: string } }>(
      "/reflinks/:reflinkId",
      async (request, reply) => {
        const userId = (request.query as { userId?: string }).userId;
        if (!userId) {
          reply.code(400);
          return { error: { code: "INVALID_INPUT", message: "userId query param required" } };
        }

        const success = await reflinkService.deactivateReflink(request.params.reflinkId, userId);
        if (!success) {
          reply.code(404);
          return { error: { code: "NOT_FOUND", message: "Reflink not found" } };
        }
        return { data: { deactivated: true } };
      }
    );

    // Attribute a signup to a reflink
    app.post("/referrals/attribute", async (request, reply) => {
      const parsed = attributeSignupSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: { code: "INVALID_INPUT", message: parsed.error.flatten() } };
      }

      const referral = await reflinkService.attributeSignup(
        parsed.data.reflinkCode,
        parsed.data.referredUserId
      );

      if (!referral) {
        reply.code(400);
        return { error: { code: "ATTRIBUTION_FAILED", message: "Reflink invalid or expired" } };
      }

      reply.code(201);
      return { data: referral };
    });

    // Record a booking for referral tracking
    app.post("/referrals/booking", async (request, reply) => {
      const parsed = recordBookingSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: { code: "INVALID_INPUT", message: parsed.error.flatten() } };
      }

      await reflinkService.recordBookingForReferral(
        parsed.data.referredUserId,
        parsed.data.bookingId,
        parsed.data.bookingAmountCents
      );

      return { data: { recorded: true } };
    });

    // Get referral dashboard for a user
    app.get<{ Params: { userId: string } }>(
      "/users/:userId/reflinks/dashboard",
      async (request, reply) => {
        const dashboards = await reflinkService.getDashboard(request.params.userId);
        return { data: dashboards };
      }
    );

    // Get pending payouts
    app.get<{ Params: { userId: string } }>(
      "/users/:userId/payouts/pending",
      async (request, reply) => {
        const payouts = await reflinkService.getPendingPayouts(request.params.userId);
        return { data: payouts };
      }
    );

    // Approve payouts (admin)
    app.post("/payouts/approve", async (request, reply) => {
      const parsed = approvePayoutsSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: { code: "INVALID_INPUT", message: parsed.error.flatten() } };
      }

      const approved = await reflinkService.approvePayouts(parsed.data.payoutIds);
      return { data: { approved } };
    });

    // Mark payout as paid
    app.post<{ Params: { payoutId: string } }>(
      "/payouts/:payoutId/paid",
      async (request, reply) => {
        const success = await reflinkService.markPayoutPaid(request.params.payoutId);
        if (!success) {
          reply.code(400);
          return { error: { code: "INVALID_STATE", message: "Payout must be approved before marking paid" } };
        }
        return { data: { paid: true } };
      }
    );
  };
}
