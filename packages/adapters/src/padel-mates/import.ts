import type {
  PlayerImportAdapter,
  PlatformCredentials,
  ImportedPlayerProfile,
  ImportedMatchRecord,
  ImportedBookingRecord,
  ImportedContact,
} from "@courtiq/shared";

/**
 * Padel Mates player import adapter.
 *
 * Padel Mates API (auth required — HTTPBearer):
 *   FastAPI: https://fastapi-production-fargate.padelmates.io
 *   GET /user/profile/              — user profile
 *   GET /home/activity/?club_id=X   — activity/match history
 *   GET /home/activity/match/crud?activity_record_id=X — match details
 *   GET /user/friends/              — friend list
 *
 * Auth flow: user logs in via Padel Mates app → receives Bearer token.
 */

const PADELMATES_API = "https://fastapi-production-fargate.padelmates.io";

interface PadelMatesUser {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  skill_level: number | null;
  preferred_hand: string | null;
  preferred_position: string | null;
  created_at: string | null;
}

interface PadelMatesActivity {
  id: string;
  activity_record_id: string;
  title: string;
  club_name: string | null;
  location_name: string | null;
  starts_at: string;
  ends_at: string | null;
  fee: number | null;
  currency: string | null;
  match_type: string | null; // singles, doubles
  participants: Array<{
    user_id: string;
    name: string;
    avatar_url: string | null;
  }>;
  result: {
    winner_team: number | null;
    scores: Array<{ team1: number; team2: number }>;
  } | null;
}

interface PadelMatesFriend {
  user_id: string;
  name: string;
  avatar_url: string | null;
}

export class PadelMatesImportAdapter implements PlayerImportAdapter {
  readonly platform = "padel_mates" as const;

  private async authedFetch(url: string, credentials: PlatformCredentials): Promise<Response> {
    const token = credentials.accessToken;
    if (!token) throw new Error("Padel Mates access token required");

    return fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async fetchPlayerProfile(credentials: PlatformCredentials): Promise<ImportedPlayerProfile | null> {
    try {
      const resp = await this.authedFetch(`${PADELMATES_API}/user/profile/`, credentials);
      if (!resp.ok) return null;

      const user = (await resp.json()) as PadelMatesUser;
      return {
        platform: "padel_mates",
        platformUserId: user.id,
        displayName: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
        avatarUrl: user.avatar_url,
        rating: user.skill_level,
        ratingLabel: user.skill_level != null ? `Level ${user.skill_level}` : null,
        preferredHand: user.preferred_hand,
        preferredPosition: user.preferred_position,
        memberSince: user.created_at,
      };
    } catch {
      return null;
    }
  }

  async fetchMatchHistory(credentials: PlatformCredentials): Promise<ImportedMatchRecord[]> {
    try {
      const resp = await this.authedFetch(
        `${PADELMATES_API}/home/activity/?past=true&limit=200`,
        credentials
      );
      if (!resp.ok) return [];

      const data = await resp.json();
      const activities: PadelMatesActivity[] = Array.isArray(data)
        ? data
        : (data as { activities: PadelMatesActivity[] }).activities ?? [];

      const profile = await this.fetchPlayerProfile(credentials);
      const myUserId = profile?.platformUserId;

      return activities.map((a) => {
        let result: "win" | "loss" | "draw" | null = null;
        let playerScore: number | null = null;
        let opponentScore: number | null = null;

        if (a.result?.scores && a.result.scores.length > 0) {
          const team1Total = a.result.scores.reduce((s, set) => s + set.team1, 0);
          const team2Total = a.result.scores.reduce((s, set) => s + set.team2, 0);

          // Assume user is on team 1 unless we can determine otherwise
          playerScore = team1Total;
          opponentScore = team2Total;

          if (a.result.winner_team === 1) result = "win";
          else if (a.result.winner_team === 2) result = "loss";
          else if (team1Total === team2Total) result = "draw";
        }

        const opponents = a.participants
          .filter((p) => p.user_id !== myUserId)
          .map((p) => p.name);

        return {
          platform: "padel_mates" as const,
          platformMatchId: a.activity_record_id || a.id,
          opponentName: opponents.length > 0 ? opponents.join(", ") : null,
          opponentPlatformId: a.participants.find((p) => p.user_id !== myUserId)?.user_id ?? null,
          format: a.match_type === "singles" ? ("singles" as const) : ("doubles" as const),
          playerScore,
          opponentScore,
          result,
          playedAt: a.starts_at,
          venueName: a.location_name ?? a.club_name,
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
        `${PADELMATES_API}/home/activity/?past=true&limit=200`,
        credentials
      );
      if (!resp.ok) return [];

      const data = await resp.json();
      const activities: PadelMatesActivity[] = Array.isArray(data)
        ? data
        : (data as { activities: PadelMatesActivity[] }).activities ?? [];

      return activities.map((a) => ({
        platform: "padel_mates" as const,
        platformBookingId: a.activity_record_id || a.id,
        venueName: a.location_name ?? a.club_name ?? "Padel Mates Activity",
        courtName: null,
        startsAt: a.starts_at,
        endsAt: a.ends_at,
        priceCents: a.fee != null ? Math.round(a.fee * 100) : null,
        currency: a.currency,
      }));
    } catch {
      return [];
    }
  }

  async fetchContacts(credentials: PlatformCredentials): Promise<ImportedContact[]> {
    try {
      const resp = await this.authedFetch(`${PADELMATES_API}/user/friends/`, credentials);
      if (!resp.ok) return [];

      const data = await resp.json();
      const friends: PadelMatesFriend[] = Array.isArray(data)
        ? data
        : (data as { friends: PadelMatesFriend[] }).friends ?? [];

      return friends.map((f) => ({
        platform: "padel_mates" as const,
        platformUserId: f.user_id,
        displayName: f.name,
        avatarUrl: f.avatar_url,
      }));
    } catch {
      return [];
    }
  }
}
