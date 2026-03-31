const EMBEDDING_DIMENSIONS = 1024;

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}

/**
 * Voyage AI embedding provider (voyage-3, 1024 dims).
 * Requires VOYAGE_API_KEY env var.
 */
export function createVoyageProvider(): EmbeddingProvider {
  const apiKey = process.env["VOYAGE_API_KEY"];
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY is required for embedding generation");
  }

  return {
    dimensions: EMBEDDING_DIMENSIONS,

    async embed(texts: string[]): Promise<number[][]> {
      const response = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "voyage-3",
          input: texts,
          input_type: "document",
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Voyage API error ${response.status}: ${body}`);
      }

      const result = (await response.json()) as {
        data: { embedding: number[] }[];
      };
      return result.data.map((d) => d.embedding);
    },
  };
}

/**
 * Creates a query embedding (uses input_type: "query" for better retrieval).
 */
export function createVoyageQueryProvider(): EmbeddingProvider {
  const _base = createVoyageProvider();
  const apiKey = process.env["VOYAGE_API_KEY"]!;

  return {
    dimensions: EMBEDDING_DIMENSIONS,

    async embed(texts: string[]): Promise<number[][]> {
      const response = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "voyage-3",
          input: texts,
          input_type: "query",
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Voyage API error ${response.status}: ${body}`);
      }

      const result = (await response.json()) as {
        data: { embedding: number[] }[];
      };
      return result.data.map((d) => d.embedding);
    },
  };
}
