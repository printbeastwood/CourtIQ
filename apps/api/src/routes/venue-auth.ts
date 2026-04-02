import type { FastifyInstance } from "fastify";
import type { Db } from "@courtiq/db";
import { venueOperators, venues } from "@courtiq/db";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const TOKEN_SECRET = process.env["VENUE_TOKEN_SECRET"] || "courtiq-venue-dev-secret";
const TOKEN_EXPIRY_HOURS = 72;

// --- Password utilities ---

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return timingSafeEqual(derived, expected);
}

// --- Token utilities (HMAC-signed JSON) ---

function signToken(payload: Record<string, unknown>): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", TOKEN_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expectedSig = createHmac("sha256", TOKEN_SECRET).update(data).digest("base64url");
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as Record<string, unknown>;
    if (typeof payload["exp"] === "number" && Date.now() > payload["exp"]) return null;
    return payload;
  } catch {
    return null;
  }
}

// --- Route ---

export function venueAuthRoutes(db: Db) {
  return async function (app: FastifyInstance) {
    app.post("/venue-auth/login", async (request, reply) => {
      const body = request.body as { email?: string; password?: string } | null;

      if (!body?.email || !body?.password) {
        return reply.code(400).send({
          error: { code: "INVALID_INPUT", message: "Email and password are required" },
        });
      }

      const email = body.email.toLowerCase().trim();

      // Look up operator by email, join venue for name
      const results = await db
        .select({
          id: venueOperators.id,
          venueId: venueOperators.venueId,
          email: venueOperators.email,
          name: venueOperators.name,
          passwordHash: venueOperators.passwordHash,
          venueName: venues.name,
        })
        .from(venueOperators)
        .innerJoin(venues, eq(venueOperators.venueId, venues.id))
        .where(eq(venueOperators.email, email))
        .limit(1);

      const operator = results[0];

      if (!operator) {
        return reply.code(401).send({
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        });
      }

      const valid = await verifyPassword(body.password, operator.passwordHash);
      if (!valid) {
        return reply.code(401).send({
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        });
      }

      // Issue token
      const exp = Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;
      const token = signToken({
        sub: operator.id,
        venueId: operator.venueId,
        email: operator.email,
        exp,
      });

      return reply.send({
        token,
        user: {
          uid: operator.id,
          venueId: operator.venueId,
          email: operator.email,
          venueName: operator.venueName,
        },
      });
    });
  };
}
