import type { FastifyPluginAsync } from "fastify";
import type { Auth } from "firebase-admin/auth";
import type { Db } from "@courtiq/db";
import { users } from "@courtiq/db";
import { eq } from "drizzle-orm";

export function authRoutes(firebaseAuth: Auth | null, db: Db): FastifyPluginAsync {
  return async (app) => {
    // Verify Firebase token and upsert user
    app.post("/auth/verify", async (request, reply) => {
      // Dev mode: return first seeded user
      if (!firebaseAuth) {
        const [devUser] = await db.select().from(users).limit(1);
        if (!devUser) {
          reply.code(500);
          return { error: { code: "NO_DEV_USER", message: "No users in database. Run: npm run db:seed" } };
        }
        return {
          data: {
            userId: devUser.id,
            phone: devUser.phone,
            displayName: devUser.displayName,
            isNewUser: false,
            devMode: true,
          },
        };
      }

      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        reply.code(401);
        return {
          error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization header" },
        };
      }

      const token = authHeader.slice(7);

      let decoded;
      try {
        decoded = await firebaseAuth.verifyIdToken(token);
      } catch {
        reply.code(401);
        return {
          error: { code: "UNAUTHORIZED", message: "Invalid Firebase token" },
        };
      }

      const firebaseUid = decoded.uid;
      const phone = decoded.phone_number;

      if (!phone) {
        reply.code(400);
        return {
          error: {
            code: "MISSING_PHONE",
            message: "Firebase token must include a phone number (phone+OTP auth required)",
          },
        };
      }

      // Upsert: find by firebaseUid, or by phone (for migrating seed/demo users)
      const [existingByUid] = await db
        .select()
        .from(users)
        .where(eq(users.firebaseUid, firebaseUid))
        .limit(1);

      if (existingByUid) {
        // User exists with this Firebase UID — return
        return {
          data: {
            userId: existingByUid.id,
            phone: existingByUid.phone,
            displayName: existingByUid.displayName,
            isNewUser: false,
          },
        };
      }

      // Check if a user exists with this phone but no Firebase UID (seed/demo migration)
      const [existingByPhone] = await db
        .select()
        .from(users)
        .where(eq(users.phone, phone))
        .limit(1);

      if (existingByPhone) {
        // Link Firebase UID to existing phone-based user
        await db
          .update(users)
          .set({ firebaseUid })
          .where(eq(users.id, existingByPhone.id));

        return {
          data: {
            userId: existingByPhone.id,
            phone: existingByPhone.phone,
            displayName: existingByPhone.displayName,
            isNewUser: false,
          },
        };
      }

      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({ phone, firebaseUid })
        .returning();

      reply.code(201);
      return {
        data: {
          userId: newUser.id,
          phone: newUser.phone,
          displayName: newUser.displayName,
          isNewUser: true,
        },
      };
    });
  };
}
