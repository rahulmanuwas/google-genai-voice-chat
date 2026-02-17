import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

export const saveConversation = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    sessionId,
    startedAt,
    messages,
    status,
    channel,
    resolution,
  } = body as {
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

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  await ctx.runMutation(internal.conversationsInternal.upsertConversationRecord, {
    appSlug: auth.app.slug,
    sessionId,
    startedAt: startedAt || Date.now(),
    messageCount: messages?.length ?? 0,
    transcript: messages ? JSON.stringify(messages) : undefined,
    status,
    channel,
    resolution,
  });

  const shouldIndexTranscript =
    status === "resolved"
    || status === "abandoned"
    || resolution !== undefined;

  if (shouldIndexTranscript && Array.isArray(messages) && messages.length > 0) {
    try {
      await ctx.runAction(internal.knowledgeInternal.indexSessionTranscriptAction, {
        appSlug: auth.app.slug,
        sessionId,
        channel,
        messages: messages
          .filter((message) => typeof message.content === "string" && message.content.trim().length > 0)
          .slice(-120)
          .map((message) => ({
            role: message.role,
            content: message.content,
            ts: message.ts ?? Date.now(),
          })),
      });
    } catch (err) {
      console.warn("[conversations] Failed to index transcript memory:", err);
    }
  }

  return jsonResponse({ ok: true });
});

/** GET /api/conversations — List conversations */
export const listConversations = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const all = url.searchParams.get("all") === "true";
  const filterApp = url.searchParams.get("appSlug") ?? undefined;

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const conversations = await ctx.runQuery(
    internal.conversationsInternal.listConversationRecords,
    { appSlug: filterApp ?? (all ? undefined : auth.app.slug), status }
  );

  return jsonResponse({ conversations });
});
