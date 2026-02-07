import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertConversation = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    startedAt: v.float64(),
    messageCount: v.float64(),
    transcript: v.optional(v.string()),
    status: v.optional(v.string()),
    channel: v.optional(v.string()),
    resolution: v.optional(v.string()),
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
        ...(args.status !== undefined && { status: args.status }),
        ...(args.channel !== undefined && { channel: args.channel }),
        ...(args.resolution !== undefined && { resolution: args.resolution }),
      });
    } else {
      await ctx.db.insert("conversations", {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        startedAt: args.startedAt,
        endedAt: Date.now(),
        messageCount: args.messageCount,
        transcript: args.transcript,
        status: args.status ?? "active",
        channel: args.channel,
      });
    }
  },
});

/** Update just the status of a conversation (for lifecycle transitions) */
export const updateConversationStatus = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    status: v.string(),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_app_session", (q) =>
        q.eq("appSlug", args.appSlug).eq("sessionId", args.sessionId)
      )
      .first();

    if (!existing) return;

    const updates: Record<string, unknown> = { status: args.status };
    if (args.status === "resolved" || args.status === "abandoned") {
      updates.endedAt = Date.now();
    }
    if (args.resolution !== undefined) {
      updates.resolution = args.resolution;
    }

    await ctx.db.patch(existing._id, updates);
  },
});
