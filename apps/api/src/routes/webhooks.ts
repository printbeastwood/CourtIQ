import type { FastifyPluginAsync } from "fastify";
import type { StripeService } from "../services/stripe.js";

export function webhookRoutes(stripeService: StripeService, webhookSecret: string): FastifyPluginAsync {
  return async (app) => {
    // Stripe webhook endpoint — receives raw body for signature verification
    app.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_req, body, done) => {
        done(null, body);
      },
    );

    app.post("/webhooks/stripe", async (request, reply) => {
      const signature = request.headers["stripe-signature"];
      if (!signature || typeof signature !== "string") {
        reply.code(400);
        return { error: "Missing stripe-signature header" };
      }

      try {
        const event = stripeService.constructWebhookEvent(
          request.body as Buffer,
          signature,
          webhookSecret,
        );

        await stripeService.handleWebhookEvent(event);
        return { received: true };
      } catch (err) {
        request.log.error(err, "Stripe webhook error");
        reply.code(400);
        return { error: "Webhook signature verification failed" };
      }
    });
  };
}
