import type {
  MigrationAdapter,
} from "@courtiq/shared";
import type {
  MigrationCredentials,
  MigrationData,
  ImportedMatch,
  ImportedBooking,
  ImportedConnection,
  MigrationPlayerProfile,
} from "@courtiq/shared";

const PLAYTOMIC_API = "https://playtomic.io/api/v1";

interface PlaytomicAuthResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
  expires_in: number;
}

interface PlaytomicUser {
  user_id: string;
  full_name: string;
  profile_picture_url?: string;
  level?: number;
  level_padel?: number;
  registered_at?: string;
  gender?: string;
  birthdate?: string;
  preferred_sport?: string;
  plays_right_handed?: boolean;
}

interface PlaytomicMatch {
  match_id: string;
  date: string;
  start_time: string;
  duration: number;
  tenant_name: string;
  resource_name?: string;
  sport_id: string;
  teams: Array<{
    players: Array<{ user_id: string; full_name: string; level?: number }>;
    score?: number[];
  }>;
  winner_team_index?: number;
}

interface PlaytomicBooking {
  booking_id: string;
  date: string;
  start_time: string;
  duration: number;
  tenant_id: string;
  tenant_name: string;
  resource_name?: string;
  price: number;
  currency: string;
  status: string;
}

interface PlaytomicFriend {
  user_id: string;
  full_name: string;
  profile_picture_url?: string;
  level_padel?: number;
}

export class PlaytomicMigrationAdapter implements MigrationAdapter {
  readonly platform = "playtomic";

  async validateCredentials(credentials: MigrationCredentials): Promise<boolean> {
    try {
      const token = await this.resolveToken(credentials);
      const resp = await fetch(`${PLAYTOMIC_API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async extractUserData(credentials: MigrationCredentials): Promise<MigrationData> {
    const token = await this.resolveToken(credentials);
    const headers = { Authorization: `Bearer ${token}` };

    const [profile, matches, bookings, connections] = await Promise.all([
      this.fetchProfile(headers),
      this.fetchMatches(headers),
      this.fetchBookings(headers),
      this.fetchFriends(headers),
    ]);

    return { profile, matches, bookings, connections };
  }

  private async resolveToken(credentials: MigrationCredentials): Promise<string> {
    if (credentials.accessToken) return credentials.accessToken;

    if (credentials.email) {
      const resp = await fetch(`${PLAYTOMIC_API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: credentials.email }),
      });
      if (!resp.ok) throw new Error(`Playtomic auth failed: ${resp.status}`);
      const data = (await resp.json()) as PlaytomicAuthResponse;
      return data.access_token;
    }

    throw new Error("Playtomic migration requires an accessToken or email");
  }

  private async fetchProfile(headers: Record<string, string>): Promise<MigrationPlayerProfile> {
    const resp = await fetch(`${PLAYTOMIC_API}/users/me`, { headers });
    if (!resp.ok) return { metadata: {} };

    const user = (await resp.json()) as PlaytomicUser;
    return {
      displayName: user.full_name,
      rating: user.level_padel ?? user.level,
      ratingSystem: "playtomic_level",
      preferredHand: user.plays_right_handed === false ? "left" : "right",
      avatarUrl: user.profile_picture_url,
      memberSince: user.registered_at ? new Date(user.registered_at) : undefined,
      metadata: {
        playtomicUserId: user.user_id,
        gender: user.gender,
        birthdate: user.birthdate,
      },
    };
  }

  private async fetchMatches(headers: Record<string, string>): Promise<ImportedMatch[]> {
    const matches: ImportedMatch[] = [];
    let page = 0;
    const pageSize = 50;

    while (true) {
      const params = new URLSearchParams({
        page: String(page),
        size: String(pageSize),
        sport_id: "PADEL",
      });

      const resp = await fetch(`${PLAYTOMIC_API}/users/me/matches?${params}`, { headers });
      if (!resp.ok) break;

      const data = (await resp.json()) as PlaytomicMatch[];
      if (data.length === 0) break;

      for (const m of data) {
        const userTeamIdx = m.teams.findIndex((t) =>
          t.players.some((p) => p.user_id !== undefined)
        );
        const userTeam = m.teams[userTeamIdx];
        const opponentTeam = m.teams[1 - userTeamIdx];

        let result: "won" | "lost" | "draw" | undefined;
        if (m.winner_team_index !== undefined) {
          result = m.winner_team_index === userTeamIdx ? "won" : "lost";
        }

        const score = m.teams
          .map((t) => t.score?.join("-"))
          .filter(Boolean)
          .join(" / ");

        matches.push({
          platformMatchId: m.match_id,
          playedAt: new Date(`${m.date}T${m.start_time}`),
          venueName: m.tenant_name,
          courtName: m.resource_name,
          format: m.teams.length === 2 && m.teams[0].players.length >= 2 ? "doubles" : "singles",
          result,
          score: score || undefined,
          partnerNames: userTeam?.players
            .filter((p) => p.full_name)
            .map((p) => p.full_name) ?? [],
          opponentNames: opponentTeam?.players
            .filter((p) => p.full_name)
            .map((p) => p.full_name) ?? [],
          durationMinutes: m.duration,
          metadata: { playtomicMatchId: m.match_id },
        });
      }

      if (data.length < pageSize) break;
      page++;
    }

    return matches;
  }

  private async fetchBookings(headers: Record<string, string>): Promise<ImportedBooking[]> {
    const resp = await fetch(
      `${PLAYTOMIC_API}/users/me/bookings?size=100&sport_id=PADEL`,
      { headers }
    );
    if (!resp.ok) return [];

    const data = (await resp.json()) as PlaytomicBooking[];
    return data.map((b) => ({
      bookedAt: new Date(`${b.date}T${b.start_time}`),
      venueName: b.tenant_name,
      courtName: b.resource_name,
      timeSlot: `${b.start_time}-${addMinutes(b.start_time, b.duration)}`,
      pricePaid: b.price,
      currency: b.currency,
      metadata: { playtomicBookingId: b.booking_id, status: b.status },
    }));
  }

  private async fetchFriends(headers: Record<string, string>): Promise<ImportedConnection[]> {
    const resp = await fetch(`${PLAYTOMIC_API}/users/me/friends?size=200`, { headers });
    if (!resp.ok) return [];

    const data = (await resp.json()) as PlaytomicFriend[];
    return data.map((f) => ({
      platformUserId: f.user_id,
      displayName: f.full_name,
      skillLevel: f.level_padel ? String(f.level_padel) : undefined,
      metadata: { avatarUrl: f.profile_picture_url },
    }));
  }
}

function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMin = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const mm = String(totalMin % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
