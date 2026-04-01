import type { FastifyPluginAsync } from "fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, or, sql, desc, gte } from "drizzle-orm";
import {
  matches,
  matchPlayers,
  users,
  courts,
  venues,
  playerProfiles,
} from "@courtiq/db/schema";
import type { NotificationService } from "../services/notifications.js";

type Db = NodePgDatabase;

export function matchRoutes(
  db: Db,
  notificationService: NotificationService | null,
): FastifyPluginAsync {
  return async (app) => {
    // Create a scheduled match
    app.post<{
      Body: {
        format: string;
        scheduledAt: string;
        courtId?: string;
        bookingId?: string;
        notes?: string;
        invitees?: string[];
      };
    }>("/matches", async (request, reply) => {
      const { format, scheduledAt, courtId, bookingId, notes, invitees } =
        request.body ?? {};

      if (!format || !scheduledAt) {
        reply.code(400);
        return { error: "format and scheduledAt are required" };
      }

      if (!["singles", "doubles"].includes(format)) {
        reply.code(400);
        return { error: "format must be singles or doubles" };
      }

      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        reply.code(400);
        return { error: "scheduledAt must be in the future" };
      }

      // Create the match with status "upcoming"
      // Use the creator as player1, and set player2 to the first invitee or self (placeholder)
      const firstInvitee = invitees?.[0] ?? request.userId;

      const [match] = await db
        .insert(matches)
        .values({
          format,
          status: "upcoming",
          courtId: courtId ?? null,
          bookingId: bookingId ?? null,
          scheduledAt: scheduledDate,
          playedAt: scheduledDate, // Will be updated when match completes
          player1Id: request.userId,
          player2Id: firstInvitee,
          reportedById: request.userId,
          createdByUserId: request.userId,
          notes: notes ?? null,
        })
        .returning();

      // Add creator as host in match_players
      await db.insert(matchPlayers).values({
        matchId: match.id,
        userId: request.userId,
        role: "host",
        rsvpStatus: "accepted",
      });

      // Invite other players
      if (invitees && invitees.length > 0) {
        const playerValues = invitees
          .filter((id) => id !== request.userId)
          .map((userId) => ({
            matchId: match.id,
            userId,
            role: "guest" as const,
            rsvpStatus: "pending" as const,
          }));

        if (playerValues.length > 0) {
          await db.insert(matchPlayers).values(playerValues);

          // Send invite notifications
          if (notificationService) {
            for (const p of playerValues) {
              await notificationService.scheduleNotification({
                userId: p.userId,
                type: "match_invite",
                title: "Match Invitation",
                body: "You've been invited to a match!",
                data: {
                  matchId: match.id,
                  screen: "match-detail",
                },
              });
            }
          }
        }
      }

      // Schedule match reminder 1hr before
      if (notificationService) {
        const reminderTime = new Date(
          scheduledDate.getTime() - 60 * 60 * 1000,
        );
        if (reminderTime > new Date()) {
          await notificationService.scheduleNotification({
            userId: request.userId,
            type: "booking_reminder",
            title: "Match Starting Soon",
            body: "Your match starts in 1 hour!",
            data: { matchId: match.id, screen: "match-detail" },
            sendAt: reminderTime,
          });
        }
      }

      reply.code(201);
      return { match };
    });

    // Invite players to an existing match
    app.post<{
      Params: { matchId: string };
      Body: { userIds: string[] };
    }>("/matches/:matchId/invite", async (request, reply) => {
      const { matchId } = request.params;
      const { userIds } = request.body ?? {};

      if (!userIds || userIds.length === 0) {
        reply.code(400);
        return { error: "userIds is required" };
      }

      // Verify match exists and user is the host
      const [match] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);

      if (!match) {
        reply.code(404);
        return { error: "Match not found" };
      }

      if (match.createdByUserId !== request.userId && match.player1Id !== request.userId) {
        reply.code(403);
        return { error: "Only the match host can invite players" };
      }

      if (match.status !== "upcoming") {
        reply.code(400);
        return { error: "Can only invite to upcoming matches" };
      }

      // Get existing players to avoid duplicates
      const existing = await db
        .select({ userId: matchPlayers.userId })
        .from(matchPlayers)
        .where(eq(matchPlayers.matchId, matchId));
      const existingIds = new Set(existing.map((e) => e.userId));

      const newPlayers = userIds
        .filter((id) => !existingIds.has(id))
        .map((userId) => ({
          matchId,
          userId,
          role: "guest" as const,
          rsvpStatus: "pending" as const,
        }));

      if (newPlayers.length === 0) {
        return { invited: 0 };
      }

      await db.insert(matchPlayers).values(newPlayers);

      // Update player2Id if it was a placeholder
      if (match.player2Id === match.player1Id && newPlayers.length > 0) {
        await db
          .update(matches)
          .set({ player2Id: newPlayers[0].userId })
          .where(eq(matches.id, matchId));
      }

      // Send invite notifications
      if (notificationService) {
        for (const p of newPlayers) {
          await notificationService.scheduleNotification({
            userId: p.userId,
            type: "match_invite",
            title: "Match Invitation",
            body: "You've been invited to a match!",
            data: { matchId, screen: "match-detail" },
          });
        }
      }

      return { invited: newPlayers.length };
    });

    // Respond to match invite (accept/decline)
    app.patch<{
      Params: { matchId: string };
      Body: { rsvpStatus: string };
    }>("/matches/:matchId/rsvp", async (request, reply) => {
      const { matchId } = request.params;
      const { rsvpStatus } = request.body ?? {};

      if (!rsvpStatus || !["accepted", "declined"].includes(rsvpStatus)) {
        reply.code(400);
        return { error: "rsvpStatus must be accepted or declined" };
      }

      const [player] = await db
        .select()
        .from(matchPlayers)
        .where(
          and(
            eq(matchPlayers.matchId, matchId),
            eq(matchPlayers.userId, request.userId),
          ),
        )
        .limit(1);

      if (!player) {
        reply.code(404);
        return { error: "You are not invited to this match" };
      }

      await db
        .update(matchPlayers)
        .set({ rsvpStatus, updatedAt: new Date() })
        .where(eq(matchPlayers.id, player.id));

      return { rsvpStatus };
    });

    // Update match (status, scores, etc.)
    app.patch<{
      Params: { matchId: string };
      Body: {
        status?: string;
        scheduledAt?: string;
        notes?: string;
        player1Score?: number;
        player2Score?: number;
      };
    }>("/matches/:matchId", async (request, reply) => {
      const { matchId } = request.params;
      const { status, scheduledAt, notes, player1Score, player2Score } =
        request.body ?? {};

      const [match] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);

      if (!match) {
        reply.code(404);
        return { error: "Match not found" };
      }

      // Only host or participants can update
      const [playerRecord] = await db
        .select()
        .from(matchPlayers)
        .where(
          and(
            eq(matchPlayers.matchId, matchId),
            eq(matchPlayers.userId, request.userId),
          ),
        )
        .limit(1);

      if (!playerRecord && match.createdByUserId !== request.userId) {
        reply.code(403);
        return { error: "Only match participants can update" };
      }

      const updates: Record<string, unknown> = {};
      if (status) updates.status = status;
      if (scheduledAt) {
        updates.scheduledAt = new Date(scheduledAt);
        updates.playedAt = new Date(scheduledAt);
      }
      if (notes !== undefined) updates.notes = notes;
      if (player1Score !== undefined) updates.player1Score = player1Score;
      if (player2Score !== undefined) updates.player2Score = player2Score;

      // Determine winner when completing with scores
      if (
        status === "completed" &&
        player1Score != null &&
        player2Score != null
      ) {
        if (player1Score > player2Score) updates.winnerId = match.player1Id;
        else if (player2Score > player1Score) updates.winnerId = match.player2Id;
      }

      if (Object.keys(updates).length === 0) {
        return { match };
      }

      const [updated] = await db
        .update(matches)
        .set(updates)
        .where(eq(matches.id, matchId))
        .returning();

      // Schedule feedback notification when match is completed
      if (status === "completed" && notificationService) {
        const players = await db
          .select({ userId: matchPlayers.userId })
          .from(matchPlayers)
          .where(eq(matchPlayers.matchId, matchId));

        for (const p of players) {
          await notificationService.schedulePostMatchFeedback(
            p.userId,
            matchId,
            30,
          );
        }
      }

      return { match: updated };
    });

    // Get my upcoming matches
    app.get<{
      Querystring: { limit?: string };
    }>("/matches/upcoming", async (request) => {
      const limit = parseInt(request.query.limit ?? "20", 10);

      const results = await db
        .select({
          match: matches,
          court: {
            id: courts.id,
            name: courts.name,
            surface: courts.surface,
            indoor: courts.indoor,
          },
          venue: {
            id: venues.id,
            name: venues.name,
            address: venues.address,
          },
        })
        .from(matches)
        .leftJoin(courts, eq(matches.courtId, courts.id))
        .leftJoin(venues, eq(courts.venueId, venues.id))
        .where(
          and(
            or(
              eq(matches.player1Id, request.userId),
              eq(matches.player2Id, request.userId),
            ),
            or(eq(matches.status, "upcoming"), eq(matches.status, "active")),
          ),
        )
        .orderBy(sql`${matches.scheduledAt} ASC NULLS LAST`)
        .limit(limit);

      // Fetch players for each match
      const matchIds = results.map((r) => r.match.id);
      const allPlayers =
        matchIds.length > 0
          ? await db
              .select({
                matchId: matchPlayers.matchId,
                userId: matchPlayers.userId,
                role: matchPlayers.role,
                rsvpStatus: matchPlayers.rsvpStatus,
                displayName: playerProfiles.displayName,
                avatarUrl: playerProfiles.avatarUrl,
              })
              .from(matchPlayers)
              .leftJoin(
                playerProfiles,
                eq(matchPlayers.userId, playerProfiles.userId),
              )
              .where(sql`${matchPlayers.matchId} = ANY(${matchIds})`)
          : [];

      const playersByMatch = new Map<string, typeof allPlayers>();
      for (const p of allPlayers) {
        const list = playersByMatch.get(p.matchId) ?? [];
        list.push(p);
        playersByMatch.set(p.matchId, list);
      }

      return {
        matches: results.map((r) => ({
          id: r.match.id,
          format: r.match.format,
          status: r.match.status,
          scheduledAt:
            r.match.scheduledAt?.toISOString() ??
            r.match.playedAt.toISOString(),
          notes: r.match.notes,
          createdByUserId: r.match.createdByUserId,
          court: r.court?.id ? r.court : null,
          venue: r.venue?.id ? r.venue : null,
          players: playersByMatch.get(r.match.id) ?? [],
          createdAt: r.match.createdAt.toISOString(),
        })),
      };
    });

    // Get match history (completed + cancelled)
    app.get<{
      Querystring: { limit?: string; page?: string };
    }>("/matches/history", async (request) => {
      const limit = parseInt(request.query.limit ?? "20", 10);
      const page = parseInt(request.query.page ?? "1", 10);
      const offset = (page - 1) * limit;

      const results = await db
        .select({
          match: matches,
          court: {
            id: courts.id,
            name: courts.name,
            surface: courts.surface,
            indoor: courts.indoor,
          },
          venue: {
            id: venues.id,
            name: venues.name,
            address: venues.address,
          },
        })
        .from(matches)
        .leftJoin(courts, eq(matches.courtId, courts.id))
        .leftJoin(venues, eq(courts.venueId, venues.id))
        .where(
          and(
            or(
              eq(matches.player1Id, request.userId),
              eq(matches.player2Id, request.userId),
            ),
            or(
              eq(matches.status, "completed"),
              eq(matches.status, "cancelled"),
            ),
          ),
        )
        .orderBy(desc(matches.playedAt))
        .limit(limit)
        .offset(offset);

      // Fetch players for each match
      const matchIds = results.map((r) => r.match.id);
      const allPlayers =
        matchIds.length > 0
          ? await db
              .select({
                matchId: matchPlayers.matchId,
                userId: matchPlayers.userId,
                role: matchPlayers.role,
                rsvpStatus: matchPlayers.rsvpStatus,
                displayName: playerProfiles.displayName,
                avatarUrl: playerProfiles.avatarUrl,
              })
              .from(matchPlayers)
              .leftJoin(
                playerProfiles,
                eq(matchPlayers.userId, playerProfiles.userId),
              )
              .where(sql`${matchPlayers.matchId} = ANY(${matchIds})`)
          : [];

      const playersByMatch = new Map<string, typeof allPlayers>();
      for (const p of allPlayers) {
        const list = playersByMatch.get(p.matchId) ?? [];
        list.push(p);
        playersByMatch.set(p.matchId, list);
      }

      // Also get display names from users table for player1/player2
      const userIds = new Set<string>();
      for (const r of results) {
        userIds.add(r.match.player1Id);
        userIds.add(r.match.player2Id);
      }
      const userIdArray = [...userIds];
      const userNames =
        userIdArray.length > 0
          ? await db
              .select({ id: users.id, displayName: users.displayName })
              .from(users)
              .where(sql`${users.id} = ANY(${userIdArray})`)
          : [];
      const nameMap = new Map(userNames.map((u) => [u.id, u.displayName]));

      return {
        matches: results.map((r) => ({
          id: r.match.id,
          format: r.match.format,
          status: r.match.status,
          scheduledAt: r.match.scheduledAt?.toISOString(),
          playedAt: r.match.playedAt.toISOString(),
          player1Id: r.match.player1Id,
          player2Id: r.match.player2Id,
          player1Name: nameMap.get(r.match.player1Id) ?? null,
          player2Name: nameMap.get(r.match.player2Id) ?? null,
          player1Score: r.match.player1Score,
          player2Score: r.match.player2Score,
          winnerId: r.match.winnerId,
          notes: r.match.notes,
          court: r.court?.id ? r.court : null,
          venue: r.venue?.id ? r.venue : null,
          players: playersByMatch.get(r.match.id) ?? [],
          createdAt: r.match.createdAt.toISOString(),
        })),
        page,
        limit,
      };
    });

    // Get single match detail
    app.get<{
      Params: { matchId: string };
    }>("/matches/:matchId", async (request, reply) => {
      const { matchId } = request.params;

      const [result] = await db
        .select({
          match: matches,
          court: {
            id: courts.id,
            name: courts.name,
            surface: courts.surface,
            indoor: courts.indoor,
          },
          venue: {
            id: venues.id,
            name: venues.name,
            address: venues.address,
          },
        })
        .from(matches)
        .leftJoin(courts, eq(matches.courtId, courts.id))
        .leftJoin(venues, eq(courts.venueId, venues.id))
        .where(eq(matches.id, matchId))
        .limit(1);

      if (!result) {
        reply.code(404);
        return { error: "Match not found" };
      }

      const players = await db
        .select({
          userId: matchPlayers.userId,
          role: matchPlayers.role,
          rsvpStatus: matchPlayers.rsvpStatus,
          displayName: playerProfiles.displayName,
          avatarUrl: playerProfiles.avatarUrl,
        })
        .from(matchPlayers)
        .leftJoin(
          playerProfiles,
          eq(matchPlayers.userId, playerProfiles.userId),
        )
        .where(eq(matchPlayers.matchId, matchId));

      return {
        match: {
          id: result.match.id,
          format: result.match.format,
          status: result.match.status,
          scheduledAt:
            result.match.scheduledAt?.toISOString() ??
            result.match.playedAt.toISOString(),
          playedAt: result.match.playedAt.toISOString(),
          player1Id: result.match.player1Id,
          player2Id: result.match.player2Id,
          player1Score: result.match.player1Score,
          player2Score: result.match.player2Score,
          winnerId: result.match.winnerId,
          notes: result.match.notes,
          createdByUserId: result.match.createdByUserId,
          confirmed: result.match.confirmed,
          court: result.court?.id ? result.court : null,
          venue: result.venue?.id ? result.venue : null,
          players,
          createdAt: result.match.createdAt.toISOString(),
        },
      };
    });
  };
}
