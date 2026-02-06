import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertConversation = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    startedAt: v.float64(),
    messageCount: v.float64(),
    transcript: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_app_session", (q) =>
        q.eq("appSlug", args.appSlug).eq("sessionId", args.sessionId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        endedAt: Date.now(),
        messageCount: args.messageCount,
        transcript: args.transcript,
      });
    } else {
      await ctx.db.insert("conversations", {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        startedAt: args.startedAt,
        endedAt: Date.now(),
        messageCount: args.messageCount,
        transcript: args.transcript,
      });
    }
  },
});
