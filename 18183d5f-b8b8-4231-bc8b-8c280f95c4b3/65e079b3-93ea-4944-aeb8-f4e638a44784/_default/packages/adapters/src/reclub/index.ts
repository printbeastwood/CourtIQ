import type {
  PlatformAdapter,
  AdapterHealth,
  DateRange,
  Region,
  Slot,
  Venue,
} from "@courtiq/shared";

/**
 * Reclub adapter — scraping-based.
 *
 * Reclub has no public API, so this adapter is a structured placeholder
 * that defines the scraping targets and data extraction patterns.
 * Full Playwright implementation requires a browser runtime (Docker/worker).
 *
 * Scraping targets:
 * - Venue listing: https://reclub.co/padel/bangkok
 * - Availability: https://reclub.co/venue/{slug}/book?date=YYYY-MM-DD
 */

const RECLUB_BASE = "https://reclub.co";

export class ReclubAdapter implements PlatformAdapter {
  readonly platform = "reclub";

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
      // In production, this would use Playwright to:
      // 1. Navigate to https://reclub.co/padel/bangkok
      // 2. Wait for venue cards to render
      // 3. Extract venue data from DOM
      //
      // For now, return static Bangkok padel venues known to be on Reclub
      const knownVenues: Venue[] = [
        {
          name: "The Padel Club Bangkok",
          slug: "reclub-the-padel-club-bangkok",
          location: { lat: 13.7285, lng: 100.5506 },
          address: "Sukhumvit, Bangkok",
          amenities: ["parking", "pro_shop", "cafe"],
          sourcePlatform: "reclub",
          sourceId: "the-padel-club-bangkok",
          metadata: { reclubSlug: "the-padel-club-bangkok", scrapedAt: new Date().toISOString() },
        },
        {
          name: "Padel Society",
          slug: "reclub-padel-society",
          location: { lat: 13.7448, lng: 100.5347 },
          address: "Phahon Yothin, Bangkok",
          amenities: ["parking", "changing_rooms"],
          sourcePlatform: "reclub",
          sourceId: "padel-society",
          metadata: { reclubSlug: "padel-society", scrapedAt: new Date().toISOString() },
        },
      ];

      // Filter by region
      const filtered = knownVenues.filter((v) => {
        const dist = haversineKm(region.center, v.location);
        return dist <= region.radiusKm;
      });

      this.trackSuccess();
      return filtered;
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
      // In production, Playwright would:
      // 1. Navigate to https://reclub.co/venue/{venueSourceId}/book?date=YYYY-MM-DD
      // 2. Wait for the availability calendar to render
      // 3. Extract time slots, prices, and court names from the DOM
      // 4. Iterate over each date in the range

      const now = new Date();
      const _dateStr = dateRange.from.toISOString().slice(0, 10);

      // Placeholder — returns empty until Playwright is wired up
      this.trackSuccess();

      return {
        venue: {
          name: venueSourceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          slug: `reclub-${venueSourceId}`,
          location: { lat: 13.7285, lng: 100.5506 },
          address: "Bangkok",
          amenities: [],
          sourcePlatform: "reclub",
          sourceId: venueSourceId,
          metadata: { scrapedAt: now.toISOString() },
        },
        courts: [],
      };
    } catch (err) {
      this.trackError(err);
      throw err;
    }
  }

  getBookingUrl(slot: Slot): string {
    return slot.sourceBookingUrl || `${RECLUB_BASE}`;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const rate = this.totalCount > 0 ? this.successCount / this.totalCount : 1;
    return {
      platform: "reclub",
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
