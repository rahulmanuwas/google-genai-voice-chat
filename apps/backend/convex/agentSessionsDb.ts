/**
 * Agent session database functions (queries and mutations).
 * No "use node" — safe for Convex runtime.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Create a new agent session */
export const createAgentSession = mutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    runtime: v.string(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    branchId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    cwd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("agentSessions", {
      ...args,
      status: "active",
      runCount: 0,
      createdAt: Date.now(),
    });
  },
});

/** Get an agent session by sessionId */
export const getAgentSession = query({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, { appSlug, sessionId }) => {
    return ctx.db
      .query("agentSessions")
      .withIndex("by_appSlug_sessionId", (q) => q.eq("appSlug", appSlug).eq("sessionId", sessionId))
      .first();
  },
});

/** List agent sessions for an app */
export const listAgentSessions = query({
  args: {
    appSlug: v.string(),
    runtime: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, { appSlug, runtime, limit }) => {
    let q = ctx.db
      .query("agentSessions")
      .withIndex("by_appSlug", (q) => q.eq("appSlug", appSlug));

    const sessions = await q.collect();

    let filtered = sessions;
    if (runtime) {
      filtered = sessions.filter((s) => s.runtime === runtime);
    }

    const sorted = filtered.sort((a, b) => b.createdAt - a.createdAt);
    return sorted.slice(0, limit ?? 50);
  },
});

/** End an agent session */
export const endAgentSession = mutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, { appSlug, sessionId }) => {
    const session = await ctx.db
      .query("agentSessions")
      .withIndex("by_appSlug_sessionId", (q) => q.eq("appSlug", appSlug).eq("sessionId", sessionId))
      .first();

    if (!session) throw new Error(`Agent session not found: ${sessionId}`);

    await ctx.db.patch(session._id, {
      status: "ended",
      endedAt: Date.now(),
    });

    return session._id;
  },
});

/** Record metadata for a single agent run (one prompt execution). */
export const recordAgentSessionRun = mutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    runId: v.string(),
    runtime: v.string(),
    provider: v.string(),
    model: v.string(),
    status: v.string(),
    startedAt: v.float64(),
    endedAt: v.float64(),
    durationMs: v.float64(),
    attemptCount: v.float64(),
    fallbackCount: v.float64(),
    contextRecoveryCount: v.float64(),
    toolOutputTruncatedChars: v.float64(),
    promptChars: v.float64(),
    responseChars: v.float64(),
    authProfileId: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("agentSessions")
      .withIndex("by_appSlug_sessionId", (q) => q.eq("appSlug", args.appSlug).eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error(`Agent session not found: ${args.sessionId}`);
    }

    await ctx.db.insert("agentSessionRuns", args);

    await ctx.db.patch(session._id, {
      provider: args.provider,
      model: args.model,
      lastRunAt: args.endedAt,
      lastFailureReason: args.failureReason,
      runCount: (session.runCount ?? 0) + 1,
    });
  },
});

/** List recent run metadata for a session. */
export const listAgentSessionRuns = query({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, { appSlug, sessionId, limit }) => {
    const runs = await ctx.db
      .query("agentSessionRuns")
      .withIndex("by_app_session", (q) => q.eq("appSlug", appSlug).eq("sessionId", sessionId))
      .collect();

    return runs
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit ?? 50);
  },
});

/** Get available runtimes (static data, no DB needed) */
export const getAvailableRuntimes = query({
  args: {},
  handler: async () => {
    return [
      {
        id: "pi",
        name: "Pi",
        description: "22+ providers, extensions, thinking modes, coding tools",
        providers: ["google", "anthropic", "openai", "deepseek", "mistral", "xai", "groq"],
      },
    ];
  },
});
