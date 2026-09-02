

import type { Index } from "@pinecone-database/pinecone";
import { getOpenAIClient } from "@/lib/openai";

export interface VectorMatch {
  text: string;
  score: number;
  source: string;
}

/**
 * Embed the query and search the given Pinecone index for the top-K matches.
 * @param query    - The user message to embed and search for.
 * @param index    - A Pinecone Index object (from getAdminIndex / getCustomerIndex).
 * @param topK     - Number of results to return (default 3).
 * @param minScore - Minimum similarity score to include (default 0.3). Raise to
 *                   reduce irrelevant context and save tokens.
 */
export async function semanticSearch(
  query: string,
  index: Index | null,
  topK = 3,
  minScore = 0.3
): Promise<VectorMatch[]> {
  if (!index) return [];

  const client = getOpenAIClient();
  if (!client) return [];

  try {
   
    const embeddingResponse = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryVector = embeddingResponse.data[0].embedding;

    
    const results = await index.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
    });

    
    return (results.matches ?? [])
      .filter((m) => m.score != null && m.score > minScore)
      .map((m) => ({
        text: String(m.metadata?.text ?? ""),
        score: m.score ?? 0,
        source: String(m.metadata?.source ?? "unknown"),
      }));
  } catch (err) {
    console.error("vectorSearch error:", err);
    return [];
  }
}

export function formatContext(matches: VectorMatch[]): string {
  if (matches.length === 0) return "";
  const lines = matches.map((m, i) => `[${i + 1}] (source: ${m.source})\n${m.text}`);
  return `\n\n## Retrieved Knowledge\n${lines.join("\n\n---\n\n")}`;
}
