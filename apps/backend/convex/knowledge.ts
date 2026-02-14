import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getTraceId, getFullAuthCredentials, corsHttpAction } from "./helpers";

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

/** POST /api/knowledge/search — Search knowledge base via vector similarity */
export const searchKnowledge = corsHttpAction(async (ctx, request) => {
  const traceId = getTraceId(request);
  const body = await request.json();
  const { query, category, topK, sessionId } = body as {
    query: string;
    category?: string;
    topK?: number;
    sessionId?: string;
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
      id: document._id,
      title: document.title,
      content: document.content,
      category: document.category,
      score: document.score,
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
