import type { FastifyPluginAsync } from "fastify";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import type { Db } from "@courtiq/db";
import { coaches, coachStudents, coachingSessions } from "@courtiq/db";

export function coachRoutes(db: Db): FastifyPluginAsync {
  return async (app) => {
    // Search coaches (public within authenticated scope)
    app.get<{
      Querystring: {
        venue?: string;
        speciality?: string;
        q?: string;
        limit?: string;
      };
    }>("/coaches", async (request) => {
      const { venue, speciality, q, limit: limitStr } = request.query;
      const limit = Math.min(parseInt(limitStr || "20", 10), 50);

      let query = db
        .select()
        .from(coaches)
        .where(eq(coaches.status, "active"))
        .orderBy(desc(coaches.createdAt))
        .limit(limit);

      const results = await query;

      // Filter in-memory for JSONB fields (venue, speciality, search)
      let filtered = results;
      if (venue) {
        filtered = filtered.filter((c) => (c.venueIds ?? []).includes(venue));
      }
      if (speciality) {
        filtered = filtered.filter((c) =>
          (c.specialities ?? []).some((s: string) => s.toLowerCase().includes(speciality.toLowerCase()))
        );
      }
      if (q) {
        const term = q.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            (c.bio ?? "").toLowerCase().includes(term) ||
            (c.specialities ?? []).some((s: string) => s.toLowerCase().includes(term))
        );
      }

      return {
        data: filtered.map(formatCoachProfile),
      };
    });

    // Get single coach profile
    app.get<{ Params: { id: string } }>("/coaches/:id", async (request, reply) => {
      const { id } = request.params;
      const [coach] = await db.select().from(coaches).where(eq(coaches.id, id)).limit(1);
      if (!coach) {
        reply.code(404);
        return { error: { code: "NOT_FOUND", message: "Coach not found" } };
      }

      // Get upcoming sessions
      const sessions = await db
        .select()
        .from(coachingSessions)
        .where(
          and(
            eq(coachingSessions.coachId, id),
            eq(coachingSessions.status, "available"),
          )
        )
        .orderBy(coachingSessions.startsAt)
        .limit(20);

      return {
        data: {
          ...formatCoachProfile(coach),
          availableSessions: sessions.map((s) => ({
            id: s.id,
            lessonType: s.lessonType,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            priceCents: s.priceCents,
            currency: s.currency,
            maxStudents: s.maxStudents,
            currentStudents: (s.studentIds ?? []).length,
          })),
        },
      };
    });

    // Register as a coach (self-service)
    app.post<{
      Body: {
        name: string;
        bio?: string;
        email?: string;
        phone?: string;
        certifications?: string[];
        languages?: string[];
        specialities?: string[];
        lessonTypes?: { name: string; durationMin: number; priceCents: number; maxStudents: number; description?: string }[];
        venueIds?: string[];
      };
    }>("/coaches", async (request, reply) => {
      const userId = (request as unknown as { userId: string }).userId;
      const { name, bio, email, phone, certifications, languages, specialities, lessonTypes, venueIds } = request.body;

      if (!name) {
        reply.code(400);
        return { error: { code: "MISSING_NAME", message: "Coach name is required" } };
      }

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        + `-${Date.now()}`;

      const [coach] = await db
        .insert(coaches)
        .values({
          userId: userId || undefined,
          name,
          slug,
          bio,
          email,
          phone,
          certifications: certifications ?? [],
          languages: languages ?? [],
          specialities: specialities ?? [],
          lessonTypes: lessonTypes ?? [],
          venueIds: venueIds ?? [],
          sourcePlatform: "manual",
          status: "active",
        })
        .returning();

      return { data: formatCoachProfile(coach) };
    });

    // Update coach profile
    app.patch<{
      Params: { id: string };
      Body: Partial<{
        name: string;
        bio: string;
        email: string;
        phone: string;
        certifications: string[];
        languages: string[];
        specialities: string[];
        lessonTypes: { name: string; durationMin: number; priceCents: number; maxStudents: number; description?: string }[];
        venueIds: string[];
        status: string;
      }>;
    }>("/coaches/:id", async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const [existing] = await db.select().from(coaches).where(eq(coaches.id, id)).limit(1);
      if (!existing) {
        reply.code(404);
        return { error: { code: "NOT_FOUND", message: "Coach not found" } };
      }

      const [updated] = await db
        .update(coaches)
        .set({
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.bio !== undefined && { bio: updates.bio }),
          ...(updates.email !== undefined && { email: updates.email }),
          ...(updates.phone !== undefined && { phone: updates.phone }),
          ...(updates.certifications !== undefined && { certifications: updates.certifications }),
          ...(updates.languages !== undefined && { languages: updates.languages }),
          ...(updates.specialities !== undefined && { specialities: updates.specialities }),
          ...(updates.lessonTypes !== undefined && { lessonTypes: updates.lessonTypes }),
          ...(updates.venueIds !== undefined && { venueIds: updates.venueIds }),
          ...(updates.status !== undefined && { status: updates.status }),
          updatedAt: new Date(),
        })
        .where(eq(coaches.id, id))
        .returning();

      return { data: formatCoachProfile(updated) };
    });

    // --- Coach Students ---

    // Get coach's students
    app.get<{ Params: { id: string } }>("/coaches/:id/students", async (request) => {
      const { id } = request.params;
      const students = await db
        .select()
        .from(coachStudents)
        .where(and(eq(coachStudents.coachId, id), eq(coachStudents.status, "active")));

      return { data: students };
    });

    // Add student to coach
    app.post<{ Params: { id: string }; Body: { studentId: string; notes?: string } }>(
      "/coaches/:id/students",
      async (request, reply) => {
        const { id } = request.params;
        const { studentId, notes } = request.body;

        const [relation] = await db
          .insert(coachStudents)
          .values({ coachId: id, studentId, notes, status: "active" })
          .onConflictDoNothing()
          .returning();

        if (!relation) {
          return { data: { message: "Student already linked" } };
        }
        return { data: relation };
      },
    );

    // --- Coaching Sessions ---

    // Create session (coach creates available slots)
    app.post<{
      Params: { id: string };
      Body: {
        lessonType: string;
        startsAt: string;
        endsAt: string;
        priceCents: number;
        currency?: string;
        maxStudents?: number;
        venueId?: string;
        courtId?: string;
        notes?: string;
      };
    }>("/coaches/:id/sessions", async (request, reply) => {
      const { id } = request.params;
      const { lessonType, startsAt, endsAt, priceCents, currency, maxStudents, venueId, courtId, notes } = request.body;

      const [session] = await db
        .insert(coachingSessions)
        .values({
          coachId: id,
          lessonType,
          startsAt: new Date(startsAt),
          endsAt: new Date(endsAt),
          priceCents,
          currency: currency ?? "THB",
          maxStudents: maxStudents ?? 1,
          venueId: venueId ?? null,
          courtId: courtId ?? null,
          notes,
          status: "available",
        })
        .returning();

      return { data: session };
    });

    // Book a coaching session
    app.post<{ Params: { sessionId: string } }>(
      "/coaching-sessions/:sessionId/book",
      async (request, reply) => {
        const userId = (request as unknown as { userId: string }).userId;
        const { sessionId } = request.params;

        const [session] = await db
          .select()
          .from(coachingSessions)
          .where(eq(coachingSessions.id, sessionId))
          .limit(1);

        if (!session) {
          reply.code(404);
          return { error: { code: "NOT_FOUND", message: "Session not found" } };
        }

        if (session.status !== "available") {
          reply.code(409);
          return { error: { code: "NOT_AVAILABLE", message: "Session is no longer available" } };
        }

        const currentStudents = session.studentIds ?? [];
        if (currentStudents.length >= session.maxStudents) {
          reply.code(409);
          return { error: { code: "SESSION_FULL", message: "Session is full" } };
        }

        const newStatus = currentStudents.length + 1 >= session.maxStudents ? "booked" : "available";

        const [updated] = await db
          .update(coachingSessions)
          .set({
            studentIds: [...currentStudents, userId],
            status: newStatus,
          })
          .where(eq(coachingSessions.id, sessionId))
          .returning();

        return { data: updated };
      },
    );

    // --- Import Coach Profile ---

    app.post<{
      Body: {
        name: string;
        bio?: string;
        email?: string;
        phone?: string;
        certifications?: string[];
        languages?: string[];
        specialities?: string[];
        lessonTypes?: { name: string; durationMin: number; priceCents: number; maxStudents: number }[];
        venueIds?: string[];
        students?: { name: string; phone?: string; email?: string }[];
        sessions?: { lessonType: string; startsAt: string; endsAt: string; priceCents: number; currency?: string; maxStudents?: number }[];
        sourcePlatform?: string;
        sourceId?: string;
      };
    }>("/coaches/import", async (request, reply) => {
      const body = request.body;

      if (!body.name) {
        reply.code(400);
        return { error: { code: "MISSING_NAME", message: "Coach name is required" } };
      }

      const slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        + `-${Date.now()}`;

      // Create coach profile
      const [coach] = await db
        .insert(coaches)
        .values({
          name: body.name,
          slug,
          bio: body.bio,
          email: body.email,
          phone: body.phone,
          certifications: body.certifications ?? [],
          languages: body.languages ?? [],
          specialities: body.specialities ?? [],
          lessonTypes: body.lessonTypes ?? [],
          venueIds: body.venueIds ?? [],
          sourcePlatform: body.sourcePlatform ?? "import",
          sourceId: body.sourceId,
          status: "active",
          metadata: {
            importedAt: new Date().toISOString(),
            importedStudentCount: (body.students ?? []).length,
            importedSessionCount: (body.sessions ?? []).length,
          },
        })
        .returning();

      // Import sessions
      let sessionCount = 0;
      if (body.sessions && body.sessions.length > 0) {
        for (const s of body.sessions) {
          await db.insert(coachingSessions).values({
            coachId: coach.id,
            lessonType: s.lessonType,
            startsAt: new Date(s.startsAt),
            endsAt: new Date(s.endsAt),
            priceCents: s.priceCents,
            currency: s.currency ?? "THB",
            maxStudents: s.maxStudents ?? 1,
            status: "available",
          });
          sessionCount++;
        }
      }

      return {
        data: {
          coachId: coach.id,
          name: coach.name,
          slug: coach.slug,
          lessonsImported: sessionCount,
          studentsNoted: (body.students ?? []).length,
          message: `Coach profile created. ${sessionCount} session(s) imported.`,
        },
      };
    });
  };
}

function formatCoachProfile(coach: typeof coaches.$inferSelect) {
  return {
    id: coach.id,
    name: coach.name,
    slug: coach.slug,
    bio: coach.bio,
    avatarUrl: coach.avatarUrl,
    certifications: coach.certifications,
    languages: coach.languages,
    specialities: coach.specialities,
    lessonTypes: coach.lessonTypes,
    venueIds: coach.venueIds,
    status: coach.status,
  };
}
