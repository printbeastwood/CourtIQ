import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from monorepo root (two levels up from apps/api/)
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { createDb } from "@courtiq/db";
import {
  PreferenceStore,
  createVoyageProvider,
  createVoyageQueryProvider,
  createAnthropicClassifier,
  createOpenAIClassifier,
  type LLMClassifier,
} from "@courtiq/preference-store";
import { Concierge, createLLMProvider, type LLMProvider, type ProviderConfig } from "@courtiq/concierge";
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
import { feedbackRoutes } from "./routes/feedback.js";
import { playerRoutes } from "./routes/players.js";
import { notificationRoutes } from "./routes/notifications.js";
import { matchRoutes } from "./routes/matches.js";
import { importRoutes } from "./routes/import.js";
import { reflinkRoutes } from "./routes/reflink.js";
import { referralRoutes } from "./routes/referrals.js";
import { venueOnboardingRoutes } from "./routes/venue-onboarding.js";
import { coachRoutes } from "./routes/coaches.js";
import { paymentRoutes } from "./routes/payments.js";
import { venueAuthRoutes } from "./routes/venue-auth.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { RatingService } from "@courtiq/rating-engine";
import { NotificationService } from "./services/notifications.js";
import { MigrationService } from "./services/migration.js";
import { ReflinkService } from "./services/reflink.js";
import { StripeService } from "./services/stripe.js";
import { Redis } from "ioredis";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(DATABASE_URL);

// Initialize Firebase Auth
const firebaseAuth = initFirebase();
const authenticate = createAuthMiddleware(firebaseAuth, db);

// --- LLM provider resolution ---
// Reads LLM_PROVIDER env var and the matching API key.
// Falls back to Anthropic when no explicit provider is set.
const LLM_PROVIDER = process.env["LLM_PROVIDER"] ?? "anthropic";
const ANTHROPIC_API_KEY = process.env["ANTHROPIC_API_KEY"];
const VOYAGE_API_KEY = process.env["VOYAGE_API_KEY"];
const GROQ_API_KEY = process.env["GROQ_API_KEY"];
const TOGETHER_API_KEY = process.env["TOGETHER_API_KEY"];
const OPENROUTER_API_KEY = process.env["OPENROUTER_API_KEY"];

const PROVIDER_KEY_MAP: Record<string, string | undefined> = {
  anthropic: ANTHROPIC_API_KEY,
  groq: GROQ_API_KEY,
  together: TOGETHER_API_KEY,
  openrouter: OPENROUTER_API_KEY,
};

const resolvedApiKey = PROVIDER_KEY_MAP[LLM_PROVIDER];

let llmProvider: LLMProvider | null = null;
let llmClassifier: LLMClassifier | null = null;

if (resolvedApiKey) {
  const providerConfig: ProviderConfig = {
    provider: LLM_PROVIDER as ProviderConfig["provider"],
    apiKey: resolvedApiKey,
  };
  llmProvider = createLLMProvider(providerConfig);

  // Build a matching classifier for the preference store parser
  if (LLM_PROVIDER === "anthropic") {
    llmClassifier = createAnthropicClassifier(resolvedApiKey);
  } else {
    const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
      groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
      together: { baseUrl: "https://api.together.xyz/v1", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct" },
    };
    const defaults = PROVIDER_DEFAULTS[LLM_PROVIDER];
    if (defaults) {
      llmClassifier = createOpenAIClassifier(resolvedApiKey, defaults.baseUrl, defaults.model);
    }
  }
  console.log(`LLM provider: ${LLM_PROVIDER}`);
} else {
  console.log(`LLM disabled (no API key for provider "${LLM_PROVIDER}")`);
}

// Initialize preference store (optional — needs embedder keys + a classifier)
let preferenceStore: PreferenceStore | null = null;

if (llmClassifier && VOYAGE_API_KEY) {
  preferenceStore = new PreferenceStore({
    db,
    documentEmbedder: createVoyageProvider(),
    queryEmbedder: createVoyageQueryProvider(),
    classifier: llmClassifier,
  });
} else if (llmClassifier) {
  // Classifier available but no embedding provider — store disabled
  console.log("Preference store disabled (VOYAGE_API_KEY required for embeddings)");
}

// Initialize concierge (requires LLM provider + preference store)
let concierge: Concierge | null = null;
if (llmProvider && preferenceStore) {
  concierge = new Concierge({
    llmProvider,
    db,
    preferenceStore,
  });
}

const ratingService = new RatingService(db);

// Initialize notification service (optional — requires Redis)
let notificationService: NotificationService | null = null;
const REDIS_URL = process.env["REDIS_URL"];

if (REDIS_URL) {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

  // FCM messaging — reuse firebase-admin if available
  let fcmMessaging = null;
  try {
    const { getMessaging } = await import("firebase-admin/messaging");
    fcmMessaging = getMessaging();
  } catch {
    console.log("FCM messaging not available — notifications will be queued but not delivered");
  }

  notificationService = new NotificationService({ db, redis, fcm: fcmMessaging });
  console.log("Notification service enabled (BullMQ + Redis)");
} else {
  console.log("Notification service disabled (REDIS_URL required)");
}

// Initialize Stripe service (optional — requires STRIPE_SECRET_KEY)
let stripeService: StripeService | null = null;
const STRIPE_SECRET_KEY = process.env["STRIPE_SECRET_KEY"];
const STRIPE_WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"];

if (STRIPE_SECRET_KEY) {
  stripeService = new StripeService({ stripeSecretKey: STRIPE_SECRET_KEY, db });
  console.log("Stripe payment service enabled");
} else {
  console.log("Stripe disabled (STRIPE_SECRET_KEY required)");
}

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(websocket);

// === Public routes (no auth required) ===
await app.register(authRoutes(firebaseAuth, db), { prefix: "/api/v1" });
await app.register(venueAuthRoutes(db), { prefix: "/api/v1" });
await app.register(venueOnboardingRoutes(db, stripeService), { prefix: "/api/v1" });

// Stripe webhook (public, uses signature verification)
if (stripeService && STRIPE_WEBHOOK_SECRET) {
  await app.register(webhookRoutes(stripeService, STRIPE_WEBHOOK_SECRET), { prefix: "/api/v1" });
  console.log("Stripe webhook route enabled");
}

// Migration / import routes (always available)
const migrationService = new MigrationService({
  db,
  preferenceStore,
  anthropicApiKey: ANTHROPIC_API_KEY ?? null,
});
await app.register(importRoutes(migrationService), { prefix: "/api/v1" });

// Reflink / referral routes (public for link resolution + click tracking)
const reflinkService = new ReflinkService(db);
await app.register(reflinkRoutes(reflinkService), { prefix: "/api/v1" });

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
    await protectedScope.register(feedbackRoutes(db));
    await protectedScope.register(playerRoutes(db));
    await protectedScope.register(matchRoutes(db, notificationService));
    await protectedScope.register(referralRoutes(db));
    await protectedScope.register(coachRoutes(db));

    if (stripeService) {
      await protectedScope.register(paymentRoutes(stripeService));
      console.log("Payment routes enabled");
    }

    if (notificationService) {
      await protectedScope.register(notificationRoutes(db, notificationService));
      console.log("Notification routes enabled");
    }

    if (preferenceStore) {
      await protectedScope.register(preferenceRoutes(preferenceStore));
    }

    if (concierge) {
      await protectedScope.register(conciergeRoutes(concierge));
      console.log("AI Concierge enabled");
    } else {
      console.log(
        "AI Concierge disabled (LLM provider + VOYAGE_API_KEY required)"
      );
    }
  },
  { prefix: "/api/v1" }
);

const port = parseInt(process.env["PORT"] || "3000", 10);
const host = process.env["HOST"] || "0.0.0.0";

// Graceful shutdown
const shutdown = async () => {
  await app.close();
  await notificationService?.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

try {
  await app.listen({ port, host });
  console.log(`CourtIQ API running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
