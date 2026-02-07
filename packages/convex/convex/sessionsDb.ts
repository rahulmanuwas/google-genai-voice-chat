import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Look up a session by token, return null if expired */
export const getSessionByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) return null;
    if (session.expiresAt < Date.now()) return null;

    return session;
  },
});

/** Create a new session token for an app */
export const createSession = internalMutation({
  args: {
    appSlug: v.string(),
    ttlMs: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ttl = args.ttlMs ?? 3_600_000; // Default 1 hour
    const token = crypto.randomUUID();

    await ctx.db.insert("sessions", {
      appSlug: args.appSlug,
      token,
      expiresAt: now + ttl,
      createdAt: now,
    });

    return { token, expiresAt: now + ttl };
  },
});
