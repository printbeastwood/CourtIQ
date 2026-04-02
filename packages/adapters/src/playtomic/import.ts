import type {
  PlayerImportAdapter,
  PlatformCredentials,
  ImportedPlayerProfile,
  ImportedMatchRecord,
  ImportedBookingRecord,
  ImportedContact,
} from "@courtiq/shared";

/**
 * Playtomic player import adapter.
 *
 * Playtomic user API endpoints (auth required — Bearer token):
 *   GET /v1/users/me                    — user profile
 *   GET /v1/users/me/matches            — match history
 *   GET /v1/users/me/reservations       — booking/reservation history
 *   GET /v1/users/me/friends            — friend list
 *   POST /v1/auth/login                 — email/password → access_token
 *
 * The user provides their Playtomic access token (obtained via OAuth or login).
 */

const PLAYTOMIC_API = "https://playtomic.io/api/v1";

interface PlaytomicUser {
  user_id: string;
  user_name: string;
  full_name: string;
  picture_url: string | null;
  level: number | null;
  level_label: string | null;
  preferred_hand: string | null;
  preferred_side: string | null;
  member_since: string | null;
}

interface PlaytomicMatch {
  match_id: string;
  date: string;
  sport_id: string;
  type: string; // singles, doubles
  tenant_name: string | null;
  resource_name: string | null;
  teams: Array<{
    players: Array<{
      user_id: string;
      user_name: string;
    }>;
    sets_won: number;
  }>;
  result: { winner_team: number | null } | null;
  score: string | null;
}

interface PlaytomicReservation {
  reservation_id: string;
  tenant_id: string;
  tenant_name: string;
  resource_name: string | null;
  start_date: string;
  end_date: string;
  price: number | null;
  currency: string | null;
  status: string;
}

interface PlaytomicFriend {
  user_id: string;
  user_name: string;
  full_name: string;
  picture_url: string | null;
}

export class PlaytomicImportAdapter implements PlayerImportAdapter {
  readonly platform = "playtomic" as const;

  private async authedFetch(url: string, credentials: PlatformCredentials): Promise<Response> {
    const token = credentials.accessToken;
    if (!token) throw new Error("Playtomic access token required");

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.status === 401) throw new Error("Playtomic token expired or invalid");
    return resp;
  }

  async fetchPlayerProfile(credentials: PlatformCredentials): Promise<ImportedPlayerProfile | null> {
    const resp = await this.authedFetch(`${PLAYTOMIC_API}/users/me`, credentials);
    if (!resp.ok) return null;

    const user = (await resp.json()) as PlaytomicUser;
    return {
      platform: "playtomic",
      platformUserId: user.user_id,
      displayName: user.full_name || user.user_name,
      avatarUrl: user.picture_url,
      rating: user.level,
      ratingLabel: user.level_label,
      preferredHand: user.preferred_hand,
      preferredPosition: user.preferred_side,
      memberSince: user.member_since,
    };
  }

  async fetchMatchHistory(credentials: PlatformCredentials): Promise<ImportedMatchRecord[]> {
    const resp = await this.authedFetch(`${PLAYTOMIC_API}/users/me/matches?size=200`, credentials);
    if (!resp.ok) return [];

    const data = await resp.json();
    const matches: PlaytomicMatch[] = Array.isArray(data) ? data : (data as { matches: PlaytomicMatch[] }).matches ?? [];

    const profile = await this.fetchPlayerProfile(credentials);
    const myUserId = profile?.platformUserId;

    return matches.map((m) => {
      let result: "win" | "loss" | "draw" | null = null;
      let playerScore: number | null = null;
      let opponentScore: number | null = null;
      let opponentName: string | null = null;
      let opponentPlatformId: string | null = null;

      if (m.teams && m.teams.length === 2 && myUserId) {
        const myTeamIdx = m.teams.findIndex((t) =>
          t.players.some((p) => p.user_id === myUserId)
        );
        const oppTeamIdx = myTeamIdx === 0 ? 1 : 0;

        if (myTeamIdx >= 0) {
          playerScore = m.teams[myTeamIdx].sets_won;
          opponentScore = m.teams[oppTeamIdx].sets_won;

          const oppPlayers = m.teams[oppTeamIdx].players;
          if (oppPlayers.length > 0) {
            opponentName = oppPlayers.map((p) => p.user_name).join(", ");
            opponentPlatformId = oppPlayers[0].user_id;
          }

          if (m.result?.winner_team != null) {
            result = m.result.winner_team === myTeamIdx ? "win" : "loss";
          } else if (playerScore != null && opponentScore != null) {
            if (playerScore > opponentScore) result = "win";
            else if (playerScore < opponentScore) result = "loss";
            else result = "draw";
          }
        }
      }

      const format = m.type === "singles" ? "singles" : "doubles";

      return {
        platform: "playtomic" as const,
        platformMatchId: m.match_id,
        opponentName,
        opponentPlatformId,
        format,
        playerScore,
        opponentScore,
        result,
        playedAt: m.date,
        venueName: m.tenant_name,
        courtName: m.resource_name,
        notes: m.score,
      };
    });
  }

  async fetchBookingHistory(credentials: PlatformCredentials): Promise<ImportedBookingRecord[]> {
    const resp = await this.authedFetch(
      `${PLAYTOMIC_API}/users/me/reservations?size=200`,
      credentials
    );
    if (!resp.ok) return [];

    const data = await resp.json();
    const reservations: PlaytomicReservation[] = Array.isArray(data)
      ? data
      : (data as { reservations: PlaytomicReservation[] }).reservations ?? [];

    return reservations.map((r) => ({
      platform: "playtomic" as const,
      platformBookingId: r.reservation_id,
      venueName: r.tenant_name,
      courtName: r.resource_name,
      startsAt: r.start_date,
      endsAt: r.end_date,
      priceCents: r.price != null ? Math.round(r.price * 100) : null,
      currency: r.currency,
    }));
  }

  async fetchContacts(credentials: PlatformCredentials): Promise<ImportedContact[]> {
    const resp = await this.authedFetch(`${PLAYTOMIC_API}/users/me/friends`, credentials);
    if (!resp.ok) return [];

    const data = await resp.json();
    const friends: PlaytomicFriend[] = Array.isArray(data)
      ? data
      : (data as { friends: PlaytomicFriend[] }).friends ?? [];

    return friends.map((f) => ({
      platform: "playtomic" as const,
      platformUserId: f.user_id,
      displayName: f.full_name || f.user_name,
      avatarUrl: f.picture_url,
    }));
  }
}
