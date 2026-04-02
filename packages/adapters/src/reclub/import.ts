import type {
  PlayerImportAdapter,
  PlatformCredentials,
  ImportedPlayerProfile,
  ImportedMatchRecord,
  ImportedBookingRecord,
  ImportedContact,
} from "@courtiq/shared";

/**
 * Reclub player import adapter.
 *
 * Reclub API (auth required — Bearer token):
 *   GET /users/me               — user profile
 *   GET /users/me/activities    — past activity participations (organised games)
 *   GET /users/me/groups        — groups/clubs the user belongs to
 *   GET /users/me/friends       — friend list
 *
 * Reclub is a social organiser — "activities" are group games (Americano, social
 * doubles) rather than individual bookings. We import these as both match and booking records.
 */

const RECLUB_API = "https://api.reclub.co";

interface ReclubUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  level: number | null;
  created_at: string;
}

interface ReclubPastActivity {
  id: number;
  ref_code: string;
  title: string;
  location_name: string | null;
  starts_at: string;
  ends_at: string | null;
  duration: number;
  fee: number | null;
  currency: string | null;
  format: string | null;
  group_name: string | null;
  participants: Array<{
    user_id: number;
    name: string;
    avatar_url: string | null;
  }>;
}

interface ReclubFriend {
  id: number;
  name: string;
  avatar_url: string | null;
}

export class ReclubImportAdapter implements PlayerImportAdapter {
  readonly platform = "reclub" as const;

  private async authedFetch(url: string, credentials: PlatformCredentials): Promise<Response> {
    const token = credentials.accessToken;
    if (!token) throw new Error("Reclub access token required");

    return fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async fetchPlayerProfile(credentials: PlatformCredentials): Promise<ImportedPlayerProfile | null> {
    try {
      const resp = await this.authedFetch(`${RECLUB_API}/users/me`, credentials);
      if (!resp.ok) return null;

      const user = (await resp.json()) as ReclubUser;
      return {
        platform: "reclub",
        platformUserId: String(user.id),
        displayName: user.name,
        avatarUrl: user.avatar_url,
        rating: user.level,
        ratingLabel: user.level != null ? `Level ${user.level}` : null,
        preferredHand: null,
        preferredPosition: null,
        memberSince: user.created_at,
      };
    } catch {
      return null;
    }
  }

  async fetchMatchHistory(credentials: PlatformCredentials): Promise<ImportedMatchRecord[]> {
    try {
      const resp = await this.authedFetch(
        `${RECLUB_API}/users/me/activities?past=true&size=200`,
        credentials
      );
      if (!resp.ok) return [];

      const data = await resp.json();
      const activities: ReclubPastActivity[] = Array.isArray(data)
        ? data
        : (data as { activities: ReclubPastActivity[] }).activities ?? [];

      return activities.map((a) => {
        const opponents = a.participants
          .filter((p) => p.name)
          .map((p) => p.name);

        return {
          platform: "reclub" as const,
          platformMatchId: String(a.id),
          opponentName: opponents.length > 0 ? opponents.join(", ") : null,
          opponentPlatformId: a.participants[0] ? String(a.participants[0].user_id) : null,
          format: a.format === "singles" ? ("singles" as const) : ("doubles" as const),
          playerScore: null, // Reclub doesn't track scores
          opponentScore: null,
          result: null,
          playedAt: a.starts_at,
          venueName: a.location_name ?? a.group_name,
          courtName: null,
          notes: a.title,
        };
      });
    } catch {
      return [];
    }
  }

  async fetchBookingHistory(credentials: PlatformCredentials): Promise<ImportedBookingRecord[]> {
    try {
      const resp = await this.authedFetch(
        `${RECLUB_API}/users/me/activities?past=true&size=200`,
        credentials
      );
      if (!resp.ok) return [];

      const data = await resp.json();
      const activities: ReclubPastActivity[] = Array.isArray(data)
        ? data
        : (data as { activities: ReclubPastActivity[] }).activities ?? [];

      return activities.map((a) => ({
        platform: "reclub" as const,
        platformBookingId: String(a.id),
        venueName: a.location_name ?? a.group_name ?? "Reclub Activity",
        courtName: null,
        startsAt: a.starts_at,
        endsAt: a.ends_at ?? new Date(new Date(a.starts_at).getTime() + a.duration * 1000).toISOString(),
        priceCents: a.fee != null ? Math.round(a.fee * 100) : null,
        currency: a.currency,
      }));
    } catch {
      return [];
    }
  }

  async fetchContacts(credentials: PlatformCredentials): Promise<ImportedContact[]> {
    try {
      const resp = await this.authedFetch(`${RECLUB_API}/users/me/friends`, credentials);
      if (!resp.ok) return [];

      const data = await resp.json();
      const friends: ReclubFriend[] = Array.isArray(data)
        ? data
        : (data as { friends: ReclubFriend[] }).friends ?? [];

      return friends.map((f) => ({
        platform: "reclub" as const,
        platformUserId: String(f.id),
        displayName: f.name,
        avatarUrl: f.avatar_url,
      }));
    } catch {
      return [];
    }
  }
}
