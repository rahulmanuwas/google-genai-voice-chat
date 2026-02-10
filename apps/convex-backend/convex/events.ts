import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getTraceId } from "./helpers";

export const logEvents = httpAction(async (ctx, request) => {
  const traceId = getTraceId(request);
  const body = await request.json();
  const { appSlug, appSecret, sessionToken, sessionId, events } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    sessionId: string;
    events: Array<{ eventType: string; ts: number; data?: string }>;
  };

  if (!sessionId || !Array.isArray(events)) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
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
