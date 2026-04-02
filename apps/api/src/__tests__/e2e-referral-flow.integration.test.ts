/**
 * E2E Referral Flow — Generate reflink -> resolve code -> claim on signup
 *
 * Tests the full referral journey: existing user generates a referral code,
 * new user resolves it via deep link, then claims it during signup.
 */
import { describe, it, expect, vi, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { Db } from "@courtiq/db";
import {
  TEST_USER_ID,
  TEST_FIREBASE_UID,
  TEST_REFERRER_ID,
  TEST_REFERRAL_CODE_ID,
  TEST_REFERRAL_CODE,
  testReferralCode,
  testReferralClaim,
  mockDb,
  authHeaders,
} from "./helpers.js";

// ──────────────────── Helpers ────────────────────

async function buildReferralApp(db: Db): Promise<FastifyInstance> {
  const { referralRoutes } = await import("../routes/referrals.js");
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

      await scope.register(referralRoutes(db));
    },
    { prefix: "/api/v1" },
  );

  return app;
}

// ──────────────────── Tests ────────────────────

describe("E2E: Referral Flow", () => {
  describe("Generate -> Resolve -> Claim", () => {
    it("completes the full referral journey", async () => {
      // Step 1: Referrer generates a code
      // select #1: check for existing code -> none
      // select #2: get display name
      // select #3: check code conflict -> none
      let selectCall = 0;
      const genDb = mockDb();
      (genDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        selectCall++;
        let data: unknown[];
        if (selectCall === 1) data = []; // no existing code
        else if (selectCall === 2) data = [{ displayName: "Padel Pro" }]; // user name
        else data = []; // no conflict
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.innerJoin = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: (v: unknown) => void) => resolve(data);
        return chain;
      });

      const createdCode = {
        id: TEST_REFERRAL_CODE_ID,
        ownerId: TEST_USER_ID,
        code: "PADEL123",
        ownerType: "player",
        active: true,
        clickCount: 0,
        claimCount: 0,
        createdAt: new Date(),
      };

      (genDb.insert as ReturnType<typeof vi.fn>).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdCode]),
        }),
      });

      const genApp = await buildReferralApp(genDb);

      const genRes = await genApp.inject({
        method: "POST",
        url: "/api/v1/referrals/generate",
        headers: authHeaders,
        payload: { ownerType: "player" },
      });

      expect(genRes.statusCode).toBe(201);
      const genBody = genRes.json();
      expect(genBody.referral.code).toBe("PADEL123");
      expect(genBody.referral.shareUrl).toContain("courtiq.app/r/PADEL123");
      expect(genBody.referral.ownerType).toBe("player");
      const code = genBody.referral.code;

      await genApp.close();

      // Step 2: New user resolves the code via deep link
      const resolveDb = mockDb({
        routeResult: [
          {
            code: "PADEL123",
            ownerType: "player",
            active: true,
            ownerName: "Padel Pro",
          },
        ],
      });
      const resolveApp = await buildReferralApp(resolveDb);

      const resolveRes = await resolveApp.inject({
        method: "GET",
        url: `/api/v1/referrals/resolve/${code}`,
        headers: authHeaders,
      });

      expect(resolveRes.statusCode).toBe(200);
      const resolveBody = resolveRes.json();
      expect(resolveBody.referral.code).toBe("PADEL123");
      expect(resolveBody.referral.referrerName).toBe("Padel Pro");
      expect(resolveBody.referral.ownerType).toBe("player");

      // Verify click count was incremented
      expect(resolveDb.update).toHaveBeenCalled();
      await resolveApp.close();

      // Step 3: New user claims the code during signup
      let claimSelectCall = 0;
      const claimDb = mockDb();
      (claimDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        claimSelectCall++;
        let data: unknown[];
        if (claimSelectCall === 1) data = []; // no existing claim
        else data = [{ ...testReferralCode, ownerId: TEST_REFERRER_ID }]; // found code
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.innerJoin = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: (v: unknown) => void) => resolve(data);
        return chain;
      });

      const newClaim = {
        id: "claim-new-001",
        codeId: TEST_REFERRAL_CODE_ID,
        referrerId: TEST_REFERRER_ID,
        refereeId: TEST_USER_ID,
        status: "pending",
        claimedAt: new Date(),
      };

      (claimDb.insert as ReturnType<typeof vi.fn>).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newClaim]),
        }),
      });

      const claimApp = await buildReferralApp(claimDb);

      const claimRes = await claimApp.inject({
        method: "POST",
        url: "/api/v1/referrals/claim",
        headers: authHeaders,
        payload: { code },
      });

      expect(claimRes.statusCode).toBe(201);
      const claimBody = claimRes.json();
      expect(claimBody.claim.referrerId).toBe(TEST_REFERRER_ID);
      expect(claimBody.claim.status).toBe("pending");

      // Verify claim count was incremented
      expect(claimDb.update).toHaveBeenCalled();
      await claimApp.close();
    });
  });

  describe("Referral error paths", () => {
    it("returns existing code instead of creating duplicate", async () => {
      const db = mockDb({
        routeResult: [testReferralCode],
      });
      const app = await buildReferralApp(db);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/referrals/generate",
        headers: authHeaders,
        payload: { ownerType: "player" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().referral.code).toBe(TEST_REFERRAL_CODE);
      // insert should NOT have been called since code already exists
      expect(db.insert).not.toHaveBeenCalled();
      await app.close();
    });

    it("rejects claiming an invalid code", async () => {
      let selectCall = 0;
      const db = mockDb();
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        selectCall++;
        const data: unknown[] = []; // no existing claim, and code not found
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: (v: unknown) => void) => resolve(data);
        return chain;
      });

      const app = await buildReferralApp(db);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/referrals/claim",
        headers: authHeaders,
        payload: { code: "INVALID999" },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe("CODE_NOT_FOUND");
      await app.close();
    });

    it("rejects duplicate claim", async () => {
      const db = mockDb({
        routeResult: [{ id: "existing-claim-id" }], // user already claimed
      });
      const app = await buildReferralApp(db);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/referrals/claim",
        headers: authHeaders,
        payload: { code: TEST_REFERRAL_CODE },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("ALREADY_CLAIMED");
      await app.close();
    });

    it("returns 404 for non-existent code resolution", async () => {
      const db = mockDb({ routeResult: [] });
      const app = await buildReferralApp(db);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/referrals/resolve/NONEXIST999",
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe("CODE_NOT_FOUND");
      await app.close();
    });
  });

  describe("Referral stats", () => {
    it("returns referral stats with claim list", async () => {
      let selectCall = 0;
      const db = mockDb();
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        selectCall++;
        let data: unknown[];
        if (selectCall === 1) {
          // Get active code
          data = [testReferralCode];
        } else if (selectCall === 2) {
          // Get claims with names
          data = [
            {
              id: "claim-1",
              refereeId: "referee-1",
              refereeDisplayName: "Player One",
              status: "confirmed",
              claimedAt: new Date(),
              confirmedAt: new Date(),
            },
          ];
        } else {
          // Count by status
          data = [
            { status: "confirmed", count: 1 },
            { status: "pending", count: 1 },
          ];
        }

        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.offset = vi.fn().mockReturnValue(chain);
        chain.orderBy = vi.fn().mockReturnValue(chain);
        chain.innerJoin = vi.fn().mockReturnValue(chain);
        chain.groupBy = vi.fn().mockResolvedValue(data);
        chain.then = (resolve: (v: unknown) => void) => resolve(data);
        return chain;
      });

      const app = await buildReferralApp(db);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/referrals/mine",
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.referral.code).toBe(TEST_REFERRAL_CODE);
      expect(body.claims).toHaveLength(1);
      expect(body.stats.confirmedClaims).toBe(1);
      expect(body.stats.pendingClaims).toBe(1);
      await app.close();
    });

    it("returns empty stats when no referral code exists", async () => {
      const db = mockDb({ routeResult: [] }); // no active code
      const app = await buildReferralApp(db);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/referrals/mine",
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.referral).toBeNull();
      expect(body.claims).toEqual([]);
      expect(body.stats.totalClaims).toBe(0);
      await app.close();
    });
  });
});
