import type { MigrationAdapter } from "@courtiq/shared";
import type {
  MigrationCredentials,
  MigrationData,
  ImportedMatch,
  ImportedBooking,
  MigrationPlayerProfile,
} from "@courtiq/shared";

const PADEL_MATES_API = "https://fastapi-production-fargate.padelmates.io";

interface PadelMatesUser {
  id: number;
  name: string;
  email?: string;
  level?: number;
  profile_image_url?: string;
  hand?: string;
  position?: string;
  member_since?: string;
}

interface PadelMatesActivity {
  activity_record_id: number;
  club_id: number;
  club_name: string;
  court_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  activity_type: string;
  price?: number;
  currency?: string;
}

interface PadelMatesMatchDetail {
  activity_record_id: number;
  match_type: string;
  teams: Array<{
    players: Array<{ name: string; level?: number }>;
    sets: number[];
  }>;
  winner_team_index?: number;
}

export class PadelMatesMigrationAdapter implements MigrationAdapter {
  readonly platform = "padel_mates";

  async validateCredentials(credentials: MigrationCredentials): Promise<boolean> {
    try {
      const token = credentials.accessToken;
      if (!token) return false;

      const resp = await fetch(`${PADEL_MATES_API}/user/me/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async extractUserData(credentials: MigrationCredentials): Promise<MigrationData> {
    const token = credentials.accessToken;
    if (!token) throw new Error("Padel Mates migration requires an accessToken (HTTPBearer)");

    const headers = { Authorization: `Bearer ${token}` };

    const [profile, activities] = await Promise.all([
      this.fetchProfile(headers),
      this.fetchActivities(headers),
    ] as const);

    const bookings = activities.map((a) => this.activityToBooking(a));
    const matches = await this.fetchMatchDetails(headers, activities);

    return { profile, matches, bookings, connections: [] };
  }

  private async fetchProfile(headers: Record<string, string>): Promise<MigrationPlayerProfile> {
    try {
      const resp = await fetch(`${PADEL_MATES_API}/user/me/`, { headers });
      if (!resp.ok) return { metadata: {} };

      const user = (await resp.json()) as PadelMatesUser;
      return {
        displayName: user.name,
        rating: user.level,
        ratingSystem: "padel_mates_level",
        preferredHand: user.hand === "left" ? "left" : user.hand === "right" ? "right" : undefined,
        preferredPosition: user.position === "left" ? "left" : user.position === "right" ? "right" : undefined,
        avatarUrl: user.profile_image_url,
        memberSince: user.member_since ? new Date(user.member_since) : undefined,
        metadata: { padelMatesUserId: user.id },
      };
    } catch {
      return { metadata: {} };
    }
  }

  private async fetchActivities(headers: Record<string, string>): Promise<PadelMatesActivity[]> {
    try {
      // Fetch last 6 months of activities
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 6);

      const params = new URLSearchParams({
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      });

      const resp = await fetch(`${PADEL_MATES_API}/home/activity/?${params}`, { headers });
      if (!resp.ok) return [];
      return (await resp.json()) as PadelMatesActivity[];
    } catch {
      return [];
    }
  }

  private async fetchMatchDetails(
    headers: Record<string, string>,
    activities: PadelMatesActivity[]
  ): Promise<ImportedMatch[]> {
    const matches: ImportedMatch[] = [];

    for (const activity of activities) {
      try {
        const resp = await fetch(
          `${PADEL_MATES_API}/home/activity/match/crud?activity_record_id=${activity.activity_record_id}`,
          { headers }
        );
        if (!resp.ok) continue;

        const detail = (await resp.json()) as PadelMatesMatchDetail;

        let result: "won" | "lost" | "draw" | undefined;
        if (detail.winner_team_index !== undefined) {
          result = detail.winner_team_index === 0 ? "won" : "lost";
        }

        const score = detail.teams
          .map((t) => t.sets.join("-"))
          .filter(Boolean)
          .join(" / ");

        const partnerTeam = detail.teams[0];
        const opponentTeam = detail.teams[1];

        matches.push({
          platformMatchId: String(activity.activity_record_id),
          playedAt: new Date(`${activity.date}T${activity.start_time}`),
          venueName: activity.club_name,
          courtName: activity.court_name,
          format: detail.match_type === "singles" ? "singles" : "doubles",
          result,
          score: score || undefined,
          partnerNames: partnerTeam?.players.map((p) => p.name) ?? [],
          opponentNames: opponentTeam?.players.map((p) => p.name) ?? [],
          metadata: { padelMatesActivityId: activity.activity_record_id },
        });
      } catch {
        // Skip individual match failures
      }
    }

    return matches;
  }

  private activityToBooking(activity: PadelMatesActivity): ImportedBooking {
    return {
      bookedAt: new Date(`${activity.date}T${activity.start_time}`),
      venueName: activity.club_name,
      courtName: activity.court_name,
      timeSlot: `${activity.start_time}-${activity.end_time}`,
      pricePaid: activity.price,
      currency: activity.currency ?? "THB",
      metadata: { padelMatesActivityId: activity.activity_record_id },
    };
  }
}
