import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const insertEvent = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    eventType: v.string(),
    ts: v.float64(),
    data: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", args);
  },
});

export const insertEventBatch = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    events: v.array(
      v.object({
        eventType: v.string(),
        ts: v.float64(),
        data: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const event of args.events) {
      await ctx.db.insert("events", {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        eventType: event.eventType,
        ts: event.ts,
        data: event.data,
      });
    }
  },
});
