import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest } from "./helpers";

/** POST /api/messages — Insert messages (batch) */
export const saveMessages = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionToken, messages } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
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

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
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
    })),
  });

  return jsonResponse({ ok: true, count: ids.length });
});

/** GET /api/messages?sessionId=...&appSlug=...&appSecret=...  or  ?sessionToken=... */
export const listMessages = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appSlug = url.searchParams.get("appSlug") ?? undefined;
  const appSecret = url.searchParams.get("appSecret") ?? undefined;
  const sessionToken = url.searchParams.get("sessionToken") ?? undefined;
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return jsonResponse({ error: "Missing sessionId" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const messages = await ctx.runQuery(internal.messagesDb.getAppSessionMessages, {
    appSlug: auth.app.slug,
    sessionId,
  });

  return jsonResponse({ messages });
});
