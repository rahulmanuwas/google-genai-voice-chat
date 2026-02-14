import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Insert a CSAT rating */
export const insertCsatRecord = internalMutation({
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
export const getInsightRecordByPeriod = internalQuery({
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
export const listRecentInsightRecords = internalQuery({
  args: { appSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.appSlug) {
      return await ctx.db
        .query("insights")
        .withIndex("by_app_period", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(30);
    }
    return await ctx.db.query("insights").order("desc").take(30);
  },
});

/** Compute live overview stats (optionally filtered by app and/or time window) */
export const computeOverviewRecord = internalQuery({
  args: {
    appSlug: v.optional(v.string()),
    since: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const since = args.since ?? 0;

    // If appSlug provided, use indexed queries; otherwise scan all
    let conversations;
    if (args.appSlug) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_app_startedAt", (q) => {
          const q1 = q.eq("appSlug", args.appSlug!);
          return since > 0 ? q1.gte("startedAt", since) : q1;
        })
        .collect();
    } else {
      const all = await ctx.db.query("conversations").collect();
      conversations = since > 0 ? all.filter((c) => c.startedAt >= since) : all;
    }

    let handoffs;
    if (args.appSlug) {
      handoffs = await ctx.db
        .query("handoffs")
        .withIndex("by_app_createdAt", (q) => {
          const q1 = q.eq("appSlug", args.appSlug!);
          return since > 0 ? q1.gte("createdAt", since) : q1;
        })
        .collect();
    } else {
      const all = await ctx.db.query("handoffs").collect();
      handoffs = since > 0 ? all.filter((h) => h.createdAt >= since) : all;
    }

    const csatRatings = args.appSlug
      ? await ctx.db.query("csatRatings").withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!)).collect()
      : await ctx.db.query("csatRatings").collect();

    const toolExecutions = args.appSlug
      ? await ctx.db.query("toolExecutions").withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!)).collect()
      : await ctx.db.query("toolExecutions").collect();

    const guardrailViolations = args.appSlug
      ? await ctx.db.query("guardrailViolations").withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!)).collect()
      : await ctx.db.query("guardrailViolations").collect();

    const knowledgeGaps = args.appSlug
      ? await ctx.db.query("knowledgeGaps").withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!)).collect()
      : await ctx.db.query("knowledgeGaps").collect();

    // Knowledge search quality metrics
    const knowledgeSearches = args.appSlug
      ? await ctx.db.query("knowledgeSearches").withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!)).collect()
      : await ctx.db.query("knowledgeSearches").collect();
    const filteredSearches = since > 0
      ? knowledgeSearches.filter((s) => s.createdAt >= since)
      : knowledgeSearches;

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
      // Knowledge search quality
      avgKnowledgeScore: filteredSearches.length > 0
        ? filteredSearches.reduce((s, r) => s + r.topScore, 0) / filteredSearches.length
        : null,
      knowledgeGapRate: filteredSearches.length > 0
        ? filteredSearches.filter((s) => s.gapDetected).length / filteredSearches.length
        : null,
      totalKnowledgeSearches: filteredSearches.length,
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
export const computeDailyInsightRecord = internalMutation({
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

    // Check if clustering already updated today's topTopics (within last hour)
    const existingInsight = await ctx.db
      .query("insights")
      .withIndex("by_app_period", (q) =>
        q.eq("appSlug", args.appSlug).eq("period", args.period)
      )
      .first();

    const ONE_HOUR = 3_600_000;
    const clusteringRecent = existingInsight
      && existingInsight.computedAt > Date.now() - ONE_HOUR
      && existingInsight.topTopics !== "[]";

    // Fall back to word-frequency extraction if clustering hasn't run recently
    let topTopics: Array<{ topic: string; count: number }>;
    if (clusteringRecent) {
      // Keep the cluster-generated topics
      try {
        topTopics = JSON.parse(existingInsight!.topTopics);
      } catch {
        topTopics = [];
      }
    } else {
      // Extract simple keyword-based topics from user messages
      const topicCounts: Record<string, number> = {};
      for (const conv of conversations) {
        if (!conv.transcript) continue;
        try {
          const messages = JSON.parse(conv.transcript) as Array<{ role?: string; content?: string }>;
          for (const msg of messages) {
            if (msg.role === "user" && msg.content) {
              const words = msg.content.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
              for (const word of words) {
                topicCounts[word] = (topicCounts[word] || 0) + 1;
              }
            }
          }
        } catch {
          // Skip malformed transcripts
        }
      }
      topTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }));
    }

    // Upsert insight (reuse existingInsight from above)
    const insight = {
      appSlug: args.appSlug,
      period: args.period,
      totalConversations: total,
      resolutionRate: total > 0 ? resolved / total : 0,
      handoffRate: total > 0 ? handoffs.length / total : 0,
      avgDurationMs,
      avgCSAT,
      topTopics: JSON.stringify(topTopics),
      knowledgeGaps: JSON.stringify(gapQueries),
      toolUsage: JSON.stringify(toolUsage),
      computedAt: Date.now(),
    };

    if (existingInsight) {
      await ctx.db.patch(existingInsight._id, insight);
    } else {
      await ctx.db.insert("insights", insight);
    }
  },
});
