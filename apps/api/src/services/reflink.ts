import { eq, and, sql, desc } from "drizzle-orm";
import {
  reflinks,
  referrals,
  referralPayouts,
  bookings,
  type Db,
} from "@courtiq/db";
import type {
  Reflink,
  Referral,
  ReferralPayout,
  ReflinkTier,
  ReflinkDashboard,
  PayoutType,
} from "@courtiq/shared";
import { REFLINK_TIER_DEFAULTS } from "@courtiq/shared";

export class ReflinkService {
  constructor(private db: Db) {}

  // ─── Link generation ──────────────────────────────────────────────────────

  async createReflink(
    userId: string,
    tier: ReflinkTier,
    customCode?: string
  ): Promise<Reflink> {
    const defaults = REFLINK_TIER_DEFAULTS[tier];
    const code = customCode ?? await this.generateUniqueCode(userId);

    const [row] = await this.db
      .insert(reflinks)
      .values({
        userId,
        code,
        tier,
        commissionRate: defaults.commissionRate,
        rewardType: defaults.rewardType,
        rewardConfig: defaults.rewardConfig,
        attributionWindowDays: 30,
        active: true,
      })
      .returning();

    if (!row) throw new Error("Failed to create reflink");
    return this.rowToReflink(row);
  }

  async getReflink(code: string): Promise<Reflink | null> {
    const [row] = await this.db
      .select()
      .from(reflinks)
      .where(eq(reflinks.code, code));

    return row ? this.rowToReflink(row) : null;
  }

  async getUserReflinks(userId: string): Promise<Reflink[]> {
    const rows = await this.db
      .select()
      .from(reflinks)
      .where(eq(reflinks.userId, userId))
      .orderBy(desc(reflinks.createdAt));

    return rows.map((r) => this.rowToReflink(r));
  }

  async deactivateReflink(reflinkId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(reflinks)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(reflinks.id, reflinkId), eq(reflinks.userId, userId)))
      .returning({ id: reflinks.id });

    return result.length > 0;
  }

  // ─── Click tracking ───────────────────────────────────────────────────────

  async trackClick(code: string): Promise<Reflink | null> {
    const [row] = await this.db
      .update(reflinks)
      .set({ clicks: sql`${reflinks.clicks} + 1`, updatedAt: new Date() })
      .where(and(eq(reflinks.code, code), eq(reflinks.active, true)))
      .returning();

    return row ? this.rowToReflink(row) : null;
  }

  // ─── Attribution ──────────────────────────────────────────────────────────

  async attributeSignup(
    reflinkCode: string,
    referredUserId: string
  ): Promise<Referral | null> {
    const reflink = await this.getReflink(reflinkCode);
    if (!reflink || !reflink.active) return null;

    // Check attribution window
    if (reflink.expiresAt && reflink.expiresAt < new Date()) return null;

    // Check if already referred
    const existing = await this.db
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.reflinkId, reflink.id),
          eq(referrals.referredUserId, referredUserId)
        )
      );
    if (existing.length > 0) return this.rowToReferral(existing[0]!);

    const [row] = await this.db
      .insert(referrals)
      .values({
        reflinkId: reflink.id,
        referrerId: reflink.userId,
        referredUserId,
        status: "signed_up",
      })
      .returning();

    if (!row) return null;
    return this.rowToReferral(row);
  }

  async recordBookingForReferral(
    referredUserId: string,
    bookingId: string,
    bookingAmountCents: number
  ): Promise<void> {
    // Find active referrals for this user
    const refs = await this.db
      .select({
        referral: referrals,
        reflink: reflinks,
      })
      .from(referrals)
      .innerJoin(reflinks, eq(referrals.reflinkId, reflinks.id))
      .where(
        and(
          eq(referrals.referredUserId, referredUserId),
          sql`${referrals.status} != 'expired'`
        )
      );

    for (const { referral, reflink } of refs) {
      // Update booking count
      const newCount = referral.bookingCount + 1;
      let newStatus = referral.status;

      if (newStatus === "signed_up") newStatus = "first_booking";

      // Check qualification rules per tier
      const config = reflink.rewardConfig as Record<string, unknown>;
      const requiredBookings = (config.requiredReferralBookings as number) ?? 1;
      if (newCount >= requiredBookings && newStatus !== "qualified") {
        newStatus = "qualified";
      }

      await this.db
        .update(referrals)
        .set({
          bookingCount: newCount,
          status: newStatus,
          qualifiedAt: newStatus === "qualified" ? new Date() : referral.qualifiedAt,
        })
        .where(eq(referrals.id, referral.id));

      // Create payout if commission-based
      if (reflink.rewardType === "commission" && reflink.commissionRate > 0) {
        const commissionCents = Math.round(bookingAmountCents * reflink.commissionRate);
        if (commissionCents > 0) {
          await this.db.insert(referralPayouts).values({
            referrerId: reflink.userId,
            reflinkId: reflink.id,
            referralId: referral.id,
            bookingId,
            type: "commission",
            amountCents: commissionCents,
            currency: "THB",
            status: "pending",
            description: `${(reflink.commissionRate * 100).toFixed(0)}% commission on booking`,
          });
        }
      }

      // Credit reward for player tier: issue credit when qualified
      if (
        reflink.rewardType === "credit" &&
        newStatus === "qualified" &&
        referral.status !== "qualified"
      ) {
        const creditAmount = (config.creditAmountCents as number) ?? 50000;
        const creditCurrency = (config.creditCurrency as string) ?? "THB";

        await this.db.insert(referralPayouts).values({
          referrerId: reflink.userId,
          reflinkId: reflink.id,
          referralId: referral.id,
          type: "credit",
          amountCents: creditAmount,
          currency: creditCurrency,
          status: "approved", // Credits are auto-approved
          description: `Referral reward: ${newCount} bookings from referred player`,
        });
      }
    }
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  async getDashboard(userId: string): Promise<ReflinkDashboard[]> {
    const userReflinks = await this.getUserReflinks(userId);
    const dashboards: ReflinkDashboard[] = [];

    for (const reflink of userReflinks) {
      const refs = await this.db
        .select()
        .from(referrals)
        .where(eq(referrals.reflinkId, reflink.id))
        .orderBy(desc(referrals.createdAt));

      const payouts = await this.db
        .select()
        .from(referralPayouts)
        .where(eq(referralPayouts.reflinkId, reflink.id))
        .orderBy(desc(referralPayouts.createdAt));

      const totalEarnings = payouts
        .filter((p) => p.status !== "cancelled")
        .reduce((sum, p) => sum + p.amountCents, 0);

      const pendingPayout = payouts
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + p.amountCents, 0);

      dashboards.push({
        reflink,
        totalClicks: reflink.clicks,
        totalSignups: refs.length,
        totalQualified: refs.filter((r) => r.status === "qualified").length,
        totalEarningsCents: totalEarnings,
        pendingPayoutCents: pendingPayout,
        recentReferrals: refs.slice(0, 10).map((r) => this.rowToReferral(r)),
        recentPayouts: payouts.slice(0, 10).map((p) => this.rowToPayout(p)),
      });
    }

    return dashboards;
  }

  // ─── Payout management ────────────────────────────────────────────────────

  async getPendingPayouts(userId: string): Promise<ReferralPayout[]> {
    const rows = await this.db
      .select()
      .from(referralPayouts)
      .where(
        and(eq(referralPayouts.referrerId, userId), eq(referralPayouts.status, "pending"))
      )
      .orderBy(desc(referralPayouts.createdAt));

    return rows.map((r) => this.rowToPayout(r));
  }

  async approvePayouts(payoutIds: string[]): Promise<number> {
    let approved = 0;
    for (const id of payoutIds) {
      const result = await this.db
        .update(referralPayouts)
        .set({ status: "approved" })
        .where(and(eq(referralPayouts.id, id), eq(referralPayouts.status, "pending")))
        .returning({ id: referralPayouts.id });
      approved += result.length;
    }
    return approved;
  }

  async markPayoutPaid(payoutId: string): Promise<boolean> {
    const result = await this.db
      .update(referralPayouts)
      .set({ status: "paid", paidAt: new Date() })
      .where(and(eq(referralPayouts.id, payoutId), eq(referralPayouts.status, "approved")))
      .returning({ id: referralPayouts.id });

    return result.length > 0;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async generateUniqueCode(userId: string): Promise<string> {
    // Generate a short, URL-friendly code
    const base = userId.slice(0, 6);
    const random = Math.random().toString(36).slice(2, 6);
    const code = `ciq-${base}-${random}`;

    // Ensure uniqueness
    const existing = await this.db
      .select({ id: reflinks.id })
      .from(reflinks)
      .where(eq(reflinks.code, code));

    if (existing.length > 0) {
      return this.generateUniqueCode(userId); // Retry
    }
    return code;
  }

  private rowToReflink(row: typeof reflinks.$inferSelect): Reflink {
    return {
      id: row.id,
      userId: row.userId,
      code: row.code,
      tier: row.tier as Reflink["tier"],
      commissionRate: row.commissionRate,
      rewardType: row.rewardType as Reflink["rewardType"],
      rewardConfig: row.rewardConfig ?? {},
      attributionWindowDays: row.attributionWindowDays,
      active: row.active,
      clicks: row.clicks,
      expiresAt: row.expiresAt ?? undefined,
      createdAt: row.createdAt,
    };
  }

  private rowToReferral(row: typeof referrals.$inferSelect): Referral {
    return {
      id: row.id,
      reflinkId: row.reflinkId,
      referrerId: row.referrerId,
      referredUserId: row.referredUserId,
      status: row.status as Referral["status"],
      attributedAt: row.attributedAt,
      qualifiedAt: row.qualifiedAt ?? undefined,
      bookingCount: row.bookingCount,
      createdAt: row.createdAt,
    };
  }

  private rowToPayout(row: typeof referralPayouts.$inferSelect): ReferralPayout {
    return {
      id: row.id,
      referrerId: row.referrerId,
      reflinkId: row.reflinkId,
      referralId: row.referralId ?? undefined,
      bookingId: row.bookingId ?? undefined,
      type: row.type as ReferralPayout["type"],
      amountCents: row.amountCents,
      currency: row.currency,
      status: row.status as ReferralPayout["status"],
      description: row.description ?? undefined,
      paidAt: row.paidAt ?? undefined,
      createdAt: row.createdAt,
    };
  }
}
