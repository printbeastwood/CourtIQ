import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { createDb } from "@courtiq/db";
import {
  PreferenceStore,
  createVoyageProvider,
  createVoyageQueryProvider,
} from "@courtiq/preference-store";
import { Concierge } from "@courtiq/concierge";
import { initFirebase } from "./firebase.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { venueRoutes } from "./routes/venues.js";
import { slotRoutes } from "./routes/slots.js";
import { healthRoutes } from "./routes/health.js";
import { preferenceRoutes } from "./routes/preferences.js";
import { conciergeRoutes } from "./routes/concierge.js";
import { bookingRoutes } from "./routes/bookings.js";
import { ratingRoutes } from "./routes/ratings.js";
import { RatingService } from "@courtiq/rating-engine";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(DATABASE_URL);

// Initialize Firebase Auth
const firebaseAuth = initFirebase();
const authenticate = createAuthMiddleware(firebaseAuth, db);

// Initialize preference store (optional — gracefully skips if keys missing)
let preferenceStore: PreferenceStore | null = null;
const ANTHROPIC_API_KEY = process.env["ANTHROPIC_API_KEY"];
const VOYAGE_API_KEY = process.env["VOYAGE_API_KEY"];

if (ANTHROPIC_API_KEY && VOYAGE_API_KEY) {
  preferenceStore = new PreferenceStore({
    db,
    documentEmbedder: createVoyageProvider(),
    queryEmbedder: createVoyageQueryProvider(),
    anthropicApiKey: ANTHROPIC_API_KEY,
  });
}

// Initialize concierge (requires preference store + Anthropic key)
let concierge: Concierge | null = null;
if (ANTHROPIC_API_KEY && preferenceStore) {
  concierge = new Concierge({
    anthropicApiKey: ANTHROPIC_API_KEY,
    db,
    preferenceStore,
  });
}

const ratingService = new RatingService(db);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(websocket);

// === Public routes (no auth required) ===
await app.register(authRoutes(firebaseAuth, db), { prefix: "/api/v1" });

// Root health check
app.get("/health", async () => ({ status: "ok", service: "courtiq-api" }));

// === Protected routes (auth required) ===
await app.register(
  async (protectedScope) => {
    protectedScope.addHook("onRequest", authenticate);

    await protectedScope.register(venueRoutes(db));
    await protectedScope.register(slotRoutes(db));
    await protectedScope.register(healthRoutes(db));
    await protectedScope.register(bookingRoutes(db));
    await protectedScope.register(ratingRoutes(ratingService));

    if (preferenceStore) {
      await protectedScope.register(preferenceRoutes(preferenceStore));
    }

    if (concierge) {
      await protectedScope.register(conciergeRoutes(concierge));
      console.log("AI Concierge enabled");
    } else {
      console.log(
        "AI Concierge disabled (ANTHROPIC_API_KEY and VOYAGE_API_KEY required)"
      );
    }
  },
  { prefix: "/api/v1" }
);

const port = parseInt(process.env["PORT"] || "3000", 10);
const host = process.env["HOST"] || "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`CourtIQ API running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
