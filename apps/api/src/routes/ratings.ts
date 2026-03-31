import type { FastifyPluginAsync } from "fastify";
import type { RatingService } from "@courtiq/rating-engine";
import type { MatchFormat } from "@courtiq/shared";

export function ratingRoutes(ratingService: RatingService): FastifyPluginAsync {
  return async (app) => {
    // Get player rating
    app.get<{ Params: { playerId: string }; Querystring: { format?: string } }>(
      "/players/:playerId/rating",
      async (request) => {
        const { playerId } = request.params;
        const format = (request.query.format ?? "doubles") as MatchFormat;
        const result = await ratingService.getPlayerRating(playerId, format);
        return {
          playerId,
          format,
          rating: result.rating.rating,
          rd: result.rating.rd,
          gamesPlayed: result.rating.gamesPlayed,
          confidence: result.confidence,
          lastMatchAt: result.rating.lastMatchAt,
        };
      },
    );

    // Get all ratings for a player (singles + doubles)
    app.get<{ Params: { playerId: string } }>(
      "/players/:playerId/ratings",
      async (request) => {
        const { playerId } = request.params;
        const ratings = await ratingService.getAllRatings(playerId);
        return { playerId, ratings };
      },
    );

    // Get rating history for chart display
    app.get<{
      Params: { playerId: string };
      Querystring: { format?: string; limit?: string };
    }>("/players/:playerId/rating-history", async (request) => {
      const { playerId } = request.params;
      const format = (request.query.format ?? "doubles") as MatchFormat;
      const limit = parseInt(request.query.limit ?? "50", 10);
      const history = await ratingService.getRatingHistory(playerId, format, limit);
      return { playerId, format, history };
    });

    // Get match history for a player
    app.get<{
      Params: { playerId: string };
      Querystring: { limit?: string };
    }>("/players/:playerId/matches", async (request) => {
      const { playerId } = request.params;
      const limit = parseInt(request.query.limit ?? "20", 10);
      const matches = await ratingService.getMatchHistory(playerId, limit);
      return { playerId, matches };
    });

    // Submit a match result
    app.post<{
      Body: {
        opponentId: string;
        format: MatchFormat;
        player1Score: number;
        player2Score: number;
        playedAt: string;
        courtId?: string;
      };
    }>("/matches/result", async (request, reply) => {
      const { opponentId, format, player1Score, player2Score, playedAt, courtId } =
        request.body ?? {};

      if (!opponentId || !format || player1Score == null || player2Score == null || !playedAt) {
        reply.code(400);
        return { error: "opponentId, format, player1Score, player2Score, and playedAt are required" };
      }

      if (opponentId === request.userId) {
        reply.code(400);
        return { error: "Cannot record a match against yourself" };
      }

      const result = await ratingService.recordMatchResult({
        player1Id: request.userId,
        player2Id: opponentId,
        player1Score,
        player2Score,
        format,
        playedAt: new Date(playedAt),
        reportedById: request.userId,
        courtId,
      });

      return {
        match: result.match,
        ratingChanges: {
          you: result.player1,
          opponent: result.player2,
        },
      };
    });
  };
}
