"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";

function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey: key });
}

/** Generate embedding for text using Gemini embedding model */
async function generateEmbedding(text: string): Promise<number[]> {
  const ai = getGenAI();
  try {
    const result = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
      config: { outputDimensionality: 768 },
    });
    const values = result.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw new Error("Embedding API returned empty values");
    }
    return values;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to generate embedding: ${message}`);
  }
}

/** Upsert a knowledge document with auto-generated embedding */
export const upsertWithEmbedding = internalAction({
  args: {
    appSlug: v.string(),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    sourceType: v.string(),
    updatedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const embedding = await generateEmbedding(
      `${args.title}\n\n${args.content}`
    );

    return await ctx.runMutation(internal.knowledgeDb.upsertDocument, {
      ...args,
      embedding,
    });
  },
});

/** Search knowledge base using vector similarity */
export const searchAction = internalAction({
  args: {
    appSlug: v.string(),
    query: v.string(),
    category: v.optional(v.string()),
    topK: v.float64(),
    sessionId: v.optional(v.string()),
    traceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const queryEmbedding = await generateEmbedding(args.query);

    const results = await ctx.runQuery(
      internal.knowledgeDb.vectorSearch,
      {
        embedding: queryEmbedding,
        appSlug: args.appSlug,
        category: args.category,
        limit: args.topK,
      }
    );

    // Use tunable threshold from app config instead of hard-coded value
    const threshold = await ctx.runQuery(internal.knowledgeDb.getAppThreshold, {
      appSlug: args.appSlug,
    });

    const topScore = results[0]?.score ?? 0;
    const gapDetected = results.length === 0 || topScore < threshold;

    // Log search metrics
    await ctx.runMutation(internal.knowledgeDb.logSearch, {
      appSlug: args.appSlug,
      sessionId: args.sessionId ?? "search-api",
      query: args.query,
      topScore,
      resultCount: results.length,
      gapDetected,
      traceId: args.traceId,
    });

    // Log as knowledge gap if below threshold
    if (gapDetected) {
      await ctx.runMutation(internal.knowledgeDb.logKnowledgeGap, {
        appSlug: args.appSlug,
        sessionId: args.sessionId ?? "search-api",
        query: args.query,
        bestMatchScore: topScore,
      });
    }

    return results;
  },
});
