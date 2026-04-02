import { eq, and } from "drizzle-orm";
import { migrationJobs, matchHistory, userConnections, type Db } from "@courtiq/db";
import { getMigrationAdapter } from "@courtiq/adapters";
import type { PreferenceStore } from "@courtiq/preference-store";
import type {
  MigrationPlatform,
  MigrationCredentials,
  MigrationData,
  ImportJob,
  PreferenceCategory,
} from "@courtiq/shared";
import Anthropic from "@anthropic-ai/sdk";

export interface MigrationServiceConfig {
  db: Db;
  preferenceStore: PreferenceStore | null;
  anthropicApiKey: string | null;
}

export class MigrationService {
  private db: Db;
  private preferenceStore: PreferenceStore | null;
  private anthropicApiKey: string | null;

  constructor(config: MigrationServiceConfig) {
    this.db = config.db;
    this.preferenceStore = config.preferenceStore;
    this.anthropicApiKey = config.anthropicApiKey;
  }

  async startImport(
    userId: string,
    platform: MigrationPlatform,
    credentials: MigrationCredentials
  ): Promise<ImportJob> {
    const adapter = getMigrationAdapter(platform);
    if (!adapter) throw new Error(`Unsupported migration platform: ${platform}`);

    // Create the job record
    const [job] = await this.db
      .insert(migrationJobs)
      .values({
        userId,
        platform,
        status: "pending",
        platformCredentials: { accessToken: "[redacted]" }, // Never store raw tokens
      })
      .returning();

    if (!job) throw new Error("Failed to create import job");

    // Run import asynchronously (non-blocking)
    this.runImport(job.id, userId, platform, credentials).catch((err) => {
      console.error(`Import job ${job.id} failed:`, err);
    });

    return this.jobRowToImportJob(job);
  }

  async getJobStatus(jobId: string, userId: string): Promise<ImportJob | null> {
    const [job] = await this.db
      .select()
      .from(migrationJobs)
      .where(and(eq(migrationJobs.id, jobId), eq(migrationJobs.userId, userId)));

    return job ? this.jobRowToImportJob(job) : null;
  }

  async getUserImportHistory(userId: string): Promise<ImportJob[]> {
    const jobs = await this.db
      .select()
      .from(migrationJobs)
      .where(eq(migrationJobs.userId, userId))
      .orderBy(migrationJobs.createdAt);

    return jobs.map((j) => this.jobRowToImportJob(j));
  }

  private async runImport(
    jobId: string,
    userId: string,
    platform: MigrationPlatform,
    credentials: MigrationCredentials
  ): Promise<void> {
    const adapter = getMigrationAdapter(platform)!;

    try {
      // Mark as running
      await this.updateJob(jobId, { status: "running", startedAt: new Date() });
      await this.updateJob(jobId, { progress: 5 });

      // Validate credentials
      const valid = await adapter.validateCredentials(credentials);
      if (!valid) {
        await this.updateJob(jobId, {
          status: "failed",
          errorMessage: "Invalid credentials. Please re-authenticate and try again.",
          completedAt: new Date(),
        });
        return;
      }
      await this.updateJob(jobId, { progress: 10 });

      // Extract data from platform
      const data = await adapter.extractUserData(credentials);
      await this.updateJob(jobId, { progress: 40 });

      // Store match history
      const matchCount = await this.storeMatches(userId, jobId, platform, data);
      await this.updateJob(jobId, { matchesImported: matchCount, progress: 55 });

      // Store connections
      const connectionCount = await this.storeConnections(userId, jobId, platform, data);
      await this.updateJob(jobId, { connectionsImported: connectionCount, progress: 65 });

      // Count bookings as imported (they inform preference seeding)
      await this.updateJob(jobId, { bookingsImported: data.bookings.length, progress: 70 });

      // Seed preferences from imported data using Claude
      let preferencesSeeded = 0;
      let summary: string | undefined;
      if (this.preferenceStore && this.anthropicApiKey) {
        const result = await this.seedPreferences(userId, data);
        preferencesSeeded = result.count;
        summary = result.summary;
      }

      await this.updateJob(jobId, {
        status: "completed",
        preferencesSeeded,
        summary,
        progress: 100,
        completedAt: new Date(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.updateJob(jobId, {
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      });
    }
  }

  private async storeMatches(
    userId: string,
    jobId: string,
    platform: string,
    data: MigrationData
  ): Promise<number> {
    if (data.matches.length === 0) return 0;

    const rows = data.matches.map((m) => ({
      userId,
      importJobId: jobId,
      platform,
      platformMatchId: m.platformMatchId,
      playedAt: m.playedAt,
      venueName: m.venueName,
      courtName: m.courtName,
      format: m.format,
      result: m.result,
      score: m.score,
      partnerNames: m.partnerNames,
      opponentNames: m.opponentNames,
      durationMinutes: m.durationMinutes,
      metadata: m.metadata,
    }));

    // Insert in batches of 50
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const result = await this.db.insert(matchHistory).values(batch).returning({ id: matchHistory.id });
      inserted += result.length;
    }

    return inserted;
  }

  private async storeConnections(
    userId: string,
    jobId: string,
    platform: string,
    data: MigrationData
  ): Promise<number> {
    if (data.connections.length === 0) return 0;

    const rows = data.connections.map((c) => ({
      userId,
      importJobId: jobId,
      platform,
      platformUserId: c.platformUserId,
      displayName: c.displayName,
      skillLevel: c.skillLevel,
      metadata: c.metadata,
    }));

    const result = await this.db.insert(userConnections).values(rows).returning({ id: userConnections.id });
    return result.length;
  }

  private async seedPreferences(
    userId: string,
    data: MigrationData
  ): Promise<{ count: number; summary: string }> {
    const client = new Anthropic({ apiKey: this.anthropicApiKey! });

    // Build a rich context from the imported data
    const context = this.buildImportContext(data);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You are an AI assistant that analyzes a padel player's imported data (match history, bookings, profile) and generates natural language preference entries for their CourtIQ profile.

Your job is to infer what this player likes, their play style, skill level, scheduling patterns, venue preferences, and social preferences based on their data.

Respond with a JSON object:
{
  "summary": "A 2-3 sentence summary of this player's style and preferences",
  "preferences": [
    { "text": "natural language preference", "category": "category_name" }
  ]
}

Valid categories: play_style, skill_level, competitive_intent, time, location, court_surface, group_size, coaching

Guidelines:
- Generate 5-15 preferences based on the data richness
- Each preference should be a natural statement, as if the player wrote it themselves
- Focus on patterns: do they play mornings or evenings? Same venue or variety? Competitive or social?
- If match results are available, infer competitive level and intensity
- If booking patterns show time preferences, capture those
- If they have many connections, note they're social players
- Be specific to the data — don't invent preferences not supported by evidence`,
      messages: [
        {
          role: "user",
          content: `Analyze this imported player data and generate preference entries:\n\n${context}`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Extract JSON from response (handle markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { count: 0, summary: "Unable to analyze imported data." };

    const parsed = JSON.parse(jsonMatch[0]) as {
      summary: string;
      preferences: Array<{ text: string; category: string }>;
    };

    // Store preferences via the preference store
    if (this.preferenceStore && parsed.preferences.length > 0) {
      const inputs = parsed.preferences.map((p) => ({
        text: p.text,
        category: p.category as PreferenceCategory,
      }));
      await this.preferenceStore.storePreferences(userId, inputs);
    }

    return {
      count: parsed.preferences.length,
      summary: parsed.summary,
    };
  }

  private buildImportContext(data: MigrationData): string {
    const parts: string[] = [];

    if (data.profile) {
      parts.push("## Player Profile");
      if (data.profile.displayName) parts.push(`Name: ${data.profile.displayName}`);
      if (data.profile.rating) parts.push(`Rating: ${data.profile.rating} (${data.profile.ratingSystem ?? "unknown system"})`);
      if (data.profile.preferredHand) parts.push(`Preferred hand: ${data.profile.preferredHand}`);
      if (data.profile.preferredPosition) parts.push(`Preferred position: ${data.profile.preferredPosition}`);
      if (data.profile.memberSince) parts.push(`Member since: ${data.profile.memberSince.toISOString().slice(0, 10)}`);
    }

    if (data.matches.length > 0) {
      parts.push(`\n## Match History (${data.matches.length} matches)`);

      // Summarize rather than dump all matches
      const wins = data.matches.filter((m) => m.result === "won").length;
      const losses = data.matches.filter((m) => m.result === "lost").length;
      const formats = new Set(data.matches.map((m) => m.format).filter(Boolean));
      const venues = new Set(data.matches.map((m) => m.venueName).filter(Boolean));

      parts.push(`Record: ${wins}W / ${losses}L / ${data.matches.length - wins - losses} unrecorded`);
      parts.push(`Formats played: ${[...formats].join(", ") || "unknown"}`);
      parts.push(`Venues: ${[...venues].join(", ") || "unknown"}`);

      // Time analysis
      const hours = data.matches.map((m) => m.playedAt.getHours());
      const mornings = hours.filter((h) => h < 12).length;
      const afternoons = hours.filter((h) => h >= 12 && h < 17).length;
      const evenings = hours.filter((h) => h >= 17).length;
      parts.push(`Time distribution: ${mornings} morning / ${afternoons} afternoon / ${evenings} evening`);

      // Day of week
      const days = data.matches.map((m) => m.playedAt.getDay());
      const weekdays = days.filter((d) => d >= 1 && d <= 5).length;
      const weekends = days.filter((d) => d === 0 || d === 6).length;
      parts.push(`Day distribution: ${weekdays} weekday / ${weekends} weekend`);

      // Frequent partners/opponents
      const partnerCounts = new Map<string, number>();
      for (const m of data.matches) {
        for (const p of m.partnerNames) {
          partnerCounts.set(p, (partnerCounts.get(p) ?? 0) + 1);
        }
      }
      const topPartners = [...partnerCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      if (topPartners.length > 0) {
        parts.push(`Frequent partners: ${topPartners.map(([n, c]) => `${n} (${c}x)`).join(", ")}`);
      }

      // Recent matches sample
      const recent = data.matches.slice(-5);
      parts.push("\nRecent matches:");
      for (const m of recent) {
        const line = [
          m.playedAt.toISOString().slice(0, 10),
          m.venueName,
          m.format,
          m.result,
          m.score,
        ].filter(Boolean).join(" | ");
        parts.push(`  - ${line}`);
      }
    }

    if (data.bookings.length > 0) {
      parts.push(`\n## Booking History (${data.bookings.length} bookings)`);
      const venues = new Set(data.bookings.map((b) => b.venueName));
      parts.push(`Venues booked: ${[...venues].join(", ")}`);

      if (data.bookings.some((b) => b.pricePaid)) {
        const prices = data.bookings.filter((b) => b.pricePaid).map((b) => b.pricePaid!);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        parts.push(`Average price: ${avg.toFixed(0)} ${data.bookings[0]?.currency ?? "THB"}`);
      }
    }

    if (data.connections.length > 0) {
      parts.push(`\n## Connections (${data.connections.length} players)`);
      const withLevel = data.connections.filter((c) => c.skillLevel);
      if (withLevel.length > 0) {
        const levels = withLevel.map((c) => parseFloat(c.skillLevel!)).filter((n) => !isNaN(n));
        if (levels.length > 0) {
          const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
          parts.push(`Average connection skill level: ${avg.toFixed(1)}`);
        }
      }
    }

    return parts.join("\n");
  }

  private async updateJob(jobId: string, updates: Record<string, unknown>): Promise<void> {
    await this.db
      .update(migrationJobs)
      .set(updates)
      .where(eq(migrationJobs.id, jobId));
  }

  private jobRowToImportJob(row: typeof migrationJobs.$inferSelect): ImportJob {
    return {
      id: row.id,
      userId: row.userId,
      platform: row.platform as MigrationPlatform,
      status: row.status as ImportJob["status"],
      progress: row.progress,
      matchesImported: row.matchesImported,
      bookingsImported: row.bookingsImported,
      connectionsImported: row.connectionsImported,
      preferencesSeeded: row.preferencesSeeded,
      errorMessage: row.errorMessage ?? undefined,
      summary: row.summary ?? undefined,
      startedAt: row.startedAt ?? undefined,
      completedAt: row.completedAt ?? undefined,
      createdAt: row.createdAt,
    };
  }
}
