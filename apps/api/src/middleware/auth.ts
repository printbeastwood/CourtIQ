import type { FastifyRequest, FastifyReply } from "fastify";
import type { Auth } from "firebase-admin/auth";
import type { Db } from "@courtiq/db";
import { users } from "@courtiq/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "../routes/venue-auth.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    firebaseUid: string;
    /** Set when the caller is a venue operator (venue dashboard token) */
    venueOperatorId?: string;
    /** Set when the caller is a venue operator */
    venueId?: string;
  }
}

export function createAuthMiddleware(firebaseAuth: Auth | null, db: Db) {
  return async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Dev mode: no Firebase configured — use first seeded user for all requests
    if (!firebaseAuth) {
      const [devUser] = await db
        .select({ id: users.id, firebaseUid: users.firebaseUid })
        .from(users)
        .limit(1);

      if (!devUser) {
        reply.code(500).send({
          error: { code: "NO_DEV_USER", message: "No users in database. Run: npm run db:seed" },
        });
        return;
      }

      request.userId = devUser.id;
      request.firebaseUid = devUser.firebaseUid ?? "dev-mode";
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      reply.code(401).send({
        error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization header" },
      });
      return;
    }

    const token = authHeader.slice(7);

    // Try venue operator token first (HMAC-signed, cheap to verify)
    const venuePayload = verifyToken(token);
    if (venuePayload && typeof venuePayload["sub"] === "string" && typeof venuePayload["venueId"] === "string") {
      request.venueOperatorId = venuePayload["sub"] as string;
      request.venueId = venuePayload["venueId"] as string;
      // Use the operator id as userId for venue-scoped requests
      request.userId = venuePayload["sub"] as string;
      request.firebaseUid = "venue-operator";
      return;
    }

    // Fall back to Firebase ID token
    try {
      const decoded = await firebaseAuth.verifyIdToken(token);

      // Look up the user in our database by Firebase UID
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.firebaseUid, decoded.uid))
        .limit(1);

      if (!user) {
        reply.code(401).send({
          error: {
            code: "USER_NOT_FOUND",
            message: "User not registered. Call /api/v1/auth/verify first.",
          },
        });
        return;
      }

      request.userId = user.id;
      request.firebaseUid = decoded.uid;
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("expired")
          ? "Token expired"
          : "Invalid token";
      reply.code(401).send({
        error: { code: "UNAUTHORIZED", message },
      });
    }
  };
}
