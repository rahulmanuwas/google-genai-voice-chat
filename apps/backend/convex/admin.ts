import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const stats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const apps = await ctx.db.query("apps").collect();
    const conversations = await ctx.db.query("conversations").collect();
    const events = await ctx.db.query("events").collect();

    const eventsByApp: Record<string, number> = {};
    const eventsByType: Record<string, number> = {};
    for (const e of events) {
      eventsByApp[e.appSlug] = (eventsByApp[e.appSlug] || 0) + 1;
      eventsByType[e.eventType] = (eventsByType[e.eventType] || 0) + 1;
    }

    const convsByApp: Record<string, number> = {};
    for (const c of conversations) {
      convsByApp[c.appSlug] = (convsByApp[c.appSlug] || 0) + 1;
    }

    return {
      apps: apps.map((a) => ({ slug: a.slug, name: a.name, isActive: a.isActive })),
      totalConversations: conversations.length,
      conversationsByApp: convsByApp,
      recentConversations: conversations.slice(-10).map((c) => ({
        appSlug: c.appSlug,
        sessionId: c.sessionId.slice(0, 8),
        messageCount: c.messageCount,
        startedAt: new Date(c.startedAt).toISOString(),
        endedAt: c.endedAt ? new Date(c.endedAt).toISOString() : null,
      })),
      totalEvents: events.length,
      eventsByApp,
      eventsByType,
    };
  },
});

export const transcripts = internalQuery({
  args: { appSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let q = ctx.db.query("conversations");
    if (args.appSlug) {
      q = q.withIndex("by_app", (idx) => idx.eq("appSlug", args.appSlug!));
    }
    const conversations = await q.collect();

    return conversations.map((c) => ({
      appSlug: c.appSlug,
      sessionId: c.sessionId,
      messageCount: c.messageCount,
      startedAt: new Date(c.startedAt).toISOString(),
      endedAt: c.endedAt ? new Date(c.endedAt).toISOString() : null,
      messages: c.transcript ? JSON.parse(c.transcript) : [],
    }));
  },
});
