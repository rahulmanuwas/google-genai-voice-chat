import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Aggregate trace data across multiple tables using by_trace indexes.
 * Tables with by_trace: events, toolExecutions, messages, knowledgeSearches
 * Tables without by_trace (queried by session): guardrailViolations, handoffs
 */
export const getTimeline = internalQuery({
  args: {
    traceId: v.string(),
    sessionId: v.optional(v.string()),
    appSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { traceId, sessionId, appSlug } = args;

    // Tables with by_trace index
    const [events, toolExecutions, messages, knowledgeSearches] = await Promise.all([
      ctx.db
        .query("events")
        .withIndex("by_trace", (q) => q.eq("traceId", traceId))
        .collect(),
      ctx.db
        .query("toolExecutions")
        .withIndex("by_trace", (q) => q.eq("traceId", traceId))
        .collect(),
      ctx.db
        .query("messages")
        .withIndex("by_trace", (q) => q.eq("traceId", traceId))
        .collect(),
      ctx.db
        .query("knowledgeSearches")
        .withIndex("by_trace", (q) => q.eq("traceId", traceId))
        .collect(),
    ]);

    // Tables without by_trace — query by sessionId if available
    let guardrailViolations: any[] = [];
    let handoffs: any[] = [];

    if (sessionId) {
      [guardrailViolations, handoffs] = await Promise.all([
        ctx.db
          .query("guardrailViolations")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .collect(),
        ctx.db
          .query("handoffs")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .collect(),
      ]);
    }

    // App-scope filter: if appSlug is provided, only return data belonging to this app
    const filterByApp = <T extends { appSlug?: string }>(items: T[]) =>
      appSlug ? items.filter((item) => item.appSlug === appSlug) : items;

    return {
      events: filterByApp(events),
      toolExecutions: filterByApp(toolExecutions),
      messages: messages.filter((m) => m.isFinal),
      knowledgeSearches: filterByApp(knowledgeSearches as any[]),
      guardrailViolations: filterByApp(guardrailViolations),
      handoffs: filterByApp(handoffs),
    };
  },
});
