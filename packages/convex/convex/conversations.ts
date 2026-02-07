import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest } from "./helpers";

export const saveConversation = httpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    appSlug,
    appSecret,
    sessionToken,
    sessionId,
    startedAt,
    messages,
    status,
    channel,
    resolution,
  } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    sessionId: string;
    startedAt: number;
    messages: Array<{ role: string; content: string; ts: number }>;
    status?: string;
    channel?: string;
    resolution?: string;
  };

  if (!sessionId) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  await ctx.runMutation(internal.conversationsInternal.upsertConversation, {
    appSlug: auth.app.slug,
    sessionId,
    startedAt: startedAt || Date.now(),
    messageCount: messages?.length ?? 0,
    transcript: messages ? JSON.stringify(messages) : undefined,
    status,
    channel,
    resolution,
  });

  return jsonResponse({ ok: true });
});
