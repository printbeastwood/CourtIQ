import type {
  PlatformAdapter,
  AdapterHealth,
  DateRange,
  Region,
  Slot,
  Venue,
} from "@courtiq/shared";

/**
 * Reclub adapter — API-based.
 *
 * Reclub exposes a public REST API at https://api.reclub.co.
 * Key endpoints used:
 *   GET /groups/{id}           — club/group details
 *   GET /groups/{id}/activities — upcoming organised games (venue, date, price, participants)
 *   GET /communities/{id}      — community location data
 *
 * Reclub is a social sports organiser: "activities" are organised game sessions
 * (Americano, social doubles, ladder runs) rather than individual court bookings.
 * We map these to our availability model as bookable time slots.
 */

const RECLUB_API = "https://api.reclub.co";
const RECLUB_WEB = "https://reclub.co";

/** Known Bangkok padel clubs on Reclub, discovered via website exploration. */
const KNOWN_BANGKOK_CLUBS: ReclubClubConfig[] = [
  { groupId: 2194, slug: "padel-asia", refCode: "ADRO4" },
];

interface ReclubClubConfig {
  groupId: number;
  slug: string;
  refCode: string;
}

interface ReclubGroup {
  id: number;
  name: string;
  slug: string;
  ref_code: string;
  community_id: number;
  sport_id: number;
  avatar_url: string | null;
  description: string | null;
  visibility: number;
  created_at: number;
  updated_at: number;
}

interface ReclubActivity {
  id: number;
  ref_code: string;
  title: string;
  description: string | null;
  location_name: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  starts_at: string;
  ends_at: string | null;
  duration: number; // seconds
  fee: number | null;
  currency: string | null;
  max_participants: number;
  current_participants: number;
  auto_approval: boolean;
  privacy: number;
  cancellation_hours: number | null;
  sport_id: number;
  group_id: number;
  format: string | null;
}

interface ReclubCommunity {
  id: number;
  name: string;
  lat: number;
  lng: number;
  timezone: string;
  currency: string;
  region: string;
}

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
      const venues: Venue[] = [];

      for (const club of KNOWN_BANGKOK_CLUBS) {
        const group = await this.fetchGroup(club.groupId);
        if (!group) continue;

        // Get community for location data
        const community = await this.fetchCommunity(group.community_id);
        const location = community
          ? { lat: community.lat, lng: community.lng }
          : { lat: 13.7563, lng: 100.502 }; // Bangkok fallback

        // Try to get more precise location from recent activities
        const activities = await this.fetchActivities(club.groupId);
        const activityWithLocation = activities.find(
          (a) => a.location_lat != null && a.location_lng != null
        );
        const preciseLocation = activityWithLocation
          ? { lat: activityWithLocation.location_lat!, lng: activityWithLocation.location_lng! }
          : location;

        const address = activityWithLocation?.location_address
          ?? `${community?.name ?? "Bangkok, Thailand"}`;

        venues.push({
          name: group.name,
          slug: `reclub-${club.slug}`,
          location: preciseLocation,
          address,
          amenities: [],
          sourcePlatform: "reclub",
          sourceId: String(club.groupId),
          metadata: {
            reclubSlug: club.slug,
            reclubRefCode: club.refCode,
            reclubGroupId: club.groupId,
            communityId: group.community_id,
            fetchedAt: new Date().toISOString(),
          },
        });
      }

      // Filter by region
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
      const groupId = parseInt(venueSourceId, 10);
      if (isNaN(groupId)) throw new Error(`Invalid Reclub group ID: ${venueSourceId}`);

      const group = await this.fetchGroup(groupId);
      if (!group) throw new Error(`Reclub group ${groupId} not found`);

      const clubConfig = KNOWN_BANGKOK_CLUBS.find((c) => c.groupId === groupId);
      const slug = clubConfig?.slug ?? group.slug;

      const community = await this.fetchCommunity(group.community_id);
      const activities = await this.fetchActivities(groupId);

      // Filter activities within the date range
      const fromMs = dateRange.from.getTime();
      const toMs = dateRange.to.getTime();
      const rangeActivities = activities.filter((a) => {
        const startMs = new Date(a.starts_at).getTime();
        return startMs >= fromMs && startMs <= toMs;
      });

      const now = new Date();
      const currency = (community?.currency ?? "THB") as "THB" | "USD" | "EUR";

      // Determine venue location from activities or community
      const activityWithLocation = activities.find(
        (a) => a.location_lat != null && a.location_lng != null
      );
      const location = activityWithLocation
        ? { lat: activityWithLocation.location_lat!, lng: activityWithLocation.location_lng! }
        : community
          ? { lat: community.lat, lng: community.lng }
          : { lat: 13.7563, lng: 100.502 };

      const address = activityWithLocation?.location_address
        ?? community?.name
        ?? "Bangkok, Thailand";

      // Reclub activities are organised games, not individual court bookings.
      // We represent each activity as a slot on a virtual "Organised Games" court.
      const slots: Omit<Slot, "id" | "courtId">[] = rangeActivities.map((a) => {
        const startsAt = new Date(a.starts_at);
        const endsAt = a.ends_at
          ? new Date(a.ends_at)
          : new Date(startsAt.getTime() + a.duration * 1000);
        const priceCents = a.fee != null ? Math.round(a.fee * 100) : 0;
        const spotsLeft = a.max_participants - a.current_participants;

        return {
          startsAt,
          endsAt,
          priceCents,
          currency,
          status: spotsLeft > 0 ? ("available" as const) : ("booked" as const),
          sourceBookingUrl: `${RECLUB_WEB}/clubs/@${slug}`,
          fetchedAt: now,
        };
      });

      this.trackSuccess();

      return {
        venue: {
          name: group.name,
          slug: `reclub-${slug}`,
          location,
          address,
          amenities: [],
          sourcePlatform: "reclub",
          sourceId: String(groupId),
          metadata: {
            reclubSlug: slug,
            reclubRefCode: clubConfig?.refCode ?? group.ref_code,
            reclubGroupId: groupId,
            fetchedAt: now.toISOString(),
          },
        },
        courts: slots.length > 0
          ? [
              {
                court: {
                  name: "Organised Games",
                  surface: "glass",
                  indoor: false,
                  metadata: {
                    type: "organised_activity",
                    note: "Reclub activities — social games, Americano, ladder runs",
                  },
                },
                slots,
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
    return slot.sourceBookingUrl || RECLUB_WEB;
  }

  async healthCheck(): Promise<AdapterHealth> {
    try {
      // Ping a known group to verify API is reachable
      const resp = await fetch(`${RECLUB_API}/groups/2194`);
      if (resp.ok) {
        this.trackSuccess();
      } else {
        this.trackError(new Error(`Reclub API health check returned ${resp.status}`));
      }
    } catch (err) {
      this.trackError(err);
    }

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

  // ── Private API helpers ──────────────────────────────────

  private async fetchGroup(groupId: number): Promise<ReclubGroup | null> {
    const resp = await fetch(`${RECLUB_API}/groups/${groupId}`);
    if (!resp.ok) {
      if (resp.status === 404) return null;
      throw new Error(`Reclub API /groups/${groupId} returned ${resp.status}`);
    }
    return (await resp.json()) as ReclubGroup;
  }

  private async fetchCommunity(communityId: number): Promise<ReclubCommunity | null> {
    const resp = await fetch(`${RECLUB_API}/communities/${communityId}`);
    if (!resp.ok) {
      if (resp.status === 404) return null;
      throw new Error(`Reclub API /communities/${communityId} returned ${resp.status}`);
    }
    return (await resp.json()) as ReclubCommunity;
  }

  private async fetchActivities(groupId: number): Promise<ReclubActivity[]> {
    const resp = await fetch(`${RECLUB_API}/groups/${groupId}/activities`);
    if (!resp.ok) {
      if (resp.status === 404) return [];
      throw new Error(`Reclub API /groups/${groupId}/activities returned ${resp.status}`);
    }
    const data = await resp.json();
    // API may return an array directly or an object with an array
    if (Array.isArray(data)) return data as ReclubActivity[];
    if (data && typeof data === "object" && "activities" in data) {
      return (data as { activities: ReclubActivity[] }).activities;
    }
    return [];
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
