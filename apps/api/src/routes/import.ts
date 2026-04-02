import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getSupportedMigrationPlatforms } from "@courtiq/adapters";
import type { MigrationService } from "../services/migration.js";
import type { MigrationPlatform, MigrationCredentials } from "@courtiq/shared";

const startImportSchema = z.object({
  userId: z.string().uuid(),
  platform: z.enum(["playtomic", "matchi", "reclub", "padel_mates"]),
  credentials: z.object({
    email: z.string().optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    cookies: z.record(z.string()).optional(),
  }).refine(
    (c) => c.accessToken || c.email,
    { message: "Either accessToken or email is required" }
  ),
});

const jobStatusSchema = z.object({
  jobId: z.string().uuid(),
});

const userIdParamSchema = z.object({
  userId: z.string().uuid(),
});

export function importRoutes(migrationService: MigrationService): FastifyPluginAsync {
  return async (app) => {
    // Start a new import
    app.post("/import", async (request, reply) => {
      const parsed = startImportSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: { code: "INVALID_INPUT", message: parsed.error.flatten() } };
      }

      const { userId, platform, credentials } = parsed.data;

      const creds: MigrationCredentials = {
        platform: platform as MigrationPlatform,
        email: credentials.email,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        cookies: credentials.cookies,
      };

      const job = await migrationService.startImport(userId, platform, creds);

      reply.code(202);
      return {
        data: job,
        meta: { message: "Import started. Poll the status endpoint for progress." },
      };
    });

    // Get import job status
    app.get<{ Params: { jobId: string }; Querystring: { userId: string } }>(
      "/import/:jobId",
      async (request, reply) => {
        const params = jobStatusSchema.safeParse(request.params);
        const query = z.object({ userId: z.string().uuid() }).safeParse(request.query);

        if (!params.success || !query.success) {
          reply.code(400);
          return { error: { code: "INVALID_INPUT", message: "Valid jobId and userId required" } };
        }

        const job = await migrationService.getJobStatus(
          params.data.jobId,
          query.data.userId
        );

        if (!job) {
          reply.code(404);
          return { error: { code: "NOT_FOUND", message: "Import job not found" } };
        }

        return { data: job };
      }
    );

    // Get user's import history
    app.get<{ Params: { userId: string } }>(
      "/users/:userId/imports",
      async (request, reply) => {
        const parsed = userIdParamSchema.safeParse(request.params);
        if (!parsed.success) {
          reply.code(400);
          return { error: { code: "INVALID_INPUT", message: "Valid userId required" } };
        }

        const jobs = await migrationService.getUserImportHistory(parsed.data.userId);
        return { data: jobs };
      }
    );

    // List supported migration platforms
    app.get("/import/platforms", async () => {
      return {
        data: getSupportedMigrationPlatforms().map((p) => ({
          platform: p,
          authMethod: getAuthMethod(p),
        })),
      };
    });
  };
}

function getAuthMethod(platform: string): string {
  switch (platform) {
    case "playtomic":
      return "email_or_token";
    case "matchi":
      return "email_password_or_cookies";
    case "reclub":
      return "access_token";
    case "padel_mates":
      return "access_token";
    default:
      return "unknown";
  }
}
