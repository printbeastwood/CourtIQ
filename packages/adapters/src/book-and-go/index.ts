import type {
  PlatformAdapter,
  AdapterHealth,
  DateRange,
  Region,
  Slot,
  Venue,
} from "@courtiq/shared";

/**
 * Book & Go adapter — white-label sports booking platform.
 *
 * Book & Go (bookandgo.app) is a white-label mobile booking system used by
 * multiple Bangkok padel venues. Each venue gets a branded iOS/Android app
 * powered by the same backend at api.bookandgo.app.
 *
 * API status: BLOCKED — the API requires authentication and we have not yet
 * reverse-engineered the mobile app endpoints. The adapter is structured
 * with all known venue data and ready to be completed once API access is
 * established (via app traffic interception or partnership).
 *
 * Venues covered:
 *   - Kross Padel On Nut (iOS app 6741785490, pkg com.krosspadel.bookandgo)
 *   - Kross Padel Indoor / Rama IV
 *   - Kross Padel Sky Thonglor
 *   - Kross Padel Asoke
 *   - Sterling Sport and Wellness (iOS app 6755016241)
 */

const BOOKANDGO_API = "https://api.bookandgo.app";

interface BookAndGoClub {
  name: string;
  slug: string;
  address: string;
  location: { lat: number; lng: number };
  appId: string;
  courtCount: number;
  metadata: Record<string, unknown>;
}

/** Known Bangkok venues on the Book & Go platform. */
const KNOWN_CLUBS: BookAndGoClub[] = [
  {
    name: "Kross Padel On Nut",
    slug: "kross-padel-on-nut",
    address: "89 Soi Chinnamat, Phra Khanong, Watthana, Bangkok 10110",
    location: { lat: 13.7113, lng: 100.5998 },
    appId: "kross-onnut",
    courtCount: 3,
    metadata: { brand: "kross", iosAppId: "6741785490", androidPkg: "com.krosspadel.bookandgo" },
  },
  {
    name: "Kross Padel Indoor / Rama IV",
    slug: "kross-padel-rama-iv",
    address: "135 Ardnarong Road, Khlong Toei, Bangkok 10110",
    location: { lat: 13.7175, lng: 100.5543 },
    appId: "kross-ramaiv",
    courtCount: 3,
    metadata: { brand: "kross", iosAppId: "6741785490" },
  },
  {
    name: "Kross Padel Sky Thonglor",
    slug: "kross-padel-thonglor",
    address: "Sukhumvit 49, Khlong Tan Nuea, Watthana, Bangkok 10110",
    location: { lat: 13.7326, lng: 100.5833 },
    appId: "kross-thonglor",
    courtCount: 4,
    metadata: { brand: "kross", iosAppId: "6741785490" },
  },
  {
    name: "Kross Padel Asoke",
    slug: "kross-padel-asoke",
    address: "30 Sukhumvit 21 Rd, Khlong Toei Nuea, Watthana, Bangkok 10110",
    location: { lat: 13.7381, lng: 100.5603 },
    appId: "kross-asoke",
    courtCount: 3,
    metadata: { brand: "kross", iosAppId: "6741785490" },
  },
  {
    name: "Sterling Sport and Wellness",
    slug: "sterling-sport-wellness",
    address: "Sukhumvit 24, Khlong Tan, Khlong Toei, Bangkok 10110",
    location: { lat: 13.7247, lng: 100.5676 },
    appId: "sterling",
    courtCount: 5,
    metadata: { brand: "sterling", iosAppId: "6755016241", website: "https://sterlingbkk.com" },
  },
];

export class BookAndGoAdapter implements PlatformAdapter {
  readonly platform = "book_and_go";

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
      // TODO: Once API access is established, fetch live venue data.
      // For now, return known venues filtered by region.
      const venues: Venue[] = KNOWN_CLUBS.map((club) => ({
        name: club.name,
        slug: `bookandgo-${club.slug}`,
        location: club.location,
        address: club.address,
        amenities: [],
        sourcePlatform: "book_and_go" as const,
        sourceId: club.appId,
        metadata: { ...club.metadata, courtCount: club.courtCount, fetchedAt: new Date().toISOString() },
      }));

      const filtered = venues.filter((v) => {
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
      const club = KNOWN_CLUBS.find((c) => c.appId === venueSourceId);
      if (!club) throw new Error(`Unknown Book & Go venue: ${venueSourceId}`);

      // TODO: Once API access is established, replace this with live API calls.
      // Expected API pattern (needs verification via app traffic interception):
      //   GET /api/v1/clubs/{clubId}/availability?date=YYYY-MM-DD
      //   GET /api/v1/clubs/{clubId}/courts
      //
      // For now, return the venue with empty availability to signal
      // that the adapter is registered but not yet fetching live data.

      this.trackSuccess();

      return {
        venue: {
          name: club.name,
          slug: `bookandgo-${club.slug}`,
          location: club.location,
          address: club.address,
          amenities: [],
          sourcePlatform: "book_and_go",
          sourceId: club.appId,
          metadata: { ...club.metadata, fetchedAt: new Date().toISOString() },
        },
        courts: [],
      };
    } catch (err) {
      this.trackError(err);
      throw err;
    }
  }

  getBookingUrl(slot: Slot): string {
    // Deep-link into the Kross/Sterling app if available, fallback to website
    return slot.sourceBookingUrl || "https://krosspadel.com";
  }

  async healthCheck(): Promise<AdapterHealth> {
    try {
      // Ping the Book & Go API root to check reachability
      const resp = await fetch(BOOKANDGO_API);
      if (resp.ok) {
        this.trackSuccess();
      } else {
        this.trackError(new Error(`Book & Go API returned ${resp.status}`));
      }
    } catch (err) {
      this.trackError(err);
    }

    const rate = this.totalCount > 0 ? this.successCount / this.totalCount : 1;
    return {
      platform: "book_and_go",
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
