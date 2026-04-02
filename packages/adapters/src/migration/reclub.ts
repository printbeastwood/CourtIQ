import type { MigrationAdapter } from "@courtiq/shared";
import type {
  MigrationCredentials,
  MigrationData,
  ImportedMatch,
  ImportedBooking,
  ImportedConnection,
  ImportedPlayerProfile,
} from "@courtiq/shared";

const RECLUB_API = "https://api.reclub.co";

interface ReclubUser {
  id: string;
  name: string;
  avatar_url?: string;
  level?: number;
  joined_at?: string;
}

interface ReclubActivity {
  id: string;
  type: string;
  date: string;
  start_time: string;
  end_time: string;
  location_name: string;
  court_name?: string;
  participants: Array<{
    user_id: string;
    name: string;
    level?: number;
  }>;
  result?: { team1_score?: number[]; team2_score?: number[]; winner_team?: number };
}

interface ReclubBookingRecord {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  location_name: string;
  court_name?: string;
  price?: number;
  currency?: string;
  status: string;
}

export class ReclubMigrationAdapter implements MigrationAdapter {
  readonly platform = "reclub";

  async validateCredentials(credentials: MigrationCredentials): Promise<boolean> {
    try {
      const token = credentials.accessToken;
      if (!token) return false;

      const resp = await fetch(`${RECLUB_API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async extractUserData(credentials: MigrationCredentials): Promise<MigrationData> {
    const token = credentials.accessToken;
    if (!token) throw new Error("Reclub migration requires an accessToken");

    const headers = { Authorization: `Bearer ${token}` };

    const [profile, activities, bookings, connections] = await Promise.all([
      this.fetchProfile(headers),
      this.fetchActivities(headers),
      this.fetchBookings(headers),
      this.fetchConnections(headers),
    ]);

    const matches = this.activitiesToMatches(activities);

    return { profile, matches, bookings, connections };
  }

  private async fetchProfile(headers: Record<string, string>): Promise<ImportedPlayerProfile> {
    try {
      const resp = await fetch(`${RECLUB_API}/users/me`, { headers });
      if (!resp.ok) return { metadata: {} };

      const user = (await resp.json()) as ReclubUser;
      return {
        displayName: user.name,
        rating: user.level,
        ratingSystem: "reclub_level",
        avatarUrl: user.avatar_url,
        memberSince: user.joined_at ? new Date(user.joined_at) : undefined,
        metadata: { reclubUserId: user.id },
      };
    } catch {
      return { metadata: {} };
    }
  }

  private async fetchActivities(headers: Record<string, string>): Promise<ReclubActivity[]> {
    try {
      const resp = await fetch(`${RECLUB_API}/users/me/activities?limit=200`, { headers });
      if (!resp.ok) return [];
      return (await resp.json()) as ReclubActivity[];
    } catch {
      return [];
    }
  }

  private async fetchBookings(headers: Record<string, string>): Promise<ImportedBooking[]> {
    try {
      const resp = await fetch(`${RECLUB_API}/users/me/bookings?limit=200`, { headers });
      if (!resp.ok) return [];

      const data = (await resp.json()) as ReclubBookingRecord[];
      return data.map((b) => ({
        bookedAt: new Date(`${b.date}T${b.start_time}`),
        venueName: b.location_name,
        courtName: b.court_name,
        timeSlot: `${b.start_time}-${b.end_time}`,
        pricePaid: b.price,
        currency: b.currency ?? "THB",
        metadata: { reclubBookingId: b.id, status: b.status },
      }));
    } catch {
      return [];
    }
  }

  private async fetchConnections(headers: Record<string, string>): Promise<ImportedConnection[]> {
    try {
      const resp = await fetch(`${RECLUB_API}/users/me/connections?limit=200`, { headers });
      if (!resp.ok) return [];

      const data = (await resp.json()) as Array<{ user_id: string; name: string; level?: number }>;
      return data.map((c) => ({
        platformUserId: c.user_id,
        displayName: c.name,
        skillLevel: c.level ? String(c.level) : undefined,
        metadata: { source: "reclub" },
      }));
    } catch {
      return [];
    }
  }

  private activitiesToMatches(activities: ReclubActivity[]): ImportedMatch[] {
    return activities
      .filter((a) => a.type === "match" || a.type === "game")
      .map((a) => {
        let result: "won" | "lost" | "draw" | undefined;
        if (a.result?.winner_team !== undefined) {
          result = a.result.winner_team === 0 ? "won" : "lost";
        }

        const score = a.result
          ? [a.result.team1_score?.join("-"), a.result.team2_score?.join("-")]
              .filter(Boolean)
              .join(" / ")
          : undefined;

        return {
          platformMatchId: a.id,
          playedAt: new Date(`${a.date}T${a.start_time}`),
          venueName: a.location_name,
          courtName: a.court_name,
          format: a.participants.length >= 4 ? "doubles" as const : "singles" as const,
          result,
          score: score || undefined,
          partnerNames: [] as string[],
          opponentNames: a.participants.map((p) => p.name),
          metadata: { reclubActivityId: a.id },
        };
      });
  }
}
