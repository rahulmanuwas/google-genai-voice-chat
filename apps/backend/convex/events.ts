import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
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
  await ctx.runMutation(internal.events.insertEventBatchRecords, {
    appSlug: auth.app.slug,
    sessionId,
    traceId,
    events: batch,
  });

  return jsonResponse({ inserted: batch.length });
});

export const insertEventRecord = internalMutation({
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

export const insertEventBatchRecords = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    traceId: v.optional(v.string()),
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
        traceId: args.traceId,
      });
    }
  },
});

export const getAppSessionEventRecords = internalQuery({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("events")
      .withIndex("by_app_session", (q) =>
        q.eq("appSlug", args.appSlug).eq("sessionId", args.sessionId)
      )
      .order("desc");

    if (args.limit !== undefined) {
      return await query.take(args.limit);
    }
    return await query.collect();
  },
});
