import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Get recent conversations with transcripts for clustering */
export const getRecentConversationTranscriptRecords = internalQuery({
  args: {
    appSlug: v.string(),
    maxConversations: v.float64(),
  },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_app_startedAt", (q) => q.eq("appSlug", args.appSlug))
      .order("desc")
      .take(args.maxConversations);

    return conversations
      .filter((conversation) => conversation.transcript && conversation.transcript.length > 10)
      .map((conversation) => ({
        sessionId: conversation.sessionId,
        transcript: conversation.transcript!,
        startedAt: conversation.startedAt,
      }));
  },
});

/** Update today's insight record with clustered topics */
export const updateTopTopicsRecord = internalMutation({
  args: {
    appSlug: v.string(),
    period: v.string(),
    topTopics: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("insights")
      .withIndex("by_app_period", (q) =>
        q.eq("appSlug", args.appSlug).eq("period", args.period)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        topTopics: args.topTopics,
        computedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("insights", {
        appSlug: args.appSlug,
        period: args.period,
        totalConversations: 0,
        resolutionRate: 0,
        handoffRate: 0,
        avgDurationMs: 0,
        topTopics: args.topTopics,
        knowledgeGaps: "[]",
        toolUsage: "{}",
        computedAt: Date.now(),
      });
    }
  },
});
