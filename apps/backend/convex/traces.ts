import { internal } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, corsHttpAction } from "./helpers";

interface TimelineEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

// GET /api/traces?traceId=...&sessionId=...
export const getTraceTimeline = corsHttpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const traceId = url.searchParams.get("traceId");
  const sessionId = url.searchParams.get("sessionId") ?? undefined;

  if (!traceId) {
    return jsonResponse({ error: "Missing required parameter: traceId" }, 400);
  }

  const raw = await ctx.runQuery(internal.traces.getTraceTimelineRecords, {
    traceId,
    sessionId,
    appSlug: auth.app.slug,
  });

  // Build unified chronological timeline
  const timeline: TimelineEvent[] = [];

  for (const e of raw.events) {
    timeline.push({
      type: "event",
      timestamp: e.ts,
      data: {
        id: e._id,
        eventType: e.eventType,
        sessionId: e.sessionId,
        data: safeParseJson(e.data),
      },
    });
  }

  for (const m of raw.messages) {
    timeline.push({
      type: "message",
      timestamp: m.createdAt,
      data: {
        id: m._id,
        role: m.role,
        content: m.content,
        participantIdentity: m.participantIdentity,
        language: m.language,
      },
    });
  }

  for (const t of raw.toolExecutions) {
    timeline.push({
      type: "tool_execution",
      timestamp: t.executedAt,
      data: {
        id: t._id,
        toolName: t.toolName,
        parameters: safeParseJson(t.parameters),
        result: safeParseJson(t.result),
        status: t.status,
        durationMs: t.durationMs,
        spanId: t.spanId,
      },
    });
  }

  for (const k of raw.knowledgeSearches) {
    timeline.push({
      type: "knowledge_search",
      timestamp: k.createdAt,
      data: {
        id: k._id,
        query: k.query,
        topScore: k.topScore,
        resultCount: k.resultCount,
        gapDetected: k.gapDetected,
      },
    });
  }

  for (const v of raw.guardrailViolations) {
    timeline.push({
      type: "guardrail_violation",
      timestamp: v.createdAt,
      data: {
        id: v._id,
        ruleId: v.ruleId,
        violationType: v.type,
        direction: v.direction,
        content: v.content,
        action: v.action,
      },
    });
  }

  for (const h of raw.handoffs) {
    timeline.push({
      type: "handoff",
      timestamp: h.createdAt,
      data: {
        id: h._id,
        reason: h.reason,
        status: h.status,
        priority: h.priority,
        assignedAgent: h.assignedAgent,
        claimedAt: h.claimedAt,
        resolvedAt: h.resolvedAt,
      },
    });
  }

  // Sort chronologically
  timeline.sort((a, b) => a.timestamp - b.timestamp);

  return jsonResponse({ traceId, timeline });
});

function safeParseJson(value: string | undefined | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Aggregate trace data across multiple tables using by_trace indexes.
 * Tables with by_trace: events, toolExecutions, messages, knowledgeSearches.
 * Tables without by_trace (queried by session): guardrailViolations, handoffs.
 */
export const getTraceTimelineRecords = internalQuery({
  args: {
    traceId: v.string(),
    sessionId: v.optional(v.string()),
    appSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { traceId, sessionId, appSlug } = args;

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

    let guardrailViolations: Array<{ appSlug?: string }> = [];
    let handoffs: Array<{ appSlug?: string }> = [];

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

    const filterByApp = <T extends { appSlug?: string }>(items: T[]) =>
      appSlug ? items.filter((item) => item.appSlug === appSlug) : items;

    return {
      events: filterByApp(events),
      toolExecutions: filterByApp(toolExecutions),
      messages: messages.filter((message) => message.isFinal),
      knowledgeSearches: filterByApp(knowledgeSearches),
      guardrailViolations: filterByApp(guardrailViolations),
      handoffs: filterByApp(handoffs),
    };
  },
});
