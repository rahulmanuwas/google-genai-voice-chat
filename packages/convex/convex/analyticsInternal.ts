import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Insert a CSAT rating */
export const insertCSAT = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    rating: v.float64(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("csatRatings", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

/** Get insight for a specific period */
export const getInsightByPeriod = internalQuery({
  args: { appSlug: v.string(), period: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("insights")
      .withIndex("by_app_period", (q) =>
        q.eq("appSlug", args.appSlug).eq("period", args.period)
      )
      .first();
  },
});

/** Get recent insights (last 30) */
export const getRecentInsights = internalQuery({
  args: { appSlug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("insights")
      .withIndex("by_app_period", (q) => q.eq("appSlug", args.appSlug))
      .order("desc")
      .take(30);
  },
});

/** Compute live overview stats for an app */
export const computeOverview = internalQuery({
  args: { appSlug: v.string() },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    const handoffs = await ctx.db
      .query("handoffs")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    const csatRatings = await ctx.db
      .query("csatRatings")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    const toolExecutions = await ctx.db
      .query("toolExecutions")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    const guardrailViolations = await ctx.db
      .query("guardrailViolations")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    const knowledgeGaps = await ctx.db
      .query("knowledgeGaps")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    // Compute metrics
    const totalConversations = conversations.length;
    const resolvedConversations = conversations.filter(
      (c) => c.status === "resolved"
    ).length;
    const resolutionRate =
      totalConversations > 0 ? resolvedConversations / totalConversations : 0;

    const handoffRate =
      totalConversations > 0 ? handoffs.length / totalConversations : 0;

    const avgCSAT =
      csatRatings.length > 0
        ? csatRatings.reduce((sum, r) => sum + r.rating, 0) / csatRatings.length
        : null;

    const avgDurationMs =
      conversations.length > 0
        ? conversations
            .filter((c) => c.endedAt)
            .reduce((sum, c) => sum + (c.endedAt! - c.startedAt), 0) /
          Math.max(
            conversations.filter((c) => c.endedAt).length,
            1
          )
        : 0;

    const toolSuccessRate =
      toolExecutions.length > 0
        ? toolExecutions.filter((e) => e.status === "success").length /
          toolExecutions.length
        : null;

    // Tool usage breakdown
    const toolUsage: Record<string, number> = {};
    for (const exec of toolExecutions) {
      toolUsage[exec.toolName] = (toolUsage[exec.toolName] || 0) + 1;
    }

    // Pending handoffs
    const pendingHandoffs = handoffs.filter((h) => h.status === "pending").length;

    // Unresolved knowledge gaps
    const unresolvedGaps = knowledgeGaps.filter((g) => !g.resolved).length;

    return {
      totalConversations,
      resolutionRate,
      handoffRate,
      avgCSAT,
      avgDurationMs,
      toolSuccessRate,
      toolUsage,
      totalToolExecutions: toolExecutions.length,
      totalGuardrailViolations: guardrailViolations.length,
      pendingHandoffs,
      unresolvedGaps,
      // Recent activity (last 24h)
      conversationsLast24h: conversations.filter(
        (c) => c.startedAt > Date.now() - 86_400_000
      ).length,
      handoffsLast24h: handoffs.filter(
        (h) => h.createdAt > Date.now() - 86_400_000
      ).length,
    };
  },
});

/** Compute and store daily insights (called by cron) */
export const computeDailyInsights = internalMutation({
  args: { appSlug: v.string(), period: v.string() },
  handler: async (ctx, args) => {
    // Fetch all data for the period
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    const handoffs = await ctx.db
      .query("handoffs")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    const ratings = await ctx.db
      .query("csatRatings")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    const toolExecs = await ctx.db
      .query("toolExecutions")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    const gaps = await ctx.db
      .query("knowledgeGaps")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    const total = conversations.length;
    const resolved = conversations.filter((c) => c.status === "resolved").length;
    const avgCSAT =
      ratings.length > 0
        ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
        : undefined;

    const durations = conversations
      .filter((c) => c.endedAt)
      .map((c) => c.endedAt! - c.startedAt);
    const avgDurationMs =
      durations.length > 0
        ? durations.reduce((s, d) => s + d, 0) / durations.length
        : 0;

    const toolUsage: Record<string, number> = {};
    for (const e of toolExecs) {
      toolUsage[e.toolName] = (toolUsage[e.toolName] || 0) + 1;
    }

    const gapQueries = gaps
      .filter((g) => !g.resolved)
      .slice(0, 20)
      .map((g) => g.query);

    // Upsert insight
    const existing = await ctx.db
      .query("insights")
      .withIndex("by_app_period", (q) =>
        q.eq("appSlug", args.appSlug).eq("period", args.period)
      )
      .first();

    const insight = {
      appSlug: args.appSlug,
      period: args.period,
      totalConversations: total,
      resolutionRate: total > 0 ? resolved / total : 0,
      handoffRate: total > 0 ? handoffs.length / total : 0,
      avgDurationMs,
      avgCSAT,
      topTopics: JSON.stringify([]),
      knowledgeGaps: JSON.stringify(gapQueries),
      toolUsage: JSON.stringify(toolUsage),
      computedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, insight);
    } else {
      await ctx.db.insert("insights", insight);
    }
  },
});
