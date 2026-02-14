import { internal } from "./_generated/api";
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

  const raw = await ctx.runQuery(internal.tracesDb.getTimeline, {
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
