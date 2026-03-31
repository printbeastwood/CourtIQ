import type { FastifyRequest, FastifyReply } from "fastify";
import type { Auth } from "firebase-admin/auth";
import type { Db } from "@courtiq/db";
import { users } from "@courtiq/db";
import { eq } from "drizzle-orm";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    firebaseUid: string;
  }
}

export function createAuthMiddleware(firebaseAuth: Auth, db: Db) {
  return async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      reply.code(401).send({
        error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization header" },
      });
      return;
    }

    const token = authHeader.slice(7);

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
