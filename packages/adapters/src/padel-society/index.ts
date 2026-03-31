import type {
  PlatformAdapter,
  AdapterHealth,
  DateRange,
  Region,
  Slot,
  Venue,
} from "@courtiq/shared";

/**
 * The Padel Society adapter — BLOCKED (app-only, no public API).
 *
 * The Padel Society (thepadelsociety.co) is an Asia-focused padel booking
 * and community platform. iOS app 6502341204, Android com.thepadelsociety.app.
 * Developer: SuperStack Ltd. Built with Next.js, deployed on Vercel.
 *
 * No public API endpoints discovered. The website is marketing-only.
 * Booking is exclusively through the mobile app.
 *
 * To unblock:
 *   1. Intercept app traffic to discover API endpoints
 *   2. Contact for partnership (WhatsApp: +66 946 522 520, LINE: 236qudze)
 *
 * Venues covered:
 *   - Pad Thai Padel (3 courts: 2 indoor + 1 outdoor, near Thonglor BTS)
 */

const PADELSOCIETY_WEB = "https://thepadelsociety.co";

interface PadelSocietyVenueConfig {
  name: string;
  slug: string;
  address: string;
  location: { lat: number; lng: number };
  courtCount: number;
  indoor: boolean;
}

const KNOWN_VENUES: PadelSocietyVenueConfig[] = [
  {
    name: "Pad Thai Padel",
    slug: "pad-thai-padel",
    address: "3245 Soi Saen Sabai, Khwaeng Khlong Tan, Khlong Toei, Bangkok 10110",
    location: { lat: 13.7168, lng: 100.5742 },
    courtCount: 3,
    indoor: true,
  },
];

export class PadelSocietyAdapter implements PlatformAdapter {
  readonly platform = "padel_society";

  private lastSuccessAt: Date | null = null;
  private lastErrorAt: Date | null = null;
  private lastError: string | null = null;
  private successCount = 0;
  private totalCount = 0;

  private trackSuccess(): void {
    this.lastSuccessAt = new Date();
    this.successCount++;
    this.totalCount++;
  }

  private trackError(error: unknown): void {
    this.lastErrorAt = new Date();
    this.lastError = error instanceof Error ? error.message : String(error);
    this.totalCount++;
  }

  async fetchVenues(region: Region): Promise<Venue[]> {
    try {
      const venues: Venue[] = KNOWN_VENUES
        .filter((v) => haversineKm(region.center, v.location) <= region.radiusKm)
        .map((v) => ({
          name: v.name,
          slug: `padelsociety-${v.slug}`,
          location: v.location,
          address: v.address,
          amenities: [],
          sourcePlatform: "padel_society" as const,
          sourceId: v.slug,
          metadata: {
            courtCount: v.courtCount,
            indoor: v.indoor,
            fetchedAt: new Date().toISOString(),
          },
        }));

      this.trackSuccess();
      return venues;
    } catch (err) {
      this.trackError(err);
      throw err;
    }
  }

  async fetchAvailability(
    venueSourceId: string,
    dateRange: DateRange
  ): Promise<{
    venue: Venue;
    courts: {
      court: { name: string; surface: string; indoor: boolean; metadata: Record<string, unknown> };
      slots: Omit<Slot, "id" | "courtId">[];
    }[];
  }> {
    try {
      const config = KNOWN_VENUES.find((v) => v.slug === venueSourceId);

      // TODO: App-only platform. No public API discovered.
      // Availability fetching blocked until API access is established.

      this.trackSuccess();

      return {
        venue: {
          name: config?.name ?? venueSourceId,
          slug: `padelsociety-${config?.slug ?? venueSourceId}`,
          location: config?.location ?? { lat: 13.7168, lng: 100.5742 },
          address: config?.address ?? "Bangkok, Thailand",
          amenities: [],
          sourcePlatform: "padel_society",
          sourceId: venueSourceId,
          metadata: { fetchedAt: new Date().toISOString() },
        },
        courts: [],
      };
    } catch (err) {
      this.trackError(err);
      throw err;
    }
  }

  getBookingUrl(slot: Slot): string {
    return slot.sourceBookingUrl || PADELSOCIETY_WEB;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const rate = this.totalCount > 0 ? this.successCount / this.totalCount : 1;
    return {
      platform: "padel_society",
      healthy: rate > 0.8,
      lastSuccessAt: this.lastSuccessAt,
      lastErrorAt: this.lastErrorAt,
      lastError: this.lastError,
      successRate: rate,
    };
  }
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
