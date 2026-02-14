import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest } from "./helpers";

/** POST /api/handoffs — Create a new handoff request */
export const createHandoff = httpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    appSlug,
    appSecret,
    sessionToken,
    sessionId,
    channel,
    reason,
    reasonDetail,
    priority,
    transcript,
    aiSummary,
    customerData,
  } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    sessionId: string;
    channel?: string;
    reason: string;
    reasonDetail?: string;
    priority?: string;
    transcript: Array<{ role: string; content: string; ts: number }>;
    aiSummary?: string;
    customerData?: Record<string, unknown>;
  };

  if (!sessionId || !reason || !transcript) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
  const { app } = auth;

  const handoffId = await ctx.runMutation(
    internal.handoffsDb.createHandoff,
    {
      appSlug: app.slug,
      sessionId,
      channel: channel ?? "web",
      reason,
      reasonDetail,
      priority: priority ?? "normal",
      transcript: JSON.stringify(transcript),
      aiSummary,
      customerData: customerData ? JSON.stringify(customerData) : undefined,
    }
  );

  // Update conversation status to "handed_off"
  await ctx.runMutation(internal.conversationsInternal.updateConversationStatus, {
    appSlug: app.slug,
    sessionId,
    status: "handed_off",
  });

  // If a webhook is configured, notify external system
  if (app.handoffWebhookUrl) {
    await ctx.runAction(internal.handoffsInternal.notifyWebhook, {
      webhookUrl: app.handoffWebhookUrl as string,
      handoffId,
      appSlug: app.slug,
      sessionId,
      reason,
      priority: priority ?? "normal",
    });
  }

  return jsonResponse({ id: handoffId });
});

/** PATCH /api/handoffs — Update handoff status (claim, resolve) with optional quality feedback */
export const updateHandoff = httpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    appSlug, appSecret, sessionToken,
    handoffId, status, assignedAgent,
    necessityScore, resolutionQuality, agentFeedback,
  } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    handoffId: string;
    status: string;
    assignedAgent?: string;
    necessityScore?: number;
    resolutionQuality?: string;
    agentFeedback?: string;
  };

  if (!handoffId || !status) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  await ctx.runMutation(internal.handoffsDb.updateHandoffStatus, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handoffId: handoffId as any,
    status,
    assignedAgent,
    necessityScore,
    resolutionQuality,
    agentFeedback,
  });

  return jsonResponse({ ok: true });
});

/** GET /api/handoffs — List handoffs (filtered by status) */
export const listHandoffs = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const all = url.searchParams.get("all") === "true";
  const filterApp = url.searchParams.get("appSlug") ?? undefined;

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const handoffs = await ctx.runQuery(
    internal.handoffsDb.listHandoffs,
    { appSlug: filterApp ?? (all ? undefined : auth.app.slug), status: status ?? undefined }
  );

  return jsonResponse({ handoffs });
});
