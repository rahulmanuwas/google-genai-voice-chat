import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getTraceId, getFullAuthCredentials, corsHttpAction } from "./helpers";

export const logEvents = corsHttpAction(async (ctx, request) => {
  const traceId = getTraceId(request);
  const body = await request.json();
  const { sessionId, events } = body as {
    sessionId: string;
    events: Array<{ eventType: string; ts: number; data?: string }>;
  };

  if (!sessionId || !Array.isArray(events)) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const batch = events.slice(0, 100);
  await ctx.runMutation(internal.eventsInternal.insertEventBatch, {
    appSlug: auth.app.slug,
    sessionId,
    traceId,
    events: batch,
  });

  return jsonResponse({ inserted: batch.length });
});
