import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse } from "./helpers";

export const saveConversation = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionId, startedAt, messages } = body as {
    appSlug: string;
    appSecret: string;
    sessionId: string;
    startedAt: number;
    messages: Array<{ role: string; content: string; ts: number }>;
  };

  if (!appSlug || !appSecret || !sessionId) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, {
    slug: appSlug,
  });

  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  await ctx.runMutation(internal.conversationsInternal.upsertConversation, {
    appSlug,
    sessionId,
    startedAt: startedAt || Date.now(),
    messageCount: messages?.length ?? 0,
    transcript: messages ? JSON.stringify(messages) : undefined,
  });

  return jsonResponse({ ok: true });
});
