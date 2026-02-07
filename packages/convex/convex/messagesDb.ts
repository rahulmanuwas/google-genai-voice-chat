import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const messageValidator = {
  appSlug: v.string(),
  sessionId: v.string(),
  roomName: v.optional(v.string()),
  participantIdentity: v.string(),
  role: v.string(),
  content: v.string(),
  isFinal: v.boolean(),
  language: v.optional(v.string()),
  createdAt: v.float64(),
};

/** Insert a single message */
export const insertMessage = internalMutation({
  args: messageValidator,
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", args);
  },
});

/** Insert a batch of messages */
export const insertMessageBatch = internalMutation({
  args: {
    messages: v.array(v.object(messageValidator)),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const msg of args.messages) {
      const id = await ctx.db.insert("messages", msg);
      ids.push(id);
    }
    return ids;
  },
});

/** Get messages for a session */
export const getSessionMessages = internalQuery({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc");

    if (args.limit) {
      return await query.take(args.limit);
    }
    return await query.collect();
  },
});

/** Get messages for a session scoped to an app */
export const getAppSessionMessages = internalQuery({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_app_session", (q) =>
        q.eq("appSlug", args.appSlug).eq("sessionId", args.sessionId)
      )
      .order("asc")
      .collect();
  },
});
