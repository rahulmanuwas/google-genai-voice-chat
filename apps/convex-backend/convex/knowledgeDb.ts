import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

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
    // Check for existing doc with same title + app using dedicated index
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
export const vectorSearch = internalQuery({
  args: {
    embedding: v.array(v.float64()),
    appSlug: v.string(),
    category: v.optional(v.string()),
    limit: v.float64(),
  },
  handler: async (ctx, args) => {
    // Use category-filtered index when category is specified
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

/** Log a knowledge search with quality metrics */
export const logSearch = internalMutation({
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
export const getSearchMetrics = internalQuery({
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

    const avgTopScore = searches.reduce((s, r) => s + r.topScore, 0) / totalSearches;
    const gapCount = searches.filter((s) => s.gapDetected).length;
    const gapRate = gapCount / totalSearches;

    return { totalSearches, avgTopScore, gapRate };
  },
});

/** Get knowledge threshold for an app (default 0.5) */
export const getAppThreshold = internalQuery({
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

/** List all knowledge documents (without embeddings) */
export const listDocuments = internalQuery({
  args: { appSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const docs = args.appSlug
      ? await ctx.db
          .query("knowledgeDocuments")
          .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!))
          .order("desc")
          .take(100)
      : await ctx.db.query("knowledgeDocuments").order("desc").take(100);
    // Strip embeddings to keep response small
    return docs.map(({ embedding: _, ...rest }) => rest);
  },
});

/** Get unresolved knowledge gaps */
export const getUnresolvedGaps = internalQuery({
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
    return all.filter((g) => !g.resolved);
  },
});
