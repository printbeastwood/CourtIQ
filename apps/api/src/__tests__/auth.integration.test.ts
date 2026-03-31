/**
 * Integration tests for the auth flow — Firebase token validation + user lookup.
 * Tests the auth middleware as part of full route handling via Fastify inject.
 */
import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { createAuthMiddleware } from "../middleware/auth.js";
import {
  mockFirebaseAuth,
  mockDb,
  TEST_USER_ID,
  TEST_FIREBASE_UID,
} from "./helpers.js";
import type { Auth } from "firebase-admin/auth";
import type { Db } from "@courtiq/db";

describe("auth integration flow", () => {
  async function buildAuthApp(auth: Auth, db: Db) {
    const app = Fastify({ logger: false });
    const middleware = createAuthMiddleware(auth, db);
    app.addHook("onRequest", middleware);
    app.get("/protected", async (req) => ({
      userId: req.userId,
      firebaseUid: req.firebaseUid,
    }));
    return app;
  }

  it("full valid auth flow: token → Firebase verify → DB user lookup → request.userId set", async () => {
    const auth = mockFirebaseAuth();
    const db = mockDb({ routeResult: [{ id: TEST_USER_ID }] });
    const app = await buildAuthApp(auth, db);

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer valid-firebase-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.userId).toBe(TEST_USER_ID);
    expect(body.firebaseUid).toBe(TEST_FIREBASE_UID);
    expect(auth.verifyIdToken).toHaveBeenCalledWith("valid-firebase-token");
    await app.close();
  });

  it("rejects request with no Authorization header", async () => {
    const auth = mockFirebaseAuth();
    const db = mockDb();
    const app = await buildAuthApp(auth, db);

    const res = await app.inject({ method: "GET", url: "/protected" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
    expect(auth.verifyIdToken).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects request with malformed Authorization header", async () => {
    const auth = mockFirebaseAuth();
    const db = mockDb();
    const app = await buildAuthApp(auth, db);

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "NotBearer token" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("rejects expired Firebase token with appropriate message", async () => {
    const auth = mockFirebaseAuth({
      verifyIdToken: vi.fn().mockRejectedValue(new Error("Firebase ID token has expired")),
    } as Partial<Auth>);
    const db = mockDb();
    const app = await buildAuthApp(auth, db);

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer expired-token" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe("Token expired");
    await app.close();
  });

  it("rejects valid token when user does not exist in DB", async () => {
    const auth = mockFirebaseAuth();
    // Override select to always return empty (no user found)
    const db = mockDb();
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: (v: unknown) => void) => resolve([]);
      return chain;
    });
    const app = await buildAuthApp(auth, db);

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer valid-token-no-user" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("USER_NOT_FOUND");
    await app.close();
  });

  it("rejects tampered/invalid Firebase token", async () => {
    const auth = mockFirebaseAuth({
      verifyIdToken: vi.fn().mockRejectedValue(new Error("Decoding Firebase ID token failed")),
    } as Partial<Auth>);
    const db = mockDb();
    const app = await buildAuthApp(auth, db);

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer tampered-token" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
