import type { FastifyPluginAsync } from "fastify";
import {
  storePreferenceSchema,
  queryPreferencesSchema,
  bulkPreferencesSchema,
} from "@courtiq/shared";
import type { PreferenceStore } from "@courtiq/preference-store";

export function preferenceRoutes(store: PreferenceStore): FastifyPluginAsync {
  return async (app) => {
    // Store preferences
    app.post("/preferences", async (request, reply) => {
      const parsed = storePreferenceSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: "Invalid input", details: parsed.error.flatten() };
      }

      const { userId, preferences } = parsed.data;
      const stored = await store.storePreferences(userId, preferences);
      reply.code(201);
      return { preferences: stored };
    });

    // Semantic query preferences
    app.post("/preferences/query", async (request, reply) => {
      const parsed = queryPreferencesSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: "Invalid input", details: parsed.error.flatten() };
      }

      const { userId, query, topK, categories } = parsed.data;
      const matches = await store.queryPreferences(userId, query, {
        topK,
        categories,
      });
      return { matches };
    });

    // Bulk retrieve preferences (for concierge context)
    app.get<{ Params: { userId: string } }>(
      "/users/:userId/preferences",
      async (request, reply) => {
        const parsed = bulkPreferencesSchema.safeParse({
          userId: request.params.userId,
          ...(request.query as Record<string, unknown>),
        });
        if (!parsed.success) {
          reply.code(400);
          return { error: "Invalid input", details: parsed.error.flatten() };
        }

        const { userId, categories, activeOnly } = parsed.data;
        const prefs = await store.getPreferences(userId, {
          categories,
          activeOnly,
        });
        return { preferences: prefs };
      }
    );

    // Get full preference context for concierge
    app.post<{ Params: { userId: string } }>(
      "/users/:userId/preferences/context",
      async (request, reply) => {
        const userId = request.params.userId;
        const body = request.body as { query?: string; topK?: number };

        if (!body.query) {
          reply.code(400);
          return { error: "query is required" };
        }

        const context = await store.getPreferenceContext(
          userId,
          body.query,
          body.topK
        );
        return context;
      }
    );

    // Deactivate a preference
    app.delete<{ Params: { userId: string; prefId: string } }>(
      "/users/:userId/preferences/:prefId",
      async (request, reply) => {
        const { userId, prefId } = request.params;
        const success = await store.deactivatePreference(prefId, userId);
        if (!success) {
          reply.code(404);
          return { error: "Preference not found" };
        }
        return { success: true };
      }
    );

    // Delete all preferences (GDPR)
    app.delete<{ Params: { userId: string } }>(
      "/users/:userId/preferences",
      async (request, _reply) => {
        const { userId } = request.params;
        const count = await store.deleteAllPreferences(userId);
        return { deleted: count };
      }
    );

    // Export preferences (GDPR data export)
    app.get<{ Params: { userId: string } }>(
      "/users/:userId/preferences/export",
      async (request, _reply) => {
        const { userId } = request.params;
        const prefs = await store.exportPreferences(userId);
        return { preferences: prefs };
      }
    );
  };
}
