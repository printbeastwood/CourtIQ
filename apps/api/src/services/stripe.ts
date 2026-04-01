import Stripe from "stripe";
import { eq } from "drizzle-orm";
import type { Db } from "@courtiq/db";
import { venues, bookings, payments, availabilitySlots, courts } from "@courtiq/db";

const DEFAULT_COMMISSION_RATE = 0.05; // 5%
const PROMO_COMMISSION_RATE = 0; // 0% for first 90 days

export class StripeService {
  private stripe: Stripe;
  private db: Db;

  constructor(opts: { stripeSecretKey: string; db: Db }) {
    this.stripe = new Stripe(opts.stripeSecretKey);
    this.db = opts.db;
  }

  // --- Stripe Connect (Venue Onboarding) ---

  async createConnectAccount(venueId: string, email: string): Promise<{ accountId: string; onboardingUrl: string }> {
    const [venue] = await this.db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!venue) throw new Error("Venue not found");

    const account = await this.stripe.accounts.create({
      type: "standard",
      email,
      metadata: { venueId, venueName: venue.name },
    });

    // Store account ID in venue metadata
    const metadata = (venue.metadata ?? {}) as Record<string, unknown>;
    await this.db
      .update(venues)
      .set({
        metadata: {
          ...metadata,
          stripeAccountId: account.id,
          stripeConnectedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(venues.id, venueId));

    return { accountId: account.id, onboardingUrl: "" };
  }

  async createAccountLink(venueId: string, returnUrl: string, refreshUrl: string): Promise<string> {
    const stripeAccountId = await this.getVenueStripeAccountId(venueId);
    if (!stripeAccountId) throw new Error("Venue has no Stripe account");

    const link = await this.stripe.accountLinks.create({
      account: stripeAccountId,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: "account_onboarding",
    });

    return link.url;
  }

  async getAccountStatus(venueId: string): Promise<{
    connected: boolean;
    accountId: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    const stripeAccountId = await this.getVenueStripeAccountId(venueId);
    if (!stripeAccountId) {
      return { connected: false, accountId: null, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
    }

    const account = await this.stripe.accounts.retrieve(stripeAccountId);
    return {
      connected: true,
      accountId: account.id,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
    };
  }

  async disconnectAccount(venueId: string): Promise<void> {
    const [venue] = await this.db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!venue) throw new Error("Venue not found");

    const metadata = (venue.metadata ?? {}) as Record<string, unknown>;
    const { stripeAccountId: _, stripeConnectedAt: __, ...rest } = metadata;

    await this.db
      .update(venues)
      .set({ metadata: rest, updatedAt: new Date() })
      .where(eq(venues.id, venueId));
  }

  // --- Payment Processing ---

  async createPaymentIntent(bookingId: string): Promise<{ clientSecret: string; paymentIntentId: string }> {
    const [booking] = await this.db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!booking) throw new Error("Booking not found");

    const [slot] = await this.db.select().from(availabilitySlots).where(eq(availabilitySlots.id, booking.slotId)).limit(1);
    if (!slot) throw new Error("Slot not found");

    const [court] = await this.db.select().from(courts).where(eq(courts.id, slot.courtId)).limit(1);
    if (!court) throw new Error("Court not found");

    const [venue] = await this.db.select().from(venues).where(eq(venues.id, court.venueId)).limit(1);
    if (!venue) throw new Error("Venue not found");

    const stripeAccountId = await this.getVenueStripeAccountId(venue.id);
    if (!stripeAccountId) throw new Error("Venue has no Stripe account connected");

    const amountCents = slot.priceCents ?? 0;
    if (amountCents <= 0) throw new Error("Slot has no price");

    const commissionRate = this.getCommissionRate(venue);
    const commissionCents = Math.round(amountCents * commissionRate);
    const venuePayoutCents = amountCents - commissionCents;

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: slot.currency.toLowerCase(),
      application_fee_amount: commissionCents,
      transfer_data: {
        destination: stripeAccountId,
      },
      metadata: {
        bookingId,
        venueId: venue.id,
        userId: booking.userId,
        slotId: slot.id,
      },
    });

    // Create payment record
    await this.db.insert(payments).values({
      bookingId,
      userId: booking.userId,
      venueId: venue.id,
      stripePaymentIntentId: paymentIntent.id,
      amountCents,
      commissionCents,
      venuePayoutCents,
      commissionRate,
      currency: slot.currency,
      status: "pending",
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  }

  async processRefund(paymentId: string, amountCents?: number): Promise<void> {
    const [payment] = await this.db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "succeeded") throw new Error("Can only refund succeeded payments");

    const refundAmount = amountCents ?? payment.amountCents;

    await this.stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId!,
      amount: refundAmount,
    });

    const newStatus = refundAmount >= payment.amountCents ? "refunded" : "partially_refunded";
    await this.db
      .update(payments)
      .set({
        status: newStatus,
        refundedAmountCents: payment.refundedAmountCents + refundAmount,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));
  }

  // --- Webhook Handling ---

  constructWebhookEvent(payload: string | Buffer, signature: string, endpointSecret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.db
          .update(payments)
          .set({
            status: "succeeded",
            stripeChargeId: pi.latest_charge as string | null,
            updatedAt: new Date(),
          })
          .where(eq(payments.stripePaymentIntentId, pi.id));

        // Confirm the booking
        const bookingId = pi.metadata.bookingId;
        if (bookingId) {
          await this.db
            .update(bookings)
            .set({ status: "confirmed" })
            .where(eq(bookings.id, bookingId));
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.db
          .update(payments)
          .set({
            status: "failed",
            metadata: { failureMessage: pi.last_payment_error?.message },
            updatedAt: new Date(),
          })
          .where(eq(payments.stripePaymentIntentId, pi.id));
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        if (charge.payment_intent) {
          const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent.id;
          const refundedCents = charge.amount_refunded;
          const newStatus = refundedCents >= charge.amount ? "refunded" : "partially_refunded";
          await this.db
            .update(payments)
            .set({
              status: newStatus,
              refundedAmountCents: refundedCents,
              updatedAt: new Date(),
            })
            .where(eq(payments.stripePaymentIntentId, piId));
        }
        break;
      }
    }
  }

  // --- Helpers ---

  private async getVenueStripeAccountId(venueId: string): Promise<string | null> {
    const [venue] = await this.db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!venue) return null;
    const metadata = (venue.metadata ?? {}) as Record<string, unknown>;
    return (metadata.stripeAccountId as string) ?? null;
  }

  private getCommissionRate(venue: { metadata: Record<string, unknown> | null; createdAt: Date }): number {
    const metadata = (venue.metadata ?? {}) as Record<string, unknown>;

    // Check if venue is in 90-day promo period
    if (metadata.promoFirstNinetyDays) {
      const onboardedAt = metadata.importedAt || metadata.onboardedAt;
      if (typeof onboardedAt === "string") {
        const onboardDate = new Date(onboardedAt);
        const ninetyDaysLater = new Date(onboardDate);
        ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);
        if (new Date() < ninetyDaysLater) {
          return PROMO_COMMISSION_RATE;
        }
      }
    }

    // Check venue-specific commission rate
    if (typeof metadata.commissionRate === "number") {
      return metadata.commissionRate;
    }

    return DEFAULT_COMMISSION_RATE;
  }
}
