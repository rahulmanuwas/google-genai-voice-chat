import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getTraceId, getFullAuthCredentials, corsHttpAction } from "./helpers";

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

  const ids = await ctx.runMutation(internal.messagesDb.insertMessageBatch, {
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

  const messages = await ctx.runQuery(internal.messagesDb.getAppSessionMessages, {
    appSlug: auth.app.slug,
    sessionId,
  });

  return jsonResponse({ messages });
});
