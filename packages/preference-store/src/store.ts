import { eq, and, sql, inArray } from "drizzle-orm";
import { preferences, type Db } from "@courtiq/db";
import type {
  Preference,
  PreferenceCategory,
  PreferenceContext,
  PreferenceMatch,
} from "@courtiq/shared";
import type { EmbeddingProvider } from "./embeddings.js";
import { parsePreferences, type ParsedPreference } from "./parser.js";

export interface PreferenceStoreConfig {
  db: Db;
  documentEmbedder: EmbeddingProvider;
  queryEmbedder: EmbeddingProvider;
  anthropicApiKey: string;
}

export class PreferenceStore {
  private db: Db;
  private documentEmbedder: EmbeddingProvider;
  private queryEmbedder: EmbeddingProvider;
  private anthropicApiKey: string;

  constructor(config: PreferenceStoreConfig) {
    this.db = config.db;
    this.documentEmbedder = config.documentEmbedder;
    this.queryEmbedder = config.queryEmbedder;
    this.anthropicApiKey = config.anthropicApiKey;
  }

  /**
   * Store one or more preferences for a user.
   * Handles: natural language parsing → category extraction → embedding → insert.
   */
  async storePreferences(
    userId: string,
    inputs: { text: string; category?: PreferenceCategory }[]
  ): Promise<Preference[]> {
    // Step 1: Parse and categorize
    const parsed: ParsedPreference[] = await parsePreferences(
      inputs,
      this.anthropicApiKey
    );

    // Step 2: Generate embeddings for all preference texts
    const texts = parsed.map((p) => p.text);
    const embeddingVectors = await this.documentEmbedder.embed(texts);

    // Step 3: Insert into database
    const rows = parsed.map((p, i) => ({
      userId,
      category: p.category,
      text: p.text,
      embedding: embeddingVectors[i],
      active: true,
    }));

    const inserted = await this.db
      .insert(preferences)
      .values(rows)
      .returning();

    return inserted.map(rowToPreference);
  }

  /**
   * Semantic search: find preferences most relevant to a query.
   * Uses cosine similarity on pgvector embeddings.
   */
  async queryPreferences(
    userId: string,
    query: string,
    options: {
      topK?: number;
      categories?: PreferenceCategory[];
    } = {}
  ): Promise<PreferenceMatch[]> {
    const { topK = 10, categories } = options;

    // Embed the query using the query-optimized provider
    const [queryEmbedding] = await this.queryEmbedder.embed([query]);

    const embeddingLiteral = `[${queryEmbedding.join(",")}]`;

    // Build conditions
    const conditions = [
      eq(preferences.userId, userId),
      eq(preferences.active, true),
    ];
    if (categories && categories.length > 0) {
      conditions.push(inArray(preferences.category, categories));
    }

    const results = await this.db
      .select({
        id: preferences.id,
        userId: preferences.userId,
        category: preferences.category,
        text: preferences.text,
        active: preferences.active,
        createdAt: preferences.createdAt,
        similarity: sql<number>`1 - (${preferences.embedding} <=> ${embeddingLiteral}::vector)`.as(
          "similarity"
        ),
      })
      .from(preferences)
      .where(and(...conditions))
      .orderBy(
        sql`${preferences.embedding} <=> ${embeddingLiteral}::vector`
      )
      .limit(topK);

    return results.map((r) => ({
      preference: {
        id: r.id,
        userId: r.userId,
        category: r.category as PreferenceCategory,
        text: r.text,
        active: r.active,
        createdAt: r.createdAt,
      },
      similarity: r.similarity,
    }));
  }

  /**
   * Get all preferences for a user, optionally filtered by category.
   * Used by the concierge for bulk context retrieval.
   */
  async getPreferences(
    userId: string,
    options: {
      categories?: PreferenceCategory[];
      activeOnly?: boolean;
    } = {}
  ): Promise<Preference[]> {
    const { categories, activeOnly = true } = options;

    const conditions = [eq(preferences.userId, userId)];
    if (activeOnly) {
      conditions.push(eq(preferences.active, true));
    }
    if (categories && categories.length > 0) {
      conditions.push(inArray(preferences.category, categories));
    }

    const rows = await this.db
      .select()
      .from(preferences)
      .where(and(...conditions))
      .orderBy(preferences.createdAt);

    return rows.map(rowToPreference);
  }

  /**
   * Build a full preference context for the concierge.
   * Returns both semantic matches and a structured category map.
   */
  async getPreferenceContext(
    userId: string,
    query: string,
    topK: number = 10
  ): Promise<PreferenceContext> {
    const [matches, allPrefs] = await Promise.all([
      this.queryPreferences(userId, query, { topK }),
      this.getPreferences(userId),
    ]);

    // Build structured map: category → list of texts
    const structured: Partial<Record<PreferenceCategory, string[]>> = {};
    for (const pref of allPrefs) {
      const cat = pref.category;
      if (!structured[cat]) structured[cat] = [];
      structured[cat]!.push(pref.text);
    }

    return { userId, preferences: matches, structured };
  }

  /**
   * Deactivate a preference (soft delete).
   */
  async deactivatePreference(preferenceId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(preferences)
      .set({ active: false })
      .where(
        and(eq(preferences.id, preferenceId), eq(preferences.userId, userId))
      )
      .returning({ id: preferences.id });

    return result.length > 0;
  }

  /**
   * Delete all preferences for a user (GDPR/privacy: data export/delete support).
   */
  async deleteAllPreferences(userId: string): Promise<number> {
    const deleted = await this.db
      .delete(preferences)
      .where(eq(preferences.userId, userId))
      .returning({ id: preferences.id });

    return deleted.length;
  }

  /**
   * Export all preference data for a user (GDPR data export).
   */
  async exportPreferences(userId: string): Promise<Preference[]> {
    return this.getPreferences(userId, { activeOnly: false });
  }
}

function rowToPreference(row: {
  id: string;
  userId: string;
  category: string;
  text: string;
  embedding: number[] | null;
  active: boolean;
  createdAt: Date;
}): Preference {
  return {
    id: row.id,
    userId: row.userId,
    category: row.category as PreferenceCategory,
    text: row.text,
    active: row.active,
    createdAt: row.createdAt,
  };
}
