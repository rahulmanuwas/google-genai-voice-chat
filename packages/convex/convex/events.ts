import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse } from "./helpers";

export const logEvents = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionId, events } = body as {
    appSlug: string;
    appSecret: string;
    sessionId: string;
    events: Array<{ eventType: string; ts: number; data?: string }>;
  };

  if (!appSlug || !appSecret || !sessionId || !Array.isArray(events)) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, {
    slug: appSlug,
  });

  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const batch = events.slice(0, 100);
  await ctx.runMutation(internal.eventsInternal.insertEventBatch, {
    appSlug,
    sessionId,
    events: batch,
  });

  return jsonResponse({ inserted: batch.length });
});
