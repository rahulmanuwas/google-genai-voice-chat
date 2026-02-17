import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getTraceId, getFullAuthCredentials, corsHttpAction } from "./helpers";

const BM25_K1 = 1.5;
const BM25_B = 0.75;
const MAX_BM25_DOCS = 500;

interface RankedSearchRecord {
  _id: string;
  title: string;
  content: string;
  category: string;
  sourceType: string;
  sourceSessionId?: string;
  score: number;
  updatedAt: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function rankByBm25<T extends { _id: string; title: string; content: string; updatedAt: number }>(
  records: T[],
  query: string,
  limit: number,
): Array<T & { score: number }> {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0 || records.length === 0) return [];

  const termSet = Array.from(new Set(queryTerms));
  const docs = records.map((record) => {
    const text = `${record.title}\n${record.content}`;
    const tokens = tokenize(text);
    const termFreq = new Map<string, number>();
    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
    }
    return { record, tokens, termFreq, length: tokens.length };
  });

  const avgDocLength = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length;
  const docFreq = new Map<string, number>();
  for (const term of termSet) {
    let count = 0;
    for (const doc of docs) {
      if ((doc.termFreq.get(term) ?? 0) > 0) count += 1;
    }
    docFreq.set(term, count);
  }

  const totalDocs = docs.length;
  const ranked = docs.map((doc) => {
    let score = 0;
    for (const term of termSet) {
      const tf = doc.termFreq.get(term) ?? 0;
      if (tf === 0) continue;
      const df = docFreq.get(term) ?? 0;
      const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
      const denom = tf + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / (avgDocLength || 1)));
      score += idf * ((tf * (BM25_K1 + 1)) / denom);
    }

    const rawText = `${doc.record.title}\n${doc.record.content}`.toLowerCase();
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length > 2 && rawText.includes(normalizedQuery)) {
      score += 0.25;
    }

    return { ...doc.record, score };
  });

  ranked.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
  return ranked.filter((doc) => doc.score > 0).slice(0, limit);
}

/** POST /api/knowledge — Add or update a knowledge document */
export const upsertDocument = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { title, content, category, sourceType, updatedBy } =
    body as {
      title: string;
      content: string;
      category: string;
      sourceType?: string;
      updatedBy?: string;
    };

  if (!title || !content || !category) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const docId = await ctx.runAction(internal.knowledgeInternal.upsertWithEmbeddingAction, {
    appSlug: auth.app.slug,
    title,
    content,
    category,
    sourceType: sourceType ?? "document",
    updatedBy,
  });

  return jsonResponse({ id: docId });
});

/** POST /api/knowledge/search — Hybrid search (vector + BM25 + transcript memory) */
export const searchKnowledge = corsHttpAction(async (ctx, request) => {
  const traceId = getTraceId(request);
  const body = await request.json();
  const { query, category, topK, sessionId, includeTranscriptMemory, alphaVector, alphaKeyword, alphaMemory } = body as {
    query: string;
    category?: string;
    topK?: number;
    sessionId?: string;
    includeTranscriptMemory?: boolean;
    alphaVector?: number;
    alphaKeyword?: number;
    alphaMemory?: number;
  };

  if (!query) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const results = await ctx.runAction(internal.knowledgeInternal.searchKnowledgeAction, {
    appSlug: auth.app.slug,
    query,
    category,
    topK: topK ?? 5,
    sessionId,
    traceId,
    includeTranscriptMemory,
    alphaVector,
    alphaKeyword,
    alphaMemory,
  });

  return jsonResponse({ results });
});

/** GET /api/knowledge/documents — List knowledge documents */
export const listDocuments = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const documents = await ctx.runQuery(
    internal.knowledge.listKnowledgeDocumentRecords,
    { appSlug: all ? undefined : auth.app.slug }
  );

  return jsonResponse({ documents });
});

/** GET /api/knowledge/gaps — List knowledge gaps */
export const listGaps = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const gaps = await ctx.runQuery(internal.knowledge.listUnresolvedKnowledgeGapRecords, {
    appSlug: all ? undefined : auth.app.slug,
  });

  return jsonResponse({ gaps });
});

/** GET /api/knowledge/metrics?since= — Get knowledge search quality metrics */
export const searchMetrics = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const since = url.searchParams.get("since");

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const metrics = await ctx.runQuery(internal.knowledge.getKnowledgeSearchMetricsRecord, {
    appSlug: auth.app.slug,
    since: since ? Number(since) : undefined,
  });

  return jsonResponse(metrics);
});

/** Upsert document in DB */
export const upsertKnowledgeDocumentRecord = internalMutation({
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
    const match = await ctx.db
      .query("knowledgeDocuments")
      .withIndex("by_app_title", (q) =>
        q.eq("appSlug", args.appSlug).eq("title", args.title)
      )
      .first();

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

/** Vector search query */
export const searchKnowledgeVectorRecords = internalQuery({
  args: {
    embedding: v.array(v.float64()),
    appSlug: v.string(),
    category: v.optional(v.string()),
    limit: v.float64(),
  },
  handler: async (ctx, args) => {
    const results = args.category
      ? await ctx.db
          .query("knowledgeDocuments")
          .withIndex("by_app_category", (q) =>
            q.eq("appSlug", args.appSlug).eq("category", args.category!)
          )
          .collect()
      : await ctx.db
          .query("knowledgeDocuments")
          .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
          .collect();

    const scored = results.map((document) => {
      const score = calculateCosineSimilarity(args.embedding, document.embedding);
      return { ...document, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, args.limit).map((document) => ({
      _id: String(document._id),
      title: document.title,
      content: document.content,
      category: document.category,
      sourceType: document.sourceType,
      score: document.score,
      updatedAt: document.lastUpdated,
    }));
  },
});

/** Keyword search query using BM25 scoring over knowledge documents. */
export const searchKnowledgeKeywordRecords = internalQuery({
  args: {
    query: v.string(),
    appSlug: v.string(),
    category: v.optional(v.string()),
    limit: v.float64(),
  },
  handler: async (ctx, args) => {
    const docs = args.category
      ? await ctx.db
          .query("knowledgeDocuments")
          .withIndex("by_app_category", (q) =>
            q.eq("appSlug", args.appSlug).eq("category", args.category!)
          )
          .take(MAX_BM25_DOCS)
      : await ctx.db
          .query("knowledgeDocuments")
          .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
          .take(MAX_BM25_DOCS);

    const ranked = rankByBm25(
      docs.map((doc) => ({
        _id: String(doc._id),
        title: doc.title,
        content: doc.content,
        updatedAt: doc.lastUpdated,
        category: doc.category,
        sourceType: doc.sourceType,
      })),
      args.query,
      args.limit,
    );

    return ranked.map((doc) => ({
      _id: doc._id,
      title: doc.title,
      content: doc.content,
      category: doc.category,
      sourceType: doc.sourceType,
      score: doc.score,
      updatedAt: doc.updatedAt,
    }));
  },
});

function calculateCosineSimilarity(a: number[], b: number[]): number {
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

/** Upsert transcript memory chunks (embedding-backed conversation memory). */
export const upsertTranscriptMemoryChunkRecords = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    chunks: v.array(
      v.object({
        chunkId: v.string(),
        title: v.string(),
        content: v.string(),
        roleSummary: v.optional(v.string()),
        channel: v.optional(v.string()),
        sourceTs: v.float64(),
        embedding: v.array(v.float64()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("transcriptMemories")
      .withIndex("by_app_session", (q) =>
        q.eq("appSlug", args.appSlug).eq("sessionId", args.sessionId)
      )
      .collect();

    const existingByChunk = new Map(existing.map((record) => [record.chunkId, record]));
    const keepChunkIds = new Set<string>();
    const now = Date.now();

    for (const chunk of args.chunks) {
      keepChunkIds.add(chunk.chunkId);
      const current = existingByChunk.get(chunk.chunkId);
      if (current) {
        await ctx.db.patch(current._id, {
          title: chunk.title,
          content: chunk.content,
          roleSummary: chunk.roleSummary,
          channel: chunk.channel,
          sourceTs: chunk.sourceTs,
          embedding: chunk.embedding,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("transcriptMemories", {
          appSlug: args.appSlug,
          sessionId: args.sessionId,
          chunkId: chunk.chunkId,
          title: chunk.title,
          content: chunk.content,
          roleSummary: chunk.roleSummary,
          channel: chunk.channel,
          sourceTs: chunk.sourceTs,
          embedding: chunk.embedding,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    for (const stale of existing) {
      if (!keepChunkIds.has(stale.chunkId)) {
        await ctx.db.delete(stale._id);
      }
    }
  },
});

/** Vector retrieval over transcript memory chunks. */
export const searchTranscriptMemoryVectorRecords = internalQuery({
  args: {
    embedding: v.array(v.float64()),
    appSlug: v.string(),
    limit: v.float64(),
  },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("transcriptMemories")
      .withIndex("by_app_sourceTs", (q) => q.eq("appSlug", args.appSlug))
      .order("desc")
      .take(MAX_BM25_DOCS);

    const scored = memories.map((memory) => ({
      _id: String(memory._id),
      title: memory.title,
      content: memory.content,
      category: "memory",
      sourceType: "transcript",
      sourceSessionId: memory.sessionId,
      score: calculateCosineSimilarity(args.embedding, memory.embedding),
      updatedAt: memory.updatedAt,
    }));

    scored.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
    return scored.slice(0, args.limit);
  },
});

/** Keyword retrieval over transcript memory chunks using BM25. */
export const searchTranscriptMemoryKeywordRecords = internalQuery({
  args: {
    query: v.string(),
    appSlug: v.string(),
    limit: v.float64(),
  },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("transcriptMemories")
      .withIndex("by_app_sourceTs", (q) => q.eq("appSlug", args.appSlug))
      .order("desc")
      .take(MAX_BM25_DOCS);
    const sessionById = new Map(memories.map((row) => [String(row._id), row.sessionId]));

    const ranked = rankByBm25(
      memories.map((memory) => ({
        _id: String(memory._id),
        title: memory.title,
        content: memory.content,
        updatedAt: memory.updatedAt,
      })),
      args.query,
      args.limit,
    );

    return ranked.map((memory) => ({
      _id: memory._id,
      title: memory.title,
      content: memory.content,
      category: "memory",
      sourceType: "transcript",
      score: memory.score,
      sourceSessionId: sessionById.get(memory._id),
      updatedAt: memory.updatedAt,
    }));
  },
});

/** Log a knowledge search with quality metrics */
export const logKnowledgeSearchRecord = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    query: v.string(),
    topScore: v.float64(),
    resultCount: v.float64(),
    gapDetected: v.boolean(),
    traceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("knowledgeSearches", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

/** Get aggregated search metrics for an app */
export const getKnowledgeSearchMetricsRecord = internalQuery({
  args: {
    appSlug: v.string(),
    since: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const since = args.since ?? 0;
    const searches = await ctx.db
      .query("knowledgeSearches")
      .withIndex("by_app_createdAt", (q) => {
        const q1 = q.eq("appSlug", args.appSlug);
        return since > 0 ? q1.gte("createdAt", since) : q1;
      })
      .collect();

    const totalSearches = searches.length;
    if (totalSearches === 0) {
      return { totalSearches: 0, avgTopScore: 0, gapRate: 0 };
    }

    const avgTopScore = searches.reduce((sum, search) => sum + search.topScore, 0) / totalSearches;
    const gapCount = searches.filter((search) => search.gapDetected).length;
    const gapRate = gapCount / totalSearches;

    return { totalSearches, avgTopScore, gapRate };
  },
});

/** Get knowledge threshold for an app (default 0.5) */
export const getAppKnowledgeThresholdRecord = internalQuery({
  args: { appSlug: v.string() },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .withIndex("by_slug", (q) => q.eq("slug", args.appSlug))
      .first();
    return (app?.knowledgeThreshold as number | undefined) ?? 0.5;
  },
});

/** Log a knowledge gap */
export const logKnowledgeGapRecord = internalMutation({
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

/** List all knowledge documents (without embeddings) */
export const listKnowledgeDocumentRecords = internalQuery({
  args: { appSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const docs = args.appSlug
      ? await ctx.db
          .query("knowledgeDocuments")
          .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!))
          .order("desc")
          .take(100)
      : await ctx.db.query("knowledgeDocuments").order("desc").take(100);
    return docs.map((doc) => {
      const { embedding, ...rest } = doc;
      void embedding;
      return rest;
    });
  },
});

/** Get unresolved knowledge gaps */
export const listUnresolvedKnowledgeGapRecords = internalQuery({
  args: { appSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.appSlug) {
      return await ctx.db
        .query("knowledgeGaps")
        .withIndex("by_app_resolved", (q) =>
          q.eq("appSlug", args.appSlug!).eq("resolved", false)
        )
        .order("desc")
        .take(100);
    }
    const all = await ctx.db.query("knowledgeGaps").order("desc").take(100);
    return all.filter((gap) => !gap.resolved);
  },
});
