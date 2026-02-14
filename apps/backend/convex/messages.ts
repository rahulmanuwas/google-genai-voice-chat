import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getTraceId, getFullAuthCredentials, corsHttpAction } from "./helpers";

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
  traceId: v.optional(v.string()),
};

/** POST /api/messages — Insert messages (batch) */
export const saveMessages = corsHttpAction(async (ctx, request) => {
  const traceId = getTraceId(request);
  const body = await request.json();
  const { messages } = body as {
    messages: Array<{
      sessionId: string;
      roomName?: string;
      participantIdentity: string;
      role: string;
      content: string;
      isFinal: boolean;
      language?: string;
      createdAt: number;
    }>;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: "Missing or empty messages array" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const ids = await ctx.runMutation(internal.messages.insertMessageBatchRecords, {
    messages: messages.map((m) => ({
      appSlug: auth.app.slug,
      sessionId: m.sessionId,
      roomName: m.roomName,
      participantIdentity: m.participantIdentity,
      role: m.role,
      content: m.content,
      isFinal: m.isFinal,
      language: m.language,
      createdAt: m.createdAt,
      traceId,
    })),
  });

  return jsonResponse({ ok: true, count: ids.length });
});

/** GET /api/messages?sessionId=... — Authorization: Bearer <token> */
export const listMessages = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return jsonResponse({ error: "Missing sessionId" }, 400);
  }

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const messages = await ctx.runQuery(internal.messages.getAppSessionMessageRecords, {
    appSlug: auth.app.slug,
    sessionId,
  });

  return jsonResponse({ messages });
});

/** Insert a single message */
export const insertMessageRecord = internalMutation({
  args: messageValidator,
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", args);
  },
});

/** Insert a batch of messages */
export const insertMessageBatchRecords = internalMutation({
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
export const getSessionMessageRecords = internalQuery({
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
export const getAppSessionMessageRecords = internalQuery({
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
