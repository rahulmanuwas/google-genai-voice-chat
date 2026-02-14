import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ─── Mutations ──────────────────────────────────────────────────

export const upsertAnnotation = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    conversationId: v.optional(v.string()),
    qualityRating: v.string(),
    failureModes: v.string(), // JSON string[]
    notes: v.string(),
    annotatedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for existing annotation by session + app
    const existing = await ctx.db
      .query("conversationAnnotations")
      .withIndex("by_app_createdAt", (q) => q.eq("appSlug", args.appSlug))
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        qualityRating: args.qualityRating,
        failureModes: args.failureModes,
        notes: args.notes,
        annotatedBy: args.annotatedBy,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("conversationAnnotations", {
      appSlug: args.appSlug,
      sessionId: args.sessionId,
      conversationId: args.conversationId as any,
      qualityRating: args.qualityRating,
      failureModes: args.failureModes,
      notes: args.notes,
      annotatedBy: args.annotatedBy,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ─── Queries ────────────────────────────────────────────────────

export const getBySession = internalQuery({
  args: { sessionId: v.string(), appSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.appSlug) {
      return await ctx.db
        .query("conversationAnnotations")
        .withIndex("by_app_createdAt", (q) => q.eq("appSlug", args.appSlug!))
        .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
        .first();
    }
    return await ctx.db
      .query("conversationAnnotations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

export const list = internalQuery({
  args: {
    appSlug: v.optional(v.string()),
    quality: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const lim = args.limit ?? 200;

    if (args.appSlug && args.quality) {
      const all = await ctx.db
        .query("conversationAnnotations")
        .withIndex("by_app_createdAt", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(lim);
      return all.filter((a) => a.qualityRating === args.quality);
    }

    if (args.quality) {
      return await ctx.db
        .query("conversationAnnotations")
        .withIndex("by_quality", (q) => q.eq("qualityRating", args.quality!))
        .order("desc")
        .take(lim);
    }

    if (args.appSlug) {
      return await ctx.db
        .query("conversationAnnotations")
        .withIndex("by_app_createdAt", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(lim);
    }

    return await ctx.db
      .query("conversationAnnotations")
      .order("desc")
      .take(lim);
  },
});
