import { internalMutation, internalQuery } from "./_generated/server";
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
      // Don't regress terminal states (resolved/abandoned) back to active,
      // and don't overwrite handed_off with resolved (handoffs managed separately)
      const terminalStatuses = ['resolved', 'abandoned', 'handed_off'];
      const shouldUpdateStatus = args.status !== undefined
        && !(terminalStatuses.includes(existing.status ?? '') && args.status === 'active')
        && !(existing.status === 'handed_off' && args.status === 'resolved');

      await ctx.db.patch(existing._id, {
        endedAt: Date.now(),
        messageCount: args.messageCount,
        transcript: args.transcript,
        ...(shouldUpdateStatus && { status: args.status }),
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

/** Backfill transcripts from the messages table for conversations with empty transcripts */
export const backfillTranscripts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const conversations = await ctx.db.query("conversations").collect();
    let updated = 0;

    for (const conv of conversations) {
      // Skip if already has a real transcript (non-empty JSON array)
      if (conv.transcript) {
        try {
          const parsed = JSON.parse(conv.transcript);
          if (Array.isArray(parsed) && parsed.length > 0) continue;
        } catch {
          // Invalid JSON, overwrite it
        }
      }

      // Look up messages from the messages table
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_session", (q) => q.eq("sessionId", conv.sessionId))
        .collect();

      const finalMsgs = messages
        .filter((m) => m.isFinal && m.content)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((m) => ({ role: m.role, content: m.content, ts: m.createdAt }));

      if (finalMsgs.length > 0) {
        await ctx.db.patch(conv._id, {
          transcript: JSON.stringify(finalMsgs),
          messageCount: finalMsgs.length,
        });
        updated++;
      }
    }

    return { total: conversations.length, updated };
  },
});

/** List conversations (optionally filtered by app and/or status) */
export const listConversations = internalQuery({
  args: {
    appSlug: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.appSlug && args.status) {
      return await ctx.db
        .query("conversations")
        .withIndex("by_app_status", (q) =>
          q.eq("appSlug", args.appSlug!).eq("status", args.status!)
        )
        .order("desc")
        .take(100);
    }
    if (args.appSlug) {
      return await ctx.db
        .query("conversations")
        .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(100);
    }
    // Global: return all conversations
    const all = await ctx.db.query("conversations").order("desc").take(100);
    if (args.status) return all.filter((c) => c.status === args.status);
    return all;
  },
});
