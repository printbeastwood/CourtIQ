/**
 * Shared test helpers — mock factories for DB, Firebase Auth,
 * PreferenceStore, Concierge, and RatingService.
 */
import { vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import type { Db } from "@courtiq/db";
import type { PreferenceStore } from "@courtiq/preference-store";
import type { Concierge, ChatResult } from "@courtiq/concierge";
import type { RatingService } from "@courtiq/rating-engine";
import { createAuthMiddleware } from "../middleware/auth.js";

// ──────────────────── Constants ────────────────────

export const TEST_USER_ID = "aaaaaaaa-1111-2222-3333-444444444444";
export const TEST_FIREBASE_UID = "firebase-test-uid-123";
export const TEST_PHONE = "+66800001234";
export const TEST_VENUE_ID = "bbbbbbbb-1111-2222-3333-444444444444";
export const TEST_COURT_ID = "cccccccc-1111-2222-3333-444444444444";
export const TEST_SLOT_ID = "dddddddd-1111-2222-3333-444444444444";
export const TEST_BOOKING_ID = "eeeeeeee-1111-2222-3333-444444444444";
export const TEST_MATCH_ID = "ffffffff-1111-2222-3333-444444444444";
export const TEST_OPPONENT_ID = "aaaaaaaa-5555-6666-7777-888888888888";
export const TEST_CONVERSATION_ID = "99999999-1111-2222-3333-444444444444";

// ──────────────────── Fixtures ────────────────────

export const testVenue = {
  id: TEST_VENUE_ID,
  name: "Padel City Bangkok",
  slug: "playtomic-venue-1",
  lat: 13.7563,
  lng: 100.5018,
  address: "Sukhumvit Road, Bangkok, Thailand",
  amenities: ["parking", "showers"],
  sourcePlatform: "playtomic",
  sourceId: "venue-1",
  metadata: {},
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

export const testCourt = {
  id: TEST_COURT_ID,
  venueId: TEST_VENUE_ID,
  name: "Court 1",
  surface: "glass",
  indoor: false,
  metadata: {},
};

const futureDate = new Date(Date.now() + 86_400_000); // tomorrow

export const testSlot = {
  id: TEST_SLOT_ID,
  courtId: TEST_COURT_ID,
  startsAt: futureDate,
  endsAt: new Date(futureDate.getTime() + 5_400_000), // +90 min
  priceCents: 80000,
  currency: "THB",
  status: "available",
  sourceBookingUrl: "https://playtomic.io/tenant/venue-1?date=2026-04-02",
  fetchedAt: new Date(),
};

export const testBooking = {
  id: TEST_BOOKING_ID,
  userId: TEST_USER_ID,
  slotId: TEST_SLOT_ID,
  status: "pending",
  bookingMethod: "redirect",
  sourceConfirmationId: null,
  createdAt: new Date(),
};

// ──────────────────── Mock Factories ────────────────────

export function mockFirebaseAuth(
  overrides: Partial<Auth> = {}
): Auth {
  return {
    verifyIdToken: vi.fn().mockResolvedValue({
      uid: TEST_FIREBASE_UID,
      phone_number: TEST_PHONE,
    } as unknown as DecodedIdToken),
    ...overrides,
  } as unknown as Auth;
}

/**
 * Helper to build chainable Drizzle query mocks.
 * Returns a terminal chain: .from().where().limit() → result
 * Auth middleware calls db.select({ id: users.id }) — with columns arg.
 * Route handlers call db.select() — without columns arg.
 *
 * `authResult` is returned for calls with column selection (auth middleware).
 * `routeResult` is returned for calls without column selection (routes).
 */
export function mockDb(config: {
  routeResult?: unknown[];
  joinResults?: unknown[];
  insertReturn?: unknown[];
  updateReturn?: unknown[];
  deleteReturn?: unknown[];
} = {}): Db {
  const routeResult = config.routeResult ?? [];

  function makeChain(data: unknown[]) {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.offset = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.groupBy = vi.fn().mockResolvedValue(data);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    // Make the chain thenable so `await` resolves it
    chain.then = (resolve: (v: unknown) => void) => resolve(data);
    return chain;
  }

  // All select calls return routeResult — auth is bypassed via a fake middleware
  const selectFn = vi.fn().mockImplementation(() => makeChain(routeResult));

  return {
    select: selectFn,
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(config.insertReturn ?? [testBooking]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(
            config.updateReturn ?? [{ ...testBooking, status: "confirmed" }]
          ),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(config.deleteReturn ?? []),
      }),
    }),
  } as unknown as Db;
}

export function mockPreferenceStore(
  overrides: Partial<PreferenceStore> = {}
): PreferenceStore {
  return {
    storePreferences: vi.fn().mockResolvedValue([
      {
        id: "pref-1",
        userId: TEST_USER_ID,
        category: "play_style",
        text: "I prefer competitive doubles",
        active: true,
        createdAt: new Date(),
      },
    ]),
    queryPreferences: vi.fn().mockResolvedValue([
      {
        preference: {
          id: "pref-1",
          userId: TEST_USER_ID,
          category: "play_style",
          text: "I prefer competitive doubles",
          active: true,
          createdAt: new Date(),
        },
        similarity: 0.92,
      },
    ]),
    getPreferences: vi.fn().mockResolvedValue([
      {
        id: "pref-1",
        userId: TEST_USER_ID,
        category: "play_style",
        text: "I prefer competitive doubles",
        active: true,
        createdAt: new Date(),
      },
    ]),
    getPreferenceContext: vi.fn().mockResolvedValue({
      userId: TEST_USER_ID,
      preferences: [],
      structured: { play_style: ["I prefer competitive doubles"] },
    }),
    deactivatePreference: vi.fn().mockResolvedValue(true),
    deleteAllPreferences: vi.fn().mockResolvedValue(1),
    exportPreferences: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as PreferenceStore;
}

export function mockConcierge(
  overrides: Partial<Concierge> = {}
): Concierge {
  const defaultChatResult: ChatResult = {
    response: "I found 3 courts near Sukhumvit for tomorrow morning!",
    toolsUsed: ["search_courts", "get_user_preferences"],
    conversationId: TEST_CONVERSATION_ID,
  };

  return {
    startConversation: vi.fn().mockResolvedValue(TEST_CONVERSATION_ID),
    chat: vi.fn().mockResolvedValue(defaultChatResult),
    getConversationManager: vi.fn().mockReturnValue({
      createConversation: vi.fn().mockResolvedValue(TEST_CONVERSATION_ID),
      getConversation: vi.fn().mockResolvedValue({
        id: TEST_CONVERSATION_ID,
        userId: TEST_USER_ID,
        startedAt: new Date(),
        metadata: {},
      }),
      listConversations: vi.fn().mockResolvedValue([
        { id: TEST_CONVERSATION_ID, userId: TEST_USER_ID, startedAt: new Date(), metadata: {} },
      ]),
      loadContextWindow: vi.fn().mockResolvedValue([
        { role: "user", content: "Find me a court" },
        { role: "assistant", content: "I found 3 courts near Sukhumvit!" },
      ]),
      saveMessage: vi.fn().mockResolvedValue(undefined),
    }),
    ...overrides,
  } as unknown as Concierge;
}

export function mockRatingService(
  overrides: Partial<RatingService> = {}
): RatingService {
  return {
    getPlayerRating: vi.fn().mockResolvedValue({
      rating: {
        playerId: TEST_USER_ID,
        format: "doubles",
        rating: 1500,
        rd: 350,
        gamesPlayed: 0,
        lastMatchAt: null,
        volatility: 0.06,
      },
      confidence: 0.2,
    }),
    getAllRatings: vi.fn().mockResolvedValue({
      singles: { rating: 1500, rd: 350, gamesPlayed: 0 },
      doubles: { rating: 1500, rd: 350, gamesPlayed: 0 },
    }),
    getRatingHistory: vi.fn().mockResolvedValue([]),
    getMatchHistory: vi.fn().mockResolvedValue([]),
    recordMatchResult: vi.fn().mockResolvedValue({
      match: {
        id: TEST_MATCH_ID,
        format: "doubles",
        player1Id: TEST_USER_ID,
        player2Id: TEST_OPPONENT_ID,
        player1Score: 6,
        player2Score: 3,
        winnerId: TEST_USER_ID,
        playedAt: new Date(),
        reportedById: TEST_USER_ID,
        confirmed: false,
      },
      player1: { ratingBefore: 1500, ratingAfter: 1530, rdBefore: 350, rdAfter: 320 },
      player2: { ratingBefore: 1500, ratingAfter: 1470, rdBefore: 350, rdAfter: 320 },
    }),
    ...overrides,
  } as unknown as RatingService;
}

// ──────────────────── App Builder ────────────────────

/**
 * Build a fully wired Fastify test app with auth middleware and all routes.
 * All external dependencies are mocked — this tests the HTTP layer end-to-end.
 */
export async function buildTestApp(opts: {
  db?: Db;
  firebaseAuth?: Auth;
  preferenceStore?: PreferenceStore;
  concierge?: Concierge;
  ratingService?: RatingService;
  /** If true, use real auth middleware instead of bypass (default: false) */
  realAuth?: boolean;
} = {}): Promise<FastifyInstance> {
  const db = opts.db ?? mockDb();
  const preferenceStore = opts.preferenceStore ?? mockPreferenceStore();
  const concierge = opts.concierge ?? mockConcierge();
  const ratingService = opts.ratingService ?? mockRatingService();

  const { venueRoutes } = await import("../routes/venues.js");
  const { slotRoutes } = await import("../routes/slots.js");
  const { bookingRoutes } = await import("../routes/bookings.js");
  const { healthRoutes } = await import("../routes/health.js");
  const { preferenceRoutes } = await import("../routes/preferences.js");
  const { conciergeRoutes } = await import("../routes/concierge.js");
  const { ratingRoutes } = await import("../routes/ratings.js");
  const { feedbackRoutes } = await import("../routes/feedback.js");

  const app = Fastify({ logger: false });

  await app.register(
    async (protectedScope) => {
      if (opts.realAuth) {
        const firebaseAuth = opts.firebaseAuth ?? mockFirebaseAuth();
        const authenticate = createAuthMiddleware(firebaseAuth, db);
        protectedScope.addHook("onRequest", authenticate);
      } else {
        // Bypass auth: inject userId/firebaseUid from Bearer token presence
        protectedScope.addHook("onRequest", async (request, reply) => {
          const authHeader = request.headers.authorization;
          if (!authHeader?.startsWith("Bearer ")) {
            reply.code(401).send({
              error: { code: "UNAUTHORIZED", message: "Missing authorization" },
            });
            return;
          }
          request.userId = TEST_USER_ID;
          request.firebaseUid = TEST_FIREBASE_UID;
        });
      }

      await protectedScope.register(venueRoutes(db));
      await protectedScope.register(slotRoutes(db));
      await protectedScope.register(bookingRoutes(db));
      await protectedScope.register(healthRoutes(db));
      await protectedScope.register(preferenceRoutes(preferenceStore));
      await protectedScope.register(conciergeRoutes(concierge));
      await protectedScope.register(ratingRoutes(ratingService));
      await protectedScope.register(feedbackRoutes(db));
    },
    { prefix: "/api/v1" }
  );

  return app;
}

/** Standard auth header for test requests */
export const authHeaders = {
  authorization: "Bearer test-token-valid",
};
