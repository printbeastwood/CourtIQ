import type {
  PlatformAdapter,
  AdapterHealth,
  DateRange,
  Region,
  Slot,
  Venue,
} from "@courtiq/shared";

/**
 * Padel Mates adapter — API-based.
 *
 * Padel Mates (padelmates.se) is a padel booking and social platform.
 * Developer: Neovotech. Backends:
 *   - FastAPI: https://fastapi-production-fargate.padelmates.io
 *   - NestJS:  https://nestjs-production-fargate.padelmates.io
 *
 * Public endpoints (no auth):
 *   GET /location/  — returns all registered club locations globally (400+)
 *
 * Auth-required endpoints (HTTPBearer):
 *   GET /home/activity/?club_id=X&start=Y&end=Z  — activities/bookings
 *   GET /home/activity/book_court/crud?activity_record_id=X — booking details
 *   GET /home/activity/match/crud?activity_record_id=X — match details
 *
 * Venues covered (Bangkok):
 *   - Bel Club 22 (3 premium courts, Phetchaburi Rd)
 *   - Bangkok Padel, Pad Thai Padel, Kross Padel venues (also on other platforms)
 */

const PADELMATES_API = "https://fastapi-production-fargate.padelmates.io";
const PADELMATES_WEB = "https://padelmates.se";

interface PadelMatesLocation {
  _id: string;
  name: string;
  gameType: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string;
  lat: number | string;
  long: number | string;
  loc: { type: string; coordinates: number[] } | null;
  rating: number;
}

export class PadelMatesAdapter implements PlatformAdapter {
  readonly platform = "padel_mates";

  private lastSuccessAt: Date | null = null;
  private lastErrorAt: Date | null = null;
  private lastError: string | null = null;
  private successCount = 0;
  private totalCount = 0;
  private locationCache: PadelMatesLocation[] | null = null;
  private locationCacheAt: number = 0;

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
      const locations = await this.getLocations();

      const venues: Venue[] = [];
      for (const loc of locations) {
        if (loc.gameType !== "padel") continue;

        const lat = typeof loc.lat === "string" ? parseFloat(loc.lat) : loc.lat;
        const lng = typeof loc.long === "string" ? parseFloat(loc.long) : loc.long;
        if (isNaN(lat) || isNaN(lng)) continue;

        const dist = haversineKm(region.center, { lat, lng });
        if (dist > region.radiusKm) continue;

        venues.push({
          name: loc.name,
          slug: `padelmates-${slugify(loc.name)}`,
          location: { lat, lng },
          address: loc.address,
          amenities: [],
          sourcePlatform: "padel_mates",
          sourceId: loc._id,
          metadata: {
            padelMatesId: loc._id,
            phone: loc.phone,
            email: loc.email,
            website: loc.website,
            rating: loc.rating,
            fetchedAt: new Date().toISOString(),
          },
        });
      }

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
      // Get venue info from locations
      const locations = await this.getLocations();
      const loc = locations.find((l) => l._id === venueSourceId);

      const lat = loc ? (typeof loc.lat === "string" ? parseFloat(loc.lat) : loc.lat) : 13.7563;
      const lng = loc ? (typeof loc.long === "string" ? parseFloat(loc.long) : loc.long) : 100.502;

      const venue: Venue = {
        name: loc?.name ?? `Padel Mates Venue ${venueSourceId}`,
        slug: `padelmates-${loc ? slugify(loc.name) : venueSourceId}`,
        location: { lat, lng },
        address: loc?.address ?? "Bangkok, Thailand",
        amenities: [],
        sourcePlatform: "padel_mates",
        sourceId: venueSourceId,
        metadata: {
          padelMatesId: venueSourceId,
          fetchedAt: new Date().toISOString(),
        },
      };

      // TODO: Activity listing requires HTTPBearer auth.
      // Once we have user credentials or API partnership, call:
      //   GET /home/activity/?club_id={clubId}&start={ms}&end={ms}
      // The location _id may not directly map to club_id in the activity system.
      // Need to discover the club_id mapping (possibly via signup/registration).

      this.trackSuccess();

      return { venue, courts: [] };
    } catch (err) {
      this.trackError(err);
      throw err;
    }
  }

  getBookingUrl(slot: Slot): string {
    return slot.sourceBookingUrl || PADELMATES_WEB;
  }

  async healthCheck(): Promise<AdapterHealth> {
    try {
      const resp = await fetch(`${PADELMATES_API}/location/`);
      if (resp.ok) {
        this.trackSuccess();
      } else {
        this.trackError(new Error(`Padel Mates API returned ${resp.status}`));
      }
    } catch (err) {
      this.trackError(err);
    }

    const rate = this.totalCount > 0 ? this.successCount / this.totalCount : 1;
    return {
      platform: "padel_mates",
      healthy: rate > 0.8,
      lastSuccessAt: this.lastSuccessAt,
      lastErrorAt: this.lastErrorAt,
      lastError: this.lastError,
      successRate: rate,
    };
  }

  // ── Private helpers ──────────────────────────────────

  /** Fetch and cache all registered locations (5-min TTL). */
  private async getLocations(): Promise<PadelMatesLocation[]> {
    const now = Date.now();
    if (this.locationCache && now - this.locationCacheAt < 5 * 60_000) {
      return this.locationCache;
    }

    const resp = await fetch(`${PADELMATES_API}/location/`);
    if (!resp.ok) throw new Error(`Padel Mates /location/ returned ${resp.status}`);

    const data = (await resp.json()) as PadelMatesLocation[];
    this.locationCache = data;
    this.locationCacheAt = now;
    return data;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
