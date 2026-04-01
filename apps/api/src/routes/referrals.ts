import type { FastifyPluginAsync } from "fastify";
import type { Db } from "@courtiq/db";
import { referralCodes, referralClaims, users, playerProfiles } from "@courtiq/db";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  generateReferralCodeSchema,
  claimReferralSchema,
  referralListSchema,
} from "@courtiq/shared";

/** Generate a short, readable referral code from a display name or random string. */
function generateCode(displayName: string | null): string {
  const base = displayName
    ? displayName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6)
    : "";
  const suffix = Math.floor(Math.random() * 900 + 100).toString();
  const prefix = base.length >= 3 ? base.slice(0, 6) : "CIQ";
  return `${prefix}${suffix}`;
}

export function referralRoutes(db: Db): FastifyPluginAsync {
  return async (app) => {
    // POST /referrals/generate — create or return existing referral code
    app.post("/referrals/generate", async (request, reply) => {
      const userId = (request as any).userId as string;
      const body = generateReferralCodeSchema.parse(request.body);

      // Check for existing active code
      const [existing] = await db
        .select()
        .from(referralCodes)
        .where(
          and(eq(referralCodes.ownerId, userId), eq(referralCodes.active, true))
        )
        .limit(1);

      if (existing) {
        return {
          referral: {
            id: existing.id,
            code: existing.code,
            ownerType: existing.ownerType,
            shareUrl: `https://courtiq.app/r/${existing.code}`,
            clickCount: existing.clickCount,
            claimCount: existing.claimCount,
            createdAt: existing.createdAt.toISOString(),
          },
        };
      }

      // Get display name for code generation
      const [user] = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      // Generate unique code with retry
      let code: string;
      let attempts = 0;
      while (true) {
        code = generateCode(user?.displayName ?? null);
        const [conflict] = await db
          .select({ id: referralCodes.id })
          .from(referralCodes)
          .where(eq(referralCodes.code, code))
          .limit(1);
        if (!conflict) break;
        attempts++;
        if (attempts > 5) {
          // Fallback to fully random code
          code = `CIQ${Date.now().toString(36).toUpperCase().slice(-6)}`;
          break;
        }
      }

      const [created] = await db
        .insert(referralCodes)
        .values({
          ownerId: userId,
          code,
          ownerType: body.ownerType,
        })
        .returning();

      reply.code(201);
      return {
        referral: {
          id: created.id,
          code: created.code,
          ownerType: created.ownerType,
          shareUrl: `https://courtiq.app/r/${created.code}`,
          clickCount: 0,
          claimCount: 0,
          createdAt: created.createdAt.toISOString(),
        },
      };
    });

    // GET /referrals/mine — get my referral code + stats + claim list
    app.get("/referrals/mine", async (request) => {
      const userId = (request as any).userId as string;
      const query = referralListSchema.parse(request.query);

      // Get active referral code
      const [myCode] = await db
        .select()
        .from(referralCodes)
        .where(
          and(eq(referralCodes.ownerId, userId), eq(referralCodes.active, true))
        )
        .limit(1);

      if (!myCode) {
        return {
          referral: null,
          claims: [],
          stats: {
            totalClicks: 0,
            totalClaims: 0,
            pendingClaims: 0,
            confirmedClaims: 0,
          },
        };
      }

      // Get claims with referee display names
      const offset = (query.page - 1) * query.limit;
      const claims = await db
        .select({
          id: referralClaims.id,
          refereeId: referralClaims.refereeId,
          refereeDisplayName: users.displayName,
          status: referralClaims.status,
          claimedAt: referralClaims.claimedAt,
          confirmedAt: referralClaims.confirmedAt,
        })
        .from(referralClaims)
        .innerJoin(users, eq(referralClaims.refereeId, users.id))
        .where(eq(referralClaims.codeId, myCode.id))
        .orderBy(desc(referralClaims.claimedAt))
        .limit(query.limit)
        .offset(offset);

      // Count claims by status
      const statusCounts = await db
        .select({
          status: referralClaims.status,
          count: sql<number>`count(*)::int`,
        })
        .from(referralClaims)
        .where(eq(referralClaims.codeId, myCode.id))
        .groupBy(referralClaims.status);

      const countMap = Object.fromEntries(
        statusCounts.map((s) => [s.status, s.count])
      );

      return {
        referral: {
          id: myCode.id,
          code: myCode.code,
          ownerType: myCode.ownerType,
          shareUrl: `https://courtiq.app/r/${myCode.code}`,
          clickCount: myCode.clickCount,
          claimCount: myCode.claimCount,
          createdAt: myCode.createdAt.toISOString(),
        },
        claims: claims.map((c) => ({
          id: c.id,
          refereeDisplayName: c.refereeDisplayName,
          status: c.status,
          claimedAt: c.claimedAt?.toISOString() ?? null,
          confirmedAt: c.confirmedAt?.toISOString() ?? null,
        })),
        stats: {
          totalClicks: myCode.clickCount,
          totalClaims: myCode.claimCount,
          pendingClaims: countMap["pending"] ?? 0,
          confirmedClaims: (countMap["confirmed"] ?? 0) + (countMap["rewarded"] ?? 0),
        },
      };
    });

    // POST /referrals/claim — claim a referral code (called during signup)
    app.post("/referrals/claim", async (request, reply) => {
      const userId = (request as any).userId as string;
      const body = claimReferralSchema.parse(request.body);

      // Check if user already claimed any referral
      const [existingClaim] = await db
        .select({ id: referralClaims.id })
        .from(referralClaims)
        .where(eq(referralClaims.refereeId, userId))
        .limit(1);

      if (existingClaim) {
        reply.code(409);
        return { error: { code: "ALREADY_CLAIMED", message: "You have already used a referral code" } };
      }

      // Find the referral code
      const [refCode] = await db
        .select()
        .from(referralCodes)
        .where(
          and(
            eq(referralCodes.code, body.code.toUpperCase()),
            eq(referralCodes.active, true)
          )
        )
        .limit(1);

      if (!refCode) {
        reply.code(404);
        return { error: { code: "CODE_NOT_FOUND", message: "Invalid or expired referral code" } };
      }

      // Can't refer yourself
      if (refCode.ownerId === userId) {
        reply.code(400);
        return { error: { code: "SELF_REFERRAL", message: "You cannot use your own referral code" } };
      }

      // Create the claim
      const [claim] = await db
        .insert(referralClaims)
        .values({
          codeId: refCode.id,
          referrerId: refCode.ownerId,
          refereeId: userId,
          status: "pending",
        })
        .returning();

      // Increment claim count
      await db
        .update(referralCodes)
        .set({ claimCount: sql`${referralCodes.claimCount} + 1` })
        .where(eq(referralCodes.id, refCode.id));

      reply.code(201);
      return {
        claim: {
          id: claim.id,
          referrerId: claim.referrerId,
          status: claim.status,
          claimedAt: claim.claimedAt?.toISOString() ?? null,
        },
      };
    });

    // GET /referrals/resolve/:code — public-ish lookup to validate a code (used by deep link handler)
    app.get("/referrals/resolve/:code", async (request, reply) => {
      const { code } = request.params as { code: string };

      const [refCode] = await db
        .select({
          code: referralCodes.code,
          ownerType: referralCodes.ownerType,
          active: referralCodes.active,
          ownerName: users.displayName,
        })
        .from(referralCodes)
        .innerJoin(users, eq(referralCodes.ownerId, users.id))
        .where(
          and(
            eq(referralCodes.code, code.toUpperCase()),
            eq(referralCodes.active, true)
          )
        )
        .limit(1);

      if (!refCode) {
        reply.code(404);
        return { error: { code: "CODE_NOT_FOUND", message: "Invalid or expired referral code" } };
      }

      // Increment click count
      await db
        .update(referralCodes)
        .set({ clickCount: sql`${referralCodes.clickCount} + 1` })
        .where(eq(referralCodes.code, code.toUpperCase()));

      return {
        referral: {
          code: refCode.code,
          ownerType: refCode.ownerType,
          referrerName: refCode.ownerName,
        },
      };
    });
  };
}
