import type {
  PlatformAdapter,
  AdapterHealth,
  DateRange,
  Region,
  Slot,
  Venue,
} from "@courtiq/shared";

/**
 * MATCHi adapter — web scraping / HTML parsing.
 *
 * MATCHi (matchi.se) is a global racket sports booking platform (Grails/Java backend).
 *
 * API endpoints discovered:
 *   GET /facilities/findFacilities?lat=X&lng=Y&sport=PADEL  — venue search (returns HTML with structured data)
 *   GET /facilities/{slug}                                  — venue detail page
 *   GET /book/schedule?wl=&facilityId={id}&date=YYYY-MM-DD  — schedule grid (HTML, requires parsing)
 *   GET /book/listSlots?wl=&facility={id}&date=YYYY-MM-DD   — slot list (HTML, mobile view)
 *
 * Venues covered (Bangkok):
 *   - Bangkok Padel (facilityId=1562, slug=bangkokpadel) — 2 rooftop courts at Ambassador Hotel
 *   - The Padel Co. (On Nut) — 2 indoor courts (also on Playtomic)
 */

const MATCHI_BASE = "https://matchi.se";

interface MatchiVenueConfig {
  facilityId: number;
  slug: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  courtCount: number;
  indoor: boolean;
  surface: string;
}

/** Known Bangkok padel venues on MATCHi. */
const KNOWN_BANGKOK_VENUES: MatchiVenueConfig[] = [
  {
    facilityId: 1562,
    slug: "bangkokpadel",
    name: "Bangkok Padel",
    address: "Ambassador Hotel, 171 Sukumvit 11 Alley, Sukhumvit Road, 10110, Bangkok",
    location: { lat: 13.7446, lng: 100.5578 },
    courtCount: 2,
    indoor: false,
    surface: "turf",
  },
];

export class MatchiAdapter implements PlatformAdapter {
  readonly platform = "matchi";

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
      const venues: Venue[] = [];

      // Try live search first
      const liveVenues = await this.searchFacilities(region);
      if (liveVenues.length > 0) {
        venues.push(...liveVenues);
      } else {
        // Fall back to known venues
        for (const v of KNOWN_BANGKOK_VENUES) {
          const dist = haversineKm(region.center, v.location);
          if (dist <= region.radiusKm) {
            venues.push(this.configToVenue(v));
          }
        }
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
      const facilityId = parseInt(venueSourceId, 10);
      if (isNaN(facilityId)) throw new Error(`Invalid MATCHi facility ID: ${venueSourceId}`);

      const config = KNOWN_BANGKOK_VENUES.find((v) => v.facilityId === facilityId);
      const venue = config
        ? this.configToVenue(config)
        : {
            name: `MATCHi Facility ${facilityId}`,
            slug: `matchi-${facilityId}`,
            location: { lat: 13.7563, lng: 100.502 },
            address: "Bangkok, Thailand",
            amenities: [] as string[],
            sourcePlatform: "matchi" as const,
            sourceId: String(facilityId),
            metadata: { facilityId, fetchedAt: new Date().toISOString() },
          };

      // Fetch schedule for each date in range
      const allSlots: Omit<Slot, "id" | "courtId">[] = [];
      const current = new Date(dateRange.from);
      const end = dateRange.to;

      while (current <= end) {
        const dateStr = current.toISOString().slice(0, 10);
        const daySlots = await this.fetchScheduleForDate(facilityId, dateStr, config?.slug);
        allSlots.push(...daySlots);
        current.setDate(current.getDate() + 1);
      }

      this.trackSuccess();

      const courtName = config ? `${config.name} Courts` : `Facility ${facilityId} Courts`;
      return {
        venue,
        courts: allSlots.length > 0
          ? [
              {
                court: {
                  name: courtName,
                  surface: config?.surface ?? "turf",
                  indoor: config?.indoor ?? false,
                  metadata: { facilityId },
                },
                slots: allSlots,
              },
            ]
          : [],
      };
    } catch (err) {
      this.trackError(err);
      throw err;
    }
  }

  getBookingUrl(slot: Slot): string {
    return slot.sourceBookingUrl || MATCHI_BASE;
  }

  async healthCheck(): Promise<AdapterHealth> {
    try {
      const resp = await fetch(`${MATCHI_BASE}/facilities/bangkokpadel`);
      if (resp.ok) {
        this.trackSuccess();
      } else {
        this.trackError(new Error(`MATCHi returned ${resp.status}`));
      }
    } catch (err) {
      this.trackError(err);
    }

    const rate = this.totalCount > 0 ? this.successCount / this.totalCount : 1;
    return {
      platform: "matchi",
      healthy: rate > 0.8,
      lastSuccessAt: this.lastSuccessAt,
      lastErrorAt: this.lastErrorAt,
      lastError: this.lastError,
      successRate: rate,
    };
  }

  // ── Private helpers ──────────────────────────────────

  private configToVenue(config: MatchiVenueConfig): Venue {
    return {
      name: config.name,
      slug: `matchi-${config.slug}`,
      location: config.location,
      address: config.address,
      amenities: [],
      sourcePlatform: "matchi",
      sourceId: String(config.facilityId),
      metadata: {
        matchiSlug: config.slug,
        facilityId: config.facilityId,
        courtCount: config.courtCount,
        indoor: config.indoor,
        surface: config.surface,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Search MATCHi facility directory for padel venues near a region.
   * Parses HTML from /facilities/findFacilities.
   */
  private async searchFacilities(region: Region): Promise<Venue[]> {
    const url = `${MATCHI_BASE}/facilities/findFacilities?lat=${region.center.lat}&lng=${region.center.lng}&sport=PADEL`;
    const resp = await fetch(url);
    if (!resp.ok) return [];

    const html = await resp.text();
    const venues: Venue[] = [];

    // Parse facility cards from HTML.
    // MATCHi facility cards contain: name, slug (in link), address, court count.
    // Pattern: <a href="/facilities/{slug}"> with facility data nearby.
    const facilityPattern = /href="\/facilities\/([^"]+)"[^>]*>[\s\S]*?<h4[^>]*>([^<]+)<\/h4>[\s\S]*?<small[^>]*>([^<]*)<\/small>/g;
    let match: RegExpExecArray | null;

    while ((match = facilityPattern.exec(html)) !== null) {
      const [, slug, name, address] = match;
      if (!slug || !name) continue;

      // Check if we have config for this venue
      const config = KNOWN_BANGKOK_VENUES.find((v) => v.slug === slug);
      const location = config?.location ?? region.center;

      const dist = haversineKm(region.center, location);
      if (dist > region.radiusKm) continue;

      venues.push({
        name: name.trim(),
        slug: `matchi-${slug}`,
        location,
        address: address?.trim() ?? "",
        amenities: [],
        sourcePlatform: "matchi",
        sourceId: config ? String(config.facilityId) : slug,
        metadata: {
          matchiSlug: slug,
          facilityId: config?.facilityId,
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    return venues;
  }

  /**
   * Fetch the schedule page for a specific facility and date, parse slots.
   * MATCHi renders an HTML table with time slots — we extract available slots.
   */
  private async fetchScheduleForDate(
    facilityId: number,
    dateStr: string,
    slug?: string
  ): Promise<Omit<Slot, "id" | "courtId">[]> {
    const url = `${MATCHI_BASE}/book/schedule?wl=&facilityId=${facilityId}&date=${dateStr}`;
    const resp = await fetch(url);
    if (!resp.ok) return [];

    const html = await resp.text();
    const slots: Omit<Slot, "id" | "courtId">[] = [];
    const now = new Date();

    // MATCHi schedule HTML contains slot elements with time and price data.
    // Pattern varies but typically includes data attributes or structured class names.
    // We look for bookable slot anchors with time/price info.
    const slotPattern = /data-slot-time="(\d{2}:\d{2})"[^>]*data-slot-price="([\d.]+)"[^>]*data-slot-currency="([^"]+)"/g;
    let slotMatch: RegExpExecArray | null;

    while ((slotMatch = slotPattern.exec(html)) !== null) {
      const [, time, price, currency] = slotMatch;
      if (!time || !price) continue;

      const [hours, minutes] = time.split(":").map(Number);
      const startsAt = new Date(`${dateStr}T${time}:00+07:00`); // Bangkok timezone
      const endsAt = new Date(startsAt.getTime() + 90 * 60_000); // Default 90 min
      const priceCents = Math.round(parseFloat(price) * 100);
      const normalizedCurrency = normalizeCurrency(currency ?? "THB");

      const bookingUrl = slug
        ? `${MATCHI_BASE}/facilities/${slug}?date=${dateStr}`
        : `${MATCHI_BASE}/book/schedule?facilityId=${facilityId}&date=${dateStr}`;

      slots.push({
        startsAt,
        endsAt,
        priceCents,
        currency: normalizedCurrency,
        status: "available",
        sourceBookingUrl: bookingUrl,
        fetchedAt: now,
      });
    }

    // Fallback: try parsing from table structure if data attributes not found
    if (slots.length === 0) {
      const timePattern = /(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})[\s\S]*?(\d+(?:\.\d+)?)\s*(?:THB|SEK|EUR|USD)/g;
      let timeMatch: RegExpExecArray | null;

      while ((timeMatch = timePattern.exec(html)) !== null) {
        const [, startTime, endTime, price] = timeMatch;
        if (!startTime || !endTime || !price) continue;

        const startsAt = new Date(`${dateStr}T${startTime}:00+07:00`);
        const endsAt = new Date(`${dateStr}T${endTime}:00+07:00`);
        const priceCents = Math.round(parseFloat(price) * 100);

        const bookingUrl = slug
          ? `${MATCHI_BASE}/facilities/${slug}?date=${dateStr}`
          : `${MATCHI_BASE}/book/schedule?facilityId=${facilityId}&date=${dateStr}`;

        slots.push({
          startsAt,
          endsAt,
          priceCents,
          currency: "THB",
          status: "available",
          sourceBookingUrl: bookingUrl,
          fetchedAt: now,
        });
      }
    }

    return slots;
  }
}

function normalizeCurrency(raw: string): "THB" | "USD" | "EUR" {
  const upper = raw.toUpperCase();
  if (upper === "THB" || upper === "USD" || upper === "EUR") {
    return upper;
  }
  return "THB";
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
