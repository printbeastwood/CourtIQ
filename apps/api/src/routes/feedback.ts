import type { FastifyPluginAsync } from "fastify";
import { eq, sql, and, desc } from "drizzle-orm";
import type { Db } from "@courtiq/db";
import { matchFeedback } from "@courtiq/db/schema";
import type { Satisfaction, IssueCategory, OpponentSkillRating } from "@courtiq/shared";

const VALID_SATISFACTION: Satisfaction[] = ["great", "okay", "poor"];
const VALID_ISSUES: IssueCategory[] = ["court_quality", "opponent_level", "time", "location"];
const VALID_OPPONENT_SKILL: OpponentSkillRating[] = ["too_easy", "about_right", "too_hard"];

export function feedbackRoutes(db: Db): FastifyPluginAsync {
  return async (app) => {
    // Submit post-match feedback
    app.post<{
      Params: { matchId: string };
      Body: {
        satisfaction: Satisfaction;
        freeText?: string;
        issueCategories?: IssueCategory[];
        opponentSkillRating?: OpponentSkillRating;
        opponentId?: string;
        bookingId?: string;
      };
    }>("/matches/:matchId/feedback", async (request, reply) => {
      const { matchId } = request.params;
      const { satisfaction, freeText, issueCategories, opponentSkillRating, opponentId, bookingId } =
        request.body ?? {};

      if (!satisfaction || !VALID_SATISFACTION.includes(satisfaction)) {
        reply.code(400);
        return { error: "satisfaction must be one of: great, okay, poor" };
      }

      if (issueCategories?.some((c) => !VALID_ISSUES.includes(c))) {
        reply.code(400);
        return { error: "Invalid issue category" };
      }

      if (opponentSkillRating && !VALID_OPPONENT_SKILL.includes(opponentSkillRating)) {
        reply.code(400);
        return { error: "opponentSkillRating must be one of: too_easy, about_right, too_hard" };
      }

      // Check for duplicate feedback
      const existing = await db
        .select({ id: matchFeedback.id })
        .from(matchFeedback)
        .where(
          and(
            eq(matchFeedback.matchId, matchId),
            eq(matchFeedback.playerId, request.userId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        reply.code(409);
        return { error: "Feedback already submitted for this match" };
      }

      const [inserted] = await db
        .insert(matchFeedback)
        .values({
          matchId,
          bookingId: bookingId ?? null,
          playerId: request.userId,
          satisfaction,
          freeText: freeText ?? null,
          issueCategories: issueCategories ?? [],
          opponentSkillRating: opponentSkillRating ?? null,
          opponentId: opponentId ?? null,
        })
        .returning();

      return { feedback: inserted };
    });

    // Submit feedback without a match (booking-only or standalone)
    app.post<{
      Body: {
        satisfaction: Satisfaction;
        freeText?: string;
        issueCategories?: IssueCategory[];
        bookingId?: string;
      };
    }>("/feedback", async (request, reply) => {
      const { satisfaction, freeText, issueCategories, bookingId } = request.body ?? {};

      if (!satisfaction || !VALID_SATISFACTION.includes(satisfaction)) {
        reply.code(400);
        return { error: "satisfaction must be one of: great, okay, poor" };
      }

      const [inserted] = await db
        .insert(matchFeedback)
        .values({
          playerId: request.userId,
          satisfaction,
          freeText: freeText ?? null,
          issueCategories: issueCategories ?? [],
          bookingId: bookingId ?? null,
        })
        .returning();

      return { feedback: inserted };
    });

    // Get feedback stats for a player
    app.get<{ Params: { playerId: string } }>(
      "/players/:playerId/feedback-stats",
      async (request) => {
        const { playerId } = request.params;

        const rows = await db
          .select({
            satisfaction: matchFeedback.satisfaction,
            count: sql<number>`count(*)::int`,
          })
          .from(matchFeedback)
          .where(eq(matchFeedback.playerId, playerId))
          .groupBy(matchFeedback.satisfaction);

        let total = 0;
        let great = 0;
        let okay = 0;
        let poor = 0;

        for (const row of rows) {
          total += row.count;
          if (row.satisfaction === "great") great = row.count;
          else if (row.satisfaction === "okay") okay = row.count;
          else if (row.satisfaction === "poor") poor = row.count;
        }

        return {
          total,
          great,
          okay,
          poor,
          satisfactionRate: total > 0 ? Math.round((great / total) * 100) : 0,
        };
      },
    );

    // Get recent feedback for a player
    app.get<{
      Params: { playerId: string };
      Querystring: { limit?: string };
    }>("/players/:playerId/feedback", async (request) => {
      const { playerId } = request.params;
      const limit = parseInt(request.query.limit ?? "20", 10);

      const rows = await db
        .select()
        .from(matchFeedback)
        .where(eq(matchFeedback.playerId, playerId))
        .orderBy(desc(matchFeedback.createdAt))
        .limit(limit);

      return { feedback: rows };
    });
  };
}
