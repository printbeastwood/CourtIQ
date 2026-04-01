import type { FastifyPluginAsync } from "fastify";
import type { Db } from "@courtiq/db";
import {
  users,
  playerProfiles,
  connections,
  playerRatings,
} from "@courtiq/db";
import { eq, and, or, sql, ilike, gte, lte, ne, inArray } from "drizzle-orm";
import {
  playerProfileInputSchema,
  playerDiscoverySchema,
} from "@courtiq/shared";

export function playerRoutes(db: Db): FastifyPluginAsync {
  return async (app) => {
    // Upsert own player profile
    app.put<{
      Body: {
        displayName: string;
        avatarUrl?: string;
        bio?: string;
        preferredLocations?: string[];
        playFrequency?: string;
      };
    }>("/players/me/profile", async (request, reply) => {
      const parsed = playerProfileInputSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: parsed.error.flatten() };
      }

      const { displayName, avatarUrl, bio, preferredLocations, playFrequency } =
        parsed.data;

      const [existing] = await db
        .select({ id: playerProfiles.id })
        .from(playerProfiles)
        .where(eq(playerProfiles.userId, request.userId))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(playerProfiles)
          .set({
            displayName,
            avatarUrl,
            bio,
            preferredLocations,
            playFrequency,
            updatedAt: new Date(),
          })
          .where(eq(playerProfiles.userId, request.userId))
          .returning();
        return { profile: updated };
      }

      const [created] = await db
        .insert(playerProfiles)
        .values({
          userId: request.userId,
          displayName,
          avatarUrl,
          bio,
          preferredLocations,
          playFrequency,
        })
        .returning();
      reply.code(201);
      return { profile: created };
    });

    // Get own profile
    app.get("/players/me/profile", async (request) => {
      const [profile] = await db
        .select()
        .from(playerProfiles)
        .where(eq(playerProfiles.userId, request.userId))
        .limit(1);

      return { profile: profile ?? null };
    });

    // Get another player's public profile
    app.get<{ Params: { playerId: string } }>(
      "/players/:playerId/profile",
      async (request, reply) => {
        const { playerId } = request.params;

        const [profile] = await db
          .select({
            userId: playerProfiles.userId,
            displayName: playerProfiles.displayName,
            avatarUrl: playerProfiles.avatarUrl,
            bio: playerProfiles.bio,
            playFrequency: playerProfiles.playFrequency,
            preferredLocations: playerProfiles.preferredLocations,
          })
          .from(playerProfiles)
          .where(eq(playerProfiles.userId, playerId))
          .limit(1);

        if (!profile) {
          // Fall back to user table if no profile yet
          const [user] = await db
            .select({
              userId: users.id,
              displayName: users.displayName,
            })
            .from(users)
            .where(eq(users.id, playerId))
            .limit(1);

          if (!user) {
            reply.code(404);
            return { error: "Player not found" };
          }

          return {
            profile: {
              userId: user.userId,
              displayName: user.displayName ?? "Player",
              avatarUrl: null,
              bio: null,
              playFrequency: null,
              preferredLocations: [],
            },
          };
        }

        // Get rating
        const [rating] = await db
          .select({
            rating: playerRatings.rating,
            gamesPlayed: playerRatings.gamesPlayed,
            rd: playerRatings.rd,
          })
          .from(playerRatings)
          .where(
            and(
              eq(playerRatings.playerId, playerId),
              eq(playerRatings.format, "doubles"),
            ),
          )
          .limit(1);

        // Get connection status with current user
        const [conn] = await db
          .select({ status: connections.status, userId: connections.userId })
          .from(connections)
          .where(
            or(
              and(
                eq(connections.userId, request.userId),
                eq(connections.friendId, playerId),
              ),
              and(
                eq(connections.userId, playerId),
                eq(connections.friendId, request.userId),
              ),
            ),
          )
          .limit(1);

        return {
          profile: {
            ...profile,
            rating: rating?.rating ?? null,
            gamesPlayed: rating?.gamesPlayed ?? 0,
            confidence: rating ? Math.max(0, 1 - rating.rd / 350) : null,
            connectionStatus: conn?.status ?? null,
          },
        };
      },
    );

    // Discover players near your rating
    app.get<{
      Querystring: {
        minRating?: string;
        maxRating?: string;
        playFrequency?: string;
        search?: string;
        page?: string;
        limit?: string;
      };
    }>("/players/discover", async (request) => {
      const parsed = playerDiscoverySchema.safeParse(request.query);
      const query = parsed.success ? parsed.data : { page: 1, limit: 20 };
      const offset = (query.page - 1) * query.limit;

      const conditions = [ne(playerProfiles.userId, request.userId)];

      if (query.search) {
        conditions.push(ilike(playerProfiles.displayName, `%${query.search}%`));
      }

      if (query.playFrequency) {
        conditions.push(eq(playerProfiles.playFrequency, query.playFrequency));
      }

      // Base query: all profiles except self
      const profileRows = await db
        .select({
          userId: playerProfiles.userId,
          displayName: playerProfiles.displayName,
          avatarUrl: playerProfiles.avatarUrl,
          bio: playerProfiles.bio,
          playFrequency: playerProfiles.playFrequency,
          rating: playerRatings.rating,
          gamesPlayed: playerRatings.gamesPlayed,
          rd: playerRatings.rd,
        })
        .from(playerProfiles)
        .leftJoin(
          playerRatings,
          and(
            eq(playerRatings.playerId, playerProfiles.userId),
            eq(playerRatings.format, "doubles"),
          ),
        )
        .where(and(...conditions))
        .orderBy(playerProfiles.displayName)
        .limit(query.limit)
        .offset(offset);

      // Filter by rating range in-memory (simpler than complex SQL with nullable join)
      let filtered = profileRows;
      if (query.minRating != null) {
        filtered = filtered.filter(
          (r) => r.rating != null && r.rating >= query.minRating!,
        );
      }
      if (query.maxRating != null) {
        filtered = filtered.filter(
          (r) => r.rating != null && r.rating <= query.maxRating!,
        );
      }

      // Batch-fetch connection statuses
      const playerIds = filtered.map((r) => r.userId);
      let connectionMap = new Map<string, string>();
      if (playerIds.length > 0) {
        const conns = await db
          .select({
            userId: connections.userId,
            friendId: connections.friendId,
            status: connections.status,
          })
          .from(connections)
          .where(
            or(
              and(
                eq(connections.userId, request.userId),
                inArray(connections.friendId, playerIds),
              ),
              and(
                inArray(connections.userId, playerIds),
                eq(connections.friendId, request.userId),
              ),
            ),
          );

        for (const c of conns) {
          const otherId =
            c.userId === request.userId ? c.friendId : c.userId;
          connectionMap.set(otherId, c.status);
        }
      }

      const players = filtered.map((r) => ({
        userId: r.userId,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        bio: r.bio,
        playFrequency: r.playFrequency,
        rating: r.rating ? Math.round(r.rating) : null,
        gamesPlayed: r.gamesPlayed ?? 0,
        confidence: r.rd ? Math.max(0, 1 - r.rd / 350) : null,
        connectionStatus: connectionMap.get(r.userId) ?? null,
      }));

      return { players, page: query.page, limit: query.limit };
    });

    // Send friend request
    app.post<{ Params: { playerId: string } }>(
      "/players/:playerId/connect",
      async (request, reply) => {
        const { playerId } = request.params;

        if (playerId === request.userId) {
          reply.code(400);
          return { error: "Cannot connect with yourself" };
        }

        // Check target user exists
        const [target] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, playerId))
          .limit(1);

        if (!target) {
          reply.code(404);
          return { error: "Player not found" };
        }

        // Check if connection already exists in either direction
        const [existing] = await db
          .select()
          .from(connections)
          .where(
            or(
              and(
                eq(connections.userId, request.userId),
                eq(connections.friendId, playerId),
              ),
              and(
                eq(connections.userId, playerId),
                eq(connections.friendId, request.userId),
              ),
            ),
          )
          .limit(1);

        if (existing) {
          if (existing.status === "accepted") {
            reply.code(409);
            return { error: "Already connected" };
          }
          if (existing.status === "pending") {
            // If the other user sent us a request, auto-accept
            if (existing.userId === playerId) {
              const [updated] = await db
                .update(connections)
                .set({ status: "accepted", updatedAt: new Date() })
                .where(eq(connections.id, existing.id))
                .returning();
              return { connection: updated, action: "accepted" };
            }
            reply.code(409);
            return { error: "Request already pending" };
          }
          if (existing.status === "blocked") {
            reply.code(403);
            return { error: "Cannot connect with this player" };
          }
        }

        const [connection] = await db
          .insert(connections)
          .values({
            userId: request.userId,
            friendId: playerId,
            status: "pending",
          })
          .returning();

        reply.code(201);
        return { connection, action: "requested" };
      },
    );

    // Accept or decline a connection request
    app.patch<{
      Params: { connectionId: string };
      Body: { action: "accept" | "decline" | "block" };
    }>("/connections/:connectionId", async (request, reply) => {
      const { connectionId } = request.params;
      const { action } = request.body ?? {};

      if (!action || !["accept", "decline", "block"].includes(action)) {
        reply.code(400);
        return { error: "action must be accept, decline, or block" };
      }

      const [conn] = await db
        .select()
        .from(connections)
        .where(eq(connections.id, connectionId))
        .limit(1);

      if (!conn) {
        reply.code(404);
        return { error: "Connection not found" };
      }

      // Only the recipient can accept/decline
      if (conn.friendId !== request.userId && action !== "block") {
        reply.code(403);
        return { error: "Only the recipient can accept or decline" };
      }

      if (action === "decline") {
        await db.delete(connections).where(eq(connections.id, connectionId));
        return { status: "declined" };
      }

      const newStatus = action === "accept" ? "accepted" : "blocked";
      const [updated] = await db
        .update(connections)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(connections.id, connectionId))
        .returning();

      return { connection: updated };
    });

    // Remove a connection
    app.delete<{ Params: { connectionId: string } }>(
      "/connections/:connectionId",
      async (request, reply) => {
        const { connectionId } = request.params;

        const [conn] = await db
          .select()
          .from(connections)
          .where(eq(connections.id, connectionId))
          .limit(1);

        if (!conn) {
          reply.code(404);
          return { error: "Connection not found" };
        }

        if (conn.userId !== request.userId && conn.friendId !== request.userId) {
          reply.code(403);
          return { error: "Not your connection" };
        }

        await db.delete(connections).where(eq(connections.id, connectionId));
        return { status: "removed" };
      },
    );

    // Get my connections (friends list)
    app.get<{
      Querystring: { status?: string; page?: string; limit?: string };
    }>("/players/me/connections", async (request) => {
      const status = request.query.status ?? "accepted";
      const page = parseInt(request.query.page ?? "1", 10);
      const limit = parseInt(request.query.limit ?? "50", 10);
      const offset = (page - 1) * limit;

      const rows = await db
        .select({
          connectionId: connections.id,
          connectionStatus: connections.status,
          connectionUserId: connections.userId,
          connectionFriendId: connections.friendId,
          createdAt: connections.createdAt,
        })
        .from(connections)
        .where(
          and(
            or(
              eq(connections.userId, request.userId),
              eq(connections.friendId, request.userId),
            ),
            eq(connections.status, status),
          ),
        )
        .orderBy(connections.createdAt)
        .limit(limit)
        .offset(offset);

      // Get the "other" user's profile for each connection
      const otherIds = rows.map((r) =>
        r.connectionUserId === request.userId
          ? r.connectionFriendId
          : r.connectionUserId,
      );

      if (otherIds.length === 0) {
        return { connections: [], page, limit };
      }

      const profiles = await db
        .select({
          userId: playerProfiles.userId,
          displayName: playerProfiles.displayName,
          avatarUrl: playerProfiles.avatarUrl,
          bio: playerProfiles.bio,
          playFrequency: playerProfiles.playFrequency,
        })
        .from(playerProfiles)
        .where(inArray(playerProfiles.userId, otherIds));

      // Also get from users table for those without profiles
      const profileUserIds = new Set(profiles.map((p) => p.userId));
      const missingIds = otherIds.filter((id) => !profileUserIds.has(id));
      const fallbackUsers =
        missingIds.length > 0
          ? await db
              .select({ userId: users.id, displayName: users.displayName })
              .from(users)
              .where(inArray(users.id, missingIds))
          : [];

      const profileMap = new Map<string, { displayName: string; avatarUrl: string | null; bio: string | null; playFrequency: string | null }>();
      for (const p of profiles) {
        profileMap.set(p.userId, p);
      }
      for (const u of fallbackUsers) {
        profileMap.set(u.userId, {
          displayName: u.displayName ?? "Player",
          avatarUrl: null,
          bio: null,
          playFrequency: null,
        });
      }

      // Get ratings
      const ratings = await db
        .select({
          playerId: playerRatings.playerId,
          rating: playerRatings.rating,
          gamesPlayed: playerRatings.gamesPlayed,
          rd: playerRatings.rd,
        })
        .from(playerRatings)
        .where(
          and(
            inArray(playerRatings.playerId, otherIds),
            eq(playerRatings.format, "doubles"),
          ),
        );

      const ratingMap = new Map(ratings.map((r) => [r.playerId, r]));

      const result = rows.map((row) => {
        const otherId =
          row.connectionUserId === request.userId
            ? row.connectionFriendId
            : row.connectionUserId;
        const profile = profileMap.get(otherId);
        const rating = ratingMap.get(otherId);

        return {
          connectionId: row.connectionId,
          status: row.connectionStatus,
          connectedAt: row.createdAt,
          isIncoming: row.connectionFriendId === request.userId,
          profile: {
            userId: otherId,
            displayName: profile?.displayName ?? "Player",
            avatarUrl: profile?.avatarUrl ?? null,
            bio: profile?.bio ?? null,
            playFrequency: profile?.playFrequency ?? null,
            rating: rating ? Math.round(rating.rating) : null,
            gamesPlayed: rating?.gamesPlayed ?? 0,
            confidence: rating ? Math.max(0, 1 - rating.rd / 350) : null,
          },
        };
      });

      return { connections: result, page, limit };
    });

    // Get pending connection requests (incoming)
    app.get("/players/me/requests", async (request) => {
      const rows = await db
        .select({
          connectionId: connections.id,
          senderId: connections.userId,
          createdAt: connections.createdAt,
        })
        .from(connections)
        .where(
          and(
            eq(connections.friendId, request.userId),
            eq(connections.status, "pending"),
          ),
        )
        .orderBy(connections.createdAt);

      if (rows.length === 0) {
        return { requests: [] };
      }

      const senderIds = rows.map((r) => r.senderId);

      const profiles = await db
        .select({
          userId: playerProfiles.userId,
          displayName: playerProfiles.displayName,
          avatarUrl: playerProfiles.avatarUrl,
        })
        .from(playerProfiles)
        .where(inArray(playerProfiles.userId, senderIds));

      const profileMap = new Map(profiles.map((p) => [p.userId, p]));

      // Fallback to users table
      const missingIds = senderIds.filter((id) => !profileMap.has(id));
      if (missingIds.length > 0) {
        const fallback = await db
          .select({ userId: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, missingIds));
        for (const u of fallback) {
          profileMap.set(u.userId, {
            userId: u.userId,
            displayName: u.displayName ?? "Player",
            avatarUrl: null,
          });
        }
      }

      const requests = rows.map((r) => {
        const profile = profileMap.get(r.senderId);
        return {
          connectionId: r.connectionId,
          senderId: r.senderId,
          displayName: profile?.displayName ?? "Player",
          avatarUrl: profile?.avatarUrl ?? null,
          sentAt: r.createdAt,
        };
      });

      return { requests };
    });
  };
}
