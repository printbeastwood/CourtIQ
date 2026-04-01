import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import type { Db } from "@courtiq/db";
import { venues, courts } from "@courtiq/db";
import { getAdapter, getAdapterPlatforms } from "@courtiq/adapters";
import type { Region } from "@courtiq/shared";

interface OnboardingBody {
  business: {
    name: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    description: string;
    amenities: string[];
  };
  courts: {
    name: string;
    surface: string;
    indoor: boolean;
  }[];
  hours: {
    day: string;
    open: string;
    close: string;
  }[];
  pricing: {
    defaultPriceCents: number;
    peakPriceCents: number;
    peakHoursStart: string;
    peakHoursEnd: string;
    currency: string;
  };
  addressConfirmed: boolean;
}

export function venueOnboardingRoutes(db: Db): FastifyPluginAsync {
  return async (app) => {
    // Submit new venue onboarding
    app.post<{ Body: OnboardingBody }>("/venue-onboarding", async (request, reply) => {
      const { business, courts: courtList, hours, pricing, addressConfirmed } = request.body;

      if (!business.name || !business.address || !business.email) {
        reply.code(400);
        return { error: "Name, address, and email are required" };
      }

      if (!courtList || courtList.length === 0) {
        reply.code(400);
        return { error: "At least one court is required" };
      }

      // Create venue
      const slug = business.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const [venue] = await db
        .insert(venues)
        .values({
          name: business.name,
          slug: `${slug}-${Date.now()}`,
          lat: 13.7563, // Default Bangkok coords — updated during verification
          lng: 100.5018,
          address: `${business.address}, ${business.city}`,
          amenities: business.amenities,
          sourcePlatform: "club_direct",
          sourceId: `onboarding-${Date.now()}`,
          metadata: {
            phone: business.phone,
            email: business.email,
            description: business.description,
            operatingHours: hours,
            pricing,
            addressConfirmed,
            verified: false,
            onboardedAt: new Date().toISOString(),
          },
        })
        .returning();

      // Create courts
      for (const court of courtList) {
        await db.insert(courts).values({
          venueId: venue.id,
          name: court.name,
          surface: court.surface,
          indoor: court.indoor,
          metadata: {},
        });
      }

      return {
        success: true,
        venueId: venue.id,
        message: "Venue submitted for review",
      };
    });

    // Add court to existing venue
    app.post<{ Params: { id: string }; Body: { name: string; surface: string; indoor: boolean } }>(
      "/venues/:id/courts",
      async (request, reply) => {
        const { id } = request.params;
        const { name, surface, indoor } = request.body;

        const [venue] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
        if (!venue) {
          reply.code(404);
          return { error: "Venue not found" };
        }

        const [court] = await db
          .insert(courts)
          .values({ venueId: id, name, surface, indoor, metadata: {} })
          .returning();

        return { court };
      },
    );

    // Update court
    app.patch<{
      Params: { id: string; courtId: string };
      Body: { name?: string; surface?: string; indoor?: boolean };
    }>("/venues/:id/courts/:courtId", async (request, reply) => {
      const { courtId } = request.params;
      const updates = request.body;

      const [court] = await db.select().from(courts).where(eq(courts.id, courtId)).limit(1);
      if (!court) {
        reply.code(404);
        return { error: "Court not found" };
      }

      const [updated] = await db
        .update(courts)
        .set({
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.surface !== undefined && { surface: updates.surface }),
          ...(updates.indoor !== undefined && { indoor: updates.indoor }),
        })
        .where(eq(courts.id, courtId))
        .returning();

      return { court: updated };
    });

    // Get venue bookings (for venue dashboard)
    app.get<{ Params: { id: string } }>("/venues/:id/bookings", async (request, reply) => {
      const { id } = request.params;

      const [venue] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
      if (!venue) {
        reply.code(404);
        return { error: "Venue not found" };
      }

      // Return empty bookings for now — will be populated when booking flow is complete
      return { bookings: [] };
    });

    // Get venue payouts
    app.get<{ Params: { id: string } }>("/venues/:id/payouts", async (request, reply) => {
      const { id } = request.params;

      const [venue] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
      if (!venue) {
        reply.code(404);
        return { error: "Venue not found" };
      }

      const metadata = (venue.metadata ?? {}) as Record<string, unknown>;

      return {
        payouts: [],
        stripeConnected: !!metadata.stripeAccountId,
        pendingBalance: 0,
        totalPaid: 0,
        commissionRate: 10,
      };
    });

    // ---- Stripe Connect routes ----
    // These are MVP stubs. COU-30 will replace with real Stripe API integration.

    // Get Stripe account status for a venue
    app.get<{ Params: { id: string } }>("/venues/:id/stripe/status", async (request, reply) => {
      const { id } = request.params;

      const [venue] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
      if (!venue) {
        reply.code(404);
        return { error: "Venue not found" };
      }

      const metadata = (venue.metadata ?? {}) as Record<string, unknown>;
      const stripeAccountId = metadata.stripeAccountId as string | undefined;

      if (!stripeAccountId) {
        return {
          connected: false,
          accountId: null,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
          dashboardUrl: null,
          requirements: [],
        };
      }

      // MVP: return stored status from metadata
      return {
        connected: true,
        accountId: stripeAccountId,
        chargesEnabled: (metadata.stripeChargesEnabled as boolean) ?? false,
        payoutsEnabled: (metadata.stripePayoutsEnabled as boolean) ?? false,
        detailsSubmitted: (metadata.stripeDetailsSubmitted as boolean) ?? false,
        dashboardUrl: `https://dashboard.stripe.com/${stripeAccountId}`,
        requirements: (metadata.stripeRequirements as string[]) ?? [],
      };
    });

    // Initiate Stripe Connect onboarding — returns a URL to redirect the venue owner
    app.post<{ Params: { id: string }; Body: { returnUrl?: string } }>(
      "/venues/:id/stripe/onboard",
      async (request, reply) => {
        const { id } = request.params;
        const { returnUrl } = request.body ?? {};

        const [venue] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
        if (!venue) {
          reply.code(404);
          return { error: "Venue not found" };
        }

        // MVP stub: in production, this creates a Stripe AccountLink via the Stripe API.
        // For now, simulate by storing a placeholder account ID and redirecting to return URL.
        const metadata = (venue.metadata ?? {}) as Record<string, unknown>;
        if (!metadata.stripeAccountId) {
          const stubAccountId = `acct_stub_${id.slice(0, 8)}`;
          await db
            .update(venues)
            .set({
              metadata: {
                ...metadata,
                stripeAccountId: stubAccountId,
                stripeChargesEnabled: true,
                stripePayoutsEnabled: true,
                stripeDetailsSubmitted: true,
                stripeRequirements: [],
                stripeConnectedAt: new Date().toISOString(),
              },
            })
            .where(eq(venues.id, id));
        }

        const redirect = returnUrl || `${request.protocol}://${request.hostname}/stripe/return`;
        return { url: redirect };
      },
    );

    // Disconnect Stripe account
    app.post<{ Params: { id: string } }>("/venues/:id/stripe/disconnect", async (request, reply) => {
      const { id } = request.params;

      const [venue] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
      if (!venue) {
        reply.code(404);
        return { error: "Venue not found" };
      }

      const metadata = (venue.metadata ?? {}) as Record<string, unknown>;
      const { stripeAccountId, stripeChargesEnabled, stripePayoutsEnabled, stripeDetailsSubmitted, stripeRequirements, stripeConnectedAt, ...rest } = metadata;

      await db
        .update(venues)
        .set({ metadata: rest })
        .where(eq(venues.id, id));

      return { success: true };
    });

    // Stripe Connect OAuth callback (redirect handler)
    app.get<{ Querystring: { code?: string; state?: string } }>(
      "/stripe/connect/callback",
      async (request, reply) => {
        // MVP stub: In production, exchange the authorization code for a Stripe account.
        // For now, redirect to the venue dashboard return page.
        reply.redirect("/stripe/return");
      },
    );

    // ---- Platform Migration Routes ----

    // List platforms available for import
    app.get("/venue-onboarding/platforms", async () => {
      const platforms = getAdapterPlatforms().filter((p) => p !== "club_direct");
      return {
        data: platforms.map((p) => ({
          id: p,
          name: platformDisplayName(p),
          importSupported: ["playtomic", "matchi", "reclub"].includes(p),
        })),
      };
    });

    // Search venues on a platform by region
    app.get<{
      Querystring: {
        platform: string;
        lat?: string;
        lng?: string;
        radiusKm?: string;
      };
    }>("/venue-onboarding/search-platform", async (request, reply) => {
      const { platform, lat, lng, radiusKm } = request.query;

      const adapter = getAdapter(platform);
      if (!adapter) {
        reply.code(400);
        return { error: { code: "INVALID_PLATFORM", message: `Unknown platform: ${platform}` } };
      }

      // Default to Bangkok center
      const region: Region = {
        center: {
          lat: lat ? parseFloat(lat) : 13.7563,
          lng: lng ? parseFloat(lng) : 100.5018,
        },
        radiusKm: radiusKm ? parseFloat(radiusKm) : 30,
      };

      try {
        const venueList = await adapter.fetchVenues(region);
        return {
          data: venueList.map((v) => ({
            sourceId: v.sourceId,
            name: v.name,
            address: v.address,
            location: v.location,
            platform: v.sourcePlatform,
            metadata: v.metadata,
          })),
        };
      } catch (err) {
        request.log.error(err, "Platform venue search failed");
        reply.code(502);
        return { error: { code: "PLATFORM_ERROR", message: `Failed to search ${platform}` } };
      }
    });

    // Import a venue from an external platform
    app.post<{
      Body: {
        platform: string;
        venueSourceId: string;
        adminEmail: string;
        adminPhone?: string;
        overrides?: {
          name?: string;
          address?: string;
          amenities?: string[];
        };
      };
    }>("/venue-onboarding/import-from-platform", async (request, reply) => {
      const { platform, venueSourceId, adminEmail, adminPhone, overrides } = request.body;

      if (!platform || !venueSourceId || !adminEmail) {
        reply.code(400);
        return { error: { code: "MISSING_FIELDS", message: "platform, venueSourceId, and adminEmail are required" } };
      }

      const adapter = getAdapter(platform);
      if (!adapter) {
        reply.code(400);
        return { error: { code: "INVALID_PLATFORM", message: `Unknown platform: ${platform}` } };
      }

      try {
        // Fetch court inventory and current availability from the platform
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        const availability = await adapter.fetchAvailability(venueSourceId, {
          from: today,
          to: nextWeek,
        });

        const venueData = availability.venue;
        const venueName = overrides?.name || venueData.name;
        const venueAddress = overrides?.address || venueData.address;

        const slug = venueName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        // Create venue
        const [venue] = await db
          .insert(venues)
          .values({
            name: venueName,
            slug: `${slug}-${Date.now()}`,
            lat: venueData.location.lat,
            lng: venueData.location.lng,
            address: venueAddress,
            amenities: overrides?.amenities || venueData.amenities,
            sourcePlatform: venueData.sourcePlatform,
            sourceId: venueData.sourceId,
            metadata: {
              ...venueData.metadata,
              adminEmail,
              adminPhone: adminPhone || null,
              importedFrom: platform,
              importedAt: new Date().toISOString(),
              verified: false,
              promoFirstNinetyDays: true,
            },
          })
          .onConflictDoNothing()
          .returning();

        if (!venue) {
          // Venue already exists — find it
          const [existing] = await db
            .select()
            .from(venues)
            .where(eq(venues.sourceId, venueData.sourceId))
            .limit(1);

          if (existing) {
            reply.code(409);
            return {
              error: {
                code: "VENUE_EXISTS",
                message: `${venueName} is already on CourtIQ`,
              },
              venueId: existing.id,
            };
          }
          reply.code(500);
          return { error: { code: "INSERT_FAILED", message: "Failed to create venue" } };
        }

        // Import courts
        const importedCourts = [];
        for (const { court: courtData, slots } of availability.courts) {
          const [court] = await db
            .insert(courts)
            .values({
              venueId: venue.id,
              name: courtData.name,
              surface: courtData.surface,
              indoor: courtData.indoor,
              metadata: {
                ...courtData.metadata,
                importedSlotCount: slots.length,
                averagePriceCents:
                  slots.length > 0
                    ? Math.round(slots.reduce((sum, s) => sum + s.priceCents, 0) / slots.length)
                    : null,
              },
            })
            .returning();

          importedCourts.push({
            id: court.id,
            name: court.name,
            surface: court.surface,
            indoor: court.indoor,
            slotCount: slots.length,
          });
        }

        return {
          data: {
            venueId: venue.id,
            name: venue.name,
            address: venue.address,
            platform,
            courts: importedCourts,
            message: `Imported ${importedCourts.length} court(s) from ${platformDisplayName(platform)}. First 90 days at 0% commission.`,
          },
        };
      } catch (err) {
        request.log.error(err, "Platform venue import failed");
        reply.code(502);
        return {
          error: {
            code: "IMPORT_FAILED",
            message: `Failed to import from ${platform}. The platform may be temporarily unavailable.`,
          },
        };
      }
    });
  };
}

function platformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    playtomic: "Playtomic",
    matchi: "MATCHi",
    reclub: "Reclub",
    padel_mates: "Padel Mates",
    book_and_go: "Book & Go",
    padel_society: "Padel Society",
  };
  return names[platform] || platform;
}
