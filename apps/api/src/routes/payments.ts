import type { FastifyPluginAsync } from "fastify";
import { eq, desc } from "drizzle-orm";
import { payments } from "@courtiq/db";
import type { StripeService } from "../services/stripe.js";

export function paymentRoutes(stripeService: StripeService): FastifyPluginAsync {
  return async (app) => {
    // Create payment intent for a booking
    app.post<{ Body: { bookingId: string } }>("/payments/create-intent", async (request, reply) => {
      const { bookingId } = request.body;
      if (!bookingId) {
        reply.code(400);
        return { error: { code: "MISSING_BOOKING_ID", message: "bookingId is required" } };
      }

      try {
        const result = await stripeService.createPaymentIntent(bookingId);
        return { data: result };
      } catch (err) {
        request.log.error(err, "Failed to create payment intent");
        reply.code(400);
        return { error: { code: "PAYMENT_ERROR", message: err instanceof Error ? err.message : "Payment failed" } };
      }
    });

    // Request refund for a payment
    app.post<{ Params: { id: string }; Body: { amountCents?: number } }>(
      "/payments/:id/refund",
      async (request, reply) => {
        const { id } = request.params;
        const { amountCents } = request.body ?? {};

        try {
          await stripeService.processRefund(id, amountCents);
          return { data: { success: true } };
        } catch (err) {
          request.log.error(err, "Failed to process refund");
          reply.code(400);
          return { error: { code: "REFUND_ERROR", message: err instanceof Error ? err.message : "Refund failed" } };
        }
      },
    );

    // Get payment by booking ID
    app.get<{ Params: { bookingId: string } }>(
      "/bookings/:bookingId/payment",
      async (request, reply) => {
        const { bookingId } = request.params;
        const [payment] = await stripeService["db"]
          .select()
          .from(payments)
          .where(eq(payments.bookingId, bookingId))
          .orderBy(desc(payments.createdAt))
          .limit(1);

        if (!payment) {
          reply.code(404);
          return { error: { code: "NOT_FOUND", message: "No payment found for this booking" } };
        }

        return {
          data: {
            id: payment.id,
            status: payment.status,
            amountCents: payment.amountCents,
            commissionCents: payment.commissionCents,
            venuePayoutCents: payment.venuePayoutCents,
            currency: payment.currency,
            refundedAmountCents: payment.refundedAmountCents,
            createdAt: payment.createdAt,
          },
        };
      },
    );
  };
}
