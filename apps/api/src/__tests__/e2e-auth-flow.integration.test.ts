/**
 * E2E Auth Flow — Phone+OTP signup -> profile creation -> session persistence
 *
 * Tests the full user onboarding journey from first Firebase auth
 * through user creation and subsequent session re-use.
 */
import { describe, it, expect, vi, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import type { Db } from "@courtiq/db";
import {
  TEST_USER_ID,
  TEST_FIREBASE_UID,
  TEST_PHONE,
  mockDb,
  mockFirebaseAuth,
} from "./helpers.js";

// ──────────────────── Helpers ────────────────────

const newUser = {
  id: TEST_USER_ID,
  phone: TEST_PHONE,
  firebaseUid: TEST_FIREBASE_UID,
  displayName: null,
  createdAt: new Date(),
};

async function buildAuthApp(opts: { firebaseAuth: Auth; db: Db }): Promise<FastifyInstance> {
  const { authRoutes } = await import("../routes/auth.js");
  const app = Fastify({ logger: false });
  await app.register(authRoutes(opts.firebaseAuth, opts.db), { prefix: "/api/v1" });
  return app;
}

// ──────────────────── Tests ────────────────────

describe("E2E: Auth Flow", () => {
  describe("New user signup via Phone+OTP", () => {
    let app: FastifyInstance;

    afterAll(async () => { await app?.close(); });

    it("creates a new user on first Firebase token verification", async () => {
      const firebaseAuth = mockFirebaseAuth();
      // 1st select: lookup by firebaseUid -> not found
      // 2nd select: lookup by phone -> not found
      const db = mockDb({
        routeResult: [],
        insertReturn: [newUser],
      });

      app = await buildAuthApp({ firebaseAuth, db });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/verify",
        headers: { authorization: "Bearer fresh-firebase-token" },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.isNewUser).toBe(true);
      expect(body.data.userId).toBe(TEST_USER_ID);
      expect(body.data.phone).toBe(TEST_PHONE);
    });
  });

  describe("Returning user session persistence", () => {
    let app: FastifyInstance;

    afterAll(async () => { await app?.close(); });

    it("finds existing user by Firebase UID on subsequent logins", async () => {
      const firebaseAuth = mockFirebaseAuth();
      // select finds user by firebaseUid
      const db = mockDb({
        routeResult: [newUser],
      });

      app = await buildAuthApp({ firebaseAuth, db });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/verify",
        headers: { authorization: "Bearer returning-user-token" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.isNewUser).toBe(false);
      expect(body.data.userId).toBe(TEST_USER_ID);
    });
  });

  describe("Token validation errors", () => {
    it("rejects missing auth header", async () => {
      const firebaseAuth = mockFirebaseAuth();
      const db = mockDb();
      const app = await buildAuthApp({ firebaseAuth, db });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/verify",
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("UNAUTHORIZED");
      await app.close();
    });

    it("rejects expired/invalid Firebase token", async () => {
      const firebaseAuth = mockFirebaseAuth({
        verifyIdToken: vi.fn().mockRejectedValue(new Error("Token expired")),
      });
      const db = mockDb();
      const app = await buildAuthApp({ firebaseAuth, db });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/verify",
        headers: { authorization: "Bearer expired-token" },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("UNAUTHORIZED");
      await app.close();
    });

    it("rejects token without phone number", async () => {
      const firebaseAuth = mockFirebaseAuth({
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: TEST_FIREBASE_UID,
          // phone_number intentionally omitted
        } as unknown as DecodedIdToken),
      });
      const db = mockDb();
      const app = await buildAuthApp({ firebaseAuth, db });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/verify",
        headers: { authorization: "Bearer no-phone-token" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("MISSING_PHONE");
      await app.close();
    });
  });

  describe("Phone migration flow", () => {
    let app: FastifyInstance;

    afterAll(async () => { await app?.close(); });

    it("links Firebase UID to existing phone-based user (seed migration)", async () => {
      const firebaseAuth = mockFirebaseAuth();
      const selectResults: unknown[][] = [];
      let selectCall = 0;

      // We need the first select (by firebaseUid) to return empty,
      // and the second select (by phone) to return the existing user.
      const db = mockDb({ routeResult: [] });

      // Override select to return different results per call
      const existingPhoneUser = { ...newUser, firebaseUid: null };
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        selectCall++;
        const data = selectCall === 1 ? [] : [existingPhoneUser];
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: (v: unknown) => void) => resolve(data);
        return chain;
      });

      app = await buildAuthApp({ firebaseAuth, db });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/verify",
        headers: { authorization: "Bearer migration-token" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.isNewUser).toBe(false);
      expect(body.data.userId).toBe(TEST_USER_ID);

      // Verify Firebase UID was linked via update
      expect(db.update).toHaveBeenCalled();
    });
  });
});
