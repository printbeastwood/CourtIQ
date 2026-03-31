import type {
  PlatformAdapter,
  AdapterHealth,
  DateRange,
  Region,
  Slot,
  Venue,
} from "@courtiq/shared";

const PLAYTOMIC_API = "https://playtomic.io/api/v1";

interface PlaytomicTenant {
  tenant_id: string;
  tenant_name: string;
  address: { street: string; city: string; country: string };
  coord: { lat: number; lon: number };
  properties: { indoor?: boolean; surface_type?: string };
}

interface PlaytomicSlot {
  start_time: string;
  duration: number;
  price: string;
  currency: string;
  resource_id: string;
  resource_name: string;
}

export class PlaytomicAdapter implements PlatformAdapter {
  readonly platform = "playtomic";

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
      const params = new URLSearchParams({
        coordinate: `${region.center.lat},${region.center.lng}`,
        radius: String(region.radiusKm * 1000),
        sport_id: "PADEL",
        size: "50",
      });

      const resp = await fetch(`${PLAYTOMIC_API}/tenants?${params}`);
      if (!resp.ok) throw new Error(`Playtomic API ${resp.status}: ${resp.statusText}`);

      const tenants: PlaytomicTenant[] = await resp.json() as PlaytomicTenant[];

      this.trackSuccess();

      return tenants.map((t) => ({
        name: t.tenant_name,
        slug: `playtomic-${t.tenant_id}`,
        location: { lat: t.coord.lat, lng: t.coord.lon },
        address: [t.address.street, t.address.city, t.address.country]
          .filter(Boolean)
          .join(", "),
        amenities: [],
        sourcePlatform: "playtomic" as const,
        sourceId: t.tenant_id,
        metadata: { properties: t.properties },
      }));
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
      const localFrom = dateRange.from.toISOString().slice(0, 10);
      const localTo = dateRange.to.toISOString().slice(0, 10);

      // Fetch venue info
      const venueResp = await fetch(`${PLAYTOMIC_API}/tenants/${venueSourceId}`);
      if (!venueResp.ok) throw new Error(`Playtomic venue fetch ${venueResp.status}`);
      const tenant: PlaytomicTenant = await venueResp.json() as PlaytomicTenant;

      // Fetch availability
      const params = new URLSearchParams({
        local_start_min: `${localFrom}T00:00:00`,
        local_start_max: `${localTo}T23:59:59`,
        sport_id: "PADEL",
      });

      const slotsResp = await fetch(
        `${PLAYTOMIC_API}/tenants/${venueSourceId}/slots?${params}`
      );
      if (!slotsResp.ok) throw new Error(`Playtomic slots fetch ${slotsResp.status}`);
      const rawSlots: PlaytomicSlot[] = await slotsResp.json() as PlaytomicSlot[];

      const now = new Date();

      // Group slots by resource (court)
      const courtMap = new Map<
        string,
        {
          court: { name: string; surface: string; indoor: boolean; metadata: Record<string, unknown> };
          slots: Omit<Slot, "id" | "courtId">[];
        }
      >();

      for (const raw of rawSlots) {
        if (!courtMap.has(raw.resource_id)) {
          courtMap.set(raw.resource_id, {
            court: {
              name: raw.resource_name || `Court ${raw.resource_id}`,
              surface: tenant.properties?.surface_type || "glass",
              indoor: tenant.properties?.indoor ?? false,
              metadata: { playtomicResourceId: raw.resource_id },
            },
            slots: [],
          });
        }

        const startsAt = new Date(raw.start_time);
        const endsAt = new Date(startsAt.getTime() + raw.duration * 60_000);
        const priceCents = Math.round(parseFloat(raw.price) * 100);

        courtMap.get(raw.resource_id)!.slots.push({
          startsAt,
          endsAt,
          priceCents,
          currency: (raw.currency || "THB") as "THB" | "USD" | "EUR",
          status: "available",
          sourceBookingUrl: `https://playtomic.io/tenant/${venueSourceId}?date=${localFrom}`,
          fetchedAt: now,
        });
      }

      this.trackSuccess();

      return {
        venue: {
          name: tenant.tenant_name,
          slug: `playtomic-${tenant.tenant_id}`,
          location: { lat: tenant.coord.lat, lng: tenant.coord.lon },
          address: [tenant.address.street, tenant.address.city, tenant.address.country]
            .filter(Boolean)
            .join(", "),
          amenities: [],
          sourcePlatform: "playtomic",
          sourceId: tenant.tenant_id,
          metadata: { properties: tenant.properties },
        },
        courts: Array.from(courtMap.values()),
      };
    } catch (err) {
      this.trackError(err);
      throw err;
    }
  }

  getBookingUrl(slot: Slot): string {
    return slot.sourceBookingUrl;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const rate = this.totalCount > 0 ? this.successCount / this.totalCount : 1;
    return {
      platform: "playtomic",
      healthy: rate > 0.8,
      lastSuccessAt: this.lastSuccessAt,
      lastErrorAt: this.lastErrorAt,
      lastError: this.lastError,
      successRate: rate,
    };
  }
}
