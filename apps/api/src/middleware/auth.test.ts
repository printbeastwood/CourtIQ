import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { createAuthMiddleware } from "./auth.js";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import type { Db } from "@courtiq/db";

function mockFirebaseAuth(
  overrides: Partial<Auth> = {}
): Auth {
  return {
    verifyIdToken: vi.fn(),
    ...overrides,
  } as unknown as Auth;
}

function mockDb(
  queryResult: Array<{ id: string }> = []
): Db {
  const selectReturn = {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(queryResult),
      }),
    }),
  };
  return {
    select: () => selectReturn,
  } as unknown as Db;
}

describe("auth middleware", () => {
  it("rejects requests without Authorization header", async () => {
    const app = Fastify();
    const auth = mockFirebaseAuth();
    const db = mockDb();
    const middleware = createAuthMiddleware(auth, db);

    app.addHook("onRequest", middleware);
    app.get("/test", async () => ({ ok: true }));

    const res = await app.inject({ method: "GET", url: "/test" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
  });

  it("rejects requests with invalid token", async () => {
    const auth = mockFirebaseAuth({
      verifyIdToken: vi.fn().mockRejectedValue(new Error("Invalid token")),
    } as Partial<Auth>);
    const db = mockDb();
    const middleware = createAuthMiddleware(auth, db);

    const app = Fastify();
    app.addHook("onRequest", middleware);
    app.get("/test", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer bad-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects valid token when user not found in DB", async () => {
    const auth = mockFirebaseAuth({
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: "firebase-uid-123",
        phone_number: "+66800000001",
      } as unknown as DecodedIdToken),
    } as Partial<Auth>);
    const db = mockDb([]); // no user found
    const middleware = createAuthMiddleware(auth, db);

    const app = Fastify();
    app.addHook("onRequest", middleware);
    app.get("/test", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("USER_NOT_FOUND");
  });

  it("allows valid token with existing user", async () => {
    const auth = mockFirebaseAuth({
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: "firebase-uid-123",
        phone_number: "+66800000001",
      } as unknown as DecodedIdToken),
    } as Partial<Auth>);
    const db = mockDb([{ id: "user-uuid-1" }]);
    const middleware = createAuthMiddleware(auth, db);

    const app = Fastify();
    app.addHook("onRequest", middleware);
    app.get("/test", async (req) => ({
      ok: true,
      userId: req.userId,
      firebaseUid: req.firebaseUid,
    }));

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.userId).toBe("user-uuid-1");
    expect(body.firebaseUid).toBe("firebase-uid-123");
  });

  it("returns expired token message for expired tokens", async () => {
    const auth = mockFirebaseAuth({
      verifyIdToken: vi
        .fn()
        .mockRejectedValue(new Error("Firebase ID token has expired")),
    } as Partial<Auth>);
    const db = mockDb();
    const middleware = createAuthMiddleware(auth, db);

    const app = Fastify();
    app.addHook("onRequest", middleware);
    app.get("/test", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer expired-token" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe("Token expired");
  });
});
