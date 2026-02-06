"use node";

import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
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
  const result = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: text,
  });
  return result.embeddings?.[0]?.values ?? [];
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

    return await ctx.runMutation(internal.knowledgeInternal.upsertDocument, {
      ...args,
      embedding,
    });
  },
});

/** Upsert document in DB */
export const upsertDocument = internalMutation({
  args: {
    appSlug: v.string(),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    sourceType: v.string(),
    embedding: v.array(v.float64()),
    updatedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for existing doc with same title + app
    const existing = await ctx.db
      .query("knowledgeDocuments")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    const match = existing.find((d) => d.title === args.title);

    if (match) {
      await ctx.db.patch(match._id, {
        content: args.content,
        category: args.category,
        sourceType: args.sourceType,
        embedding: args.embedding,
        lastUpdated: Date.now(),
        updatedBy: args.updatedBy,
      });
      return match._id;
    }

    return await ctx.db.insert("knowledgeDocuments", {
      appSlug: args.appSlug,
      title: args.title,
      content: args.content,
      category: args.category,
      sourceType: args.sourceType,
      embedding: args.embedding,
      lastUpdated: Date.now(),
      updatedBy: args.updatedBy,
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
  },
  handler: async (ctx, args) => {
    const queryEmbedding = await generateEmbedding(args.query);

    const filter: Record<string, string> = { appSlug: args.appSlug };
    if (args.category) filter.category = args.category;

    const results = await ctx.runQuery(
      internal.knowledgeInternal.vectorSearch,
      {
        embedding: queryEmbedding,
        appSlug: args.appSlug,
        category: args.category,
        limit: args.topK,
      }
    );

    // Log as knowledge gap if best score is low
    if (results.length === 0 || (results[0] && results[0].score < 0.5)) {
      await ctx.runMutation(internal.knowledgeInternal.logKnowledgeGap, {
        appSlug: args.appSlug,
        sessionId: "search-api",
        query: args.query,
        bestMatchScore: results[0]?.score ?? 0,
      });
    }

    return results;
  },
});

/** Vector search query */
export const vectorSearch = internalQuery({
  args: {
    embedding: v.array(v.float64()),
    appSlug: v.string(),
    category: v.optional(v.string()),
    limit: v.float64(),
  },
  handler: async (ctx, args) => {
    const filter: Record<string, string> = { appSlug: args.appSlug };
    if (args.category) filter.category = args.category;

    const results = await ctx.db
      .query("knowledgeDocuments")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    // Compute cosine similarity manually since vectorSearch
    // may not be available in all Convex versions
    const scored = results.map((doc) => {
      const score = cosineSimilarity(args.embedding, doc.embedding);
      return { ...doc, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, args.limit).map((d) => ({
      id: d._id,
      title: d.title,
      content: d.content,
      category: d.category,
      score: d.score,
    }));
  },
});

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

/** Log a knowledge gap */
export const logKnowledgeGap = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    query: v.string(),
    bestMatchScore: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("knowledgeGaps", {
      ...args,
      resolved: false,
      createdAt: Date.now(),
    });
  },
});

/** Get unresolved knowledge gaps */
export const getUnresolvedGaps = internalQuery({
  args: { appSlug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("knowledgeGaps")
      .withIndex("by_app_resolved", (q) =>
        q.eq("appSlug", args.appSlug).eq("resolved", false)
      )
      .order("desc")
      .take(100);
  },
});
