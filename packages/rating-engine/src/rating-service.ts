import { eq, and, desc, or, sql } from "drizzle-orm";
import type { Db } from "@courtiq/db";
import { playerRatings, ratingHistory, matches, users } from "@courtiq/db";
import type { MatchFormat } from "@courtiq/shared";
import {
  calculateRating,
  rdToConfidence,
  INITIAL_RATING,
  INITIAL_RD,
  INITIAL_VOLATILITY,
} from "./glicko2.js";

export class RatingService {
  constructor(private db: Db) {}

  /** Get or create a player's rating for a given format */
  async getOrCreateRating(playerId: string, format: MatchFormat) {
    const [existing] = await this.db
      .select()
      .from(playerRatings)
      .where(
        and(
          eq(playerRatings.playerId, playerId),
          eq(playerRatings.format, format),
        ),
      );

    if (existing) return existing;

    const [created] = await this.db
      .insert(playerRatings)
      .values({
        playerId,
        format,
        rating: INITIAL_RATING,
        rd: INITIAL_RD,
        volatility: INITIAL_VOLATILITY,
        gamesPlayed: 0,
      })
      .returning();

    return created;
  }

  /** Get a player's rating with confidence score */
  async getPlayerRating(playerId: string, format: MatchFormat = "doubles") {
    const rating = await this.getOrCreateRating(playerId, format);
    return {
      rating,
      confidence: rdToConfidence(rating.rd),
    };
  }

  /** Get all format ratings for a player */
  async getAllRatings(playerId: string) {
    const ratings = await this.db
      .select()
      .from(playerRatings)
      .where(eq(playerRatings.playerId, playerId));

    return ratings.map((r) => ({
      rating: r,
      confidence: rdToConfidence(r.rd),
    }));
  }

  /** Record a match result and update both players' ratings */
  async recordMatchResult(input: {
    player1Id: string;
    player2Id: string;
    player1Score: number;
    player2Score: number;
    format: MatchFormat;
    playedAt: Date;
    reportedById: string;
    courtId?: string;
  }) {
    const winnerId =
      input.player1Score > input.player2Score
        ? input.player1Id
        : input.player1Score < input.player2Score
          ? input.player2Id
          : undefined;

    // Insert match record
    const [match] = await this.db
      .insert(matches)
      .values({
        player1Id: input.player1Id,
        player2Id: input.player2Id,
        player1Score: input.player1Score,
        player2Score: input.player2Score,
        format: input.format,
        winnerId: winnerId ?? null,
        playedAt: input.playedAt,
        reportedById: input.reportedById,
        courtId: input.courtId ?? null,
        confirmed: true,
      })
      .returning();

    // Get current ratings
    const p1Rating = await this.getOrCreateRating(
      input.player1Id,
      input.format,
    );
    const p2Rating = await this.getOrCreateRating(
      input.player2Id,
      input.format,
    );

    // Determine scores: 1 = win, 0 = loss, 0.5 = draw
    const p1Score =
      input.player1Score > input.player2Score
        ? 1
        : input.player1Score < input.player2Score
          ? 0
          : 0.5;
    const p2Score = 1 - p1Score;

    // Calculate new ratings using Glicko-2
    const newP1 = calculateRating(
      { rating: p1Rating.rating, rd: p1Rating.rd, volatility: p1Rating.volatility },
      [
        {
          opponent: { rating: p2Rating.rating, rd: p2Rating.rd, volatility: p2Rating.volatility },
          score: p1Score,
        },
      ],
    );

    const newP2 = calculateRating(
      { rating: p2Rating.rating, rd: p2Rating.rd, volatility: p2Rating.volatility },
      [
        {
          opponent: { rating: p1Rating.rating, rd: p1Rating.rd, volatility: p1Rating.volatility },
          score: p2Score,
        },
      ],
    );

    // Update ratings + insert history in parallel
    await Promise.all([
      this.db
        .update(playerRatings)
        .set({
          rating: newP1.rating,
          rd: newP1.rd,
          volatility: newP1.volatility,
          gamesPlayed: p1Rating.gamesPlayed + 1,
          lastMatchAt: input.playedAt,
          updatedAt: new Date(),
        })
        .where(eq(playerRatings.id, p1Rating.id)),

      this.db
        .update(playerRatings)
        .set({
          rating: newP2.rating,
          rd: newP2.rd,
          volatility: newP2.volatility,
          gamesPlayed: p2Rating.gamesPlayed + 1,
          lastMatchAt: input.playedAt,
          updatedAt: new Date(),
        })
        .where(eq(playerRatings.id, p2Rating.id)),

      this.db.insert(ratingHistory).values({
        playerId: input.player1Id,
        matchId: match.id,
        format: input.format,
        ratingBefore: p1Rating.rating,
        ratingAfter: newP1.rating,
        rdBefore: p1Rating.rd,
        rdAfter: newP1.rd,
        opponentId: input.player2Id,
        opponentRating: p2Rating.rating,
        result: p1Score,
      }),

      this.db.insert(ratingHistory).values({
        playerId: input.player2Id,
        matchId: match.id,
        format: input.format,
        ratingBefore: p2Rating.rating,
        ratingAfter: newP2.rating,
        rdBefore: p2Rating.rd,
        rdAfter: newP2.rd,
        opponentId: input.player1Id,
        opponentRating: p1Rating.rating,
        result: p2Score,
      }),
    ]);

    return {
      match,
      player1: {
        before: { rating: p1Rating.rating, rd: p1Rating.rd },
        after: { rating: newP1.rating, rd: newP1.rd },
        change: Math.round((newP1.rating - p1Rating.rating) * 100) / 100,
      },
      player2: {
        before: { rating: p2Rating.rating, rd: p2Rating.rd },
        after: { rating: newP2.rating, rd: newP2.rd },
        change: Math.round((newP2.rating - p2Rating.rating) * 100) / 100,
      },
    };
  }

  /** Get rating history for a player */
  async getRatingHistory(
    playerId: string,
    format: MatchFormat = "doubles",
    limit = 50,
  ) {
    return this.db
      .select()
      .from(ratingHistory)
      .where(
        and(
          eq(ratingHistory.playerId, playerId),
          eq(ratingHistory.format, format),
        ),
      )
      .orderBy(desc(ratingHistory.createdAt))
      .limit(limit);
  }

  /** Get match history for a player with opponent info */
  async getMatchHistory(playerId: string, limit = 20) {
    const results = await this.db
      .select({
        match: matches,
        player1Name: sql<string>`p1.display_name`,
        player2Name: sql<string>`p2.display_name`,
      })
      .from(matches)
      .innerJoin(
        sql`users as p1`,
        sql`p1.id = ${matches.player1Id}`,
      )
      .innerJoin(
        sql`users as p2`,
        sql`p2.id = ${matches.player2Id}`,
      )
      .where(
        or(
          eq(matches.player1Id, playerId),
          eq(matches.player2Id, playerId),
        ),
      )
      .orderBy(desc(matches.playedAt))
      .limit(limit);

    // Get rating changes for each match
    const matchIds = results.map((r) => r.match.id);
    const changes =
      matchIds.length > 0
        ? await this.db
            .select()
            .from(ratingHistory)
            .where(
              and(
                eq(ratingHistory.playerId, playerId),
                sql`${ratingHistory.matchId} = ANY(${matchIds})`,
              ),
            )
        : [];

    const changeByMatch = new Map(changes.map((c) => [c.matchId, c]));

    return results.map((r) => {
      const change = changeByMatch.get(r.match.id);
      return {
        match: r.match,
        player1: { id: r.match.player1Id, displayName: r.player1Name },
        player2: { id: r.match.player2Id, displayName: r.player2Name },
        ratingChange: change
          ? Math.round((change.ratingAfter - change.ratingBefore) * 100) / 100
          : undefined,
      };
    });
  }
}
