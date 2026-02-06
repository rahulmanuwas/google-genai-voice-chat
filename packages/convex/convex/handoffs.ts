import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse } from "./helpers";

/** POST /api/handoffs — Create a new handoff request */
export const createHandoff = httpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    appSlug,
    appSecret,
    sessionId,
    channel,
    reason,
    reasonDetail,
    priority,
    transcript,
    aiSummary,
    customerData,
  } = body as {
    appSlug: string;
    appSecret: string;
    sessionId: string;
    channel?: string;
    reason: string;
    reasonDetail?: string;
    priority?: string;
    transcript: Array<{ role: string; content: string; ts: number }>;
    aiSummary?: string;
    customerData?: Record<string, unknown>;
  };

  if (!appSlug || !appSecret || !sessionId || !reason || !transcript) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const handoffId = await ctx.runMutation(
    internal.handoffsInternal.createHandoff,
    {
      appSlug,
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

  // If a webhook is configured, notify external system
  if (app.handoffWebhookUrl) {
    await ctx.runAction(internal.handoffsInternal.notifyWebhook, {
      webhookUrl: app.handoffWebhookUrl,
      handoffId,
      appSlug,
      sessionId,
      reason,
      priority: priority ?? "normal",
    });
  }

  return jsonResponse({ id: handoffId });
});

/** PATCH /api/handoffs — Update handoff status (claim, resolve) */
export const updateHandoff = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, handoffId, status, assignedAgent } = body as {
    appSlug: string;
    appSecret: string;
    handoffId: string;
    status: string;
    assignedAgent?: string;
  };

  if (!appSlug || !appSecret || !handoffId || !status) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  await ctx.runMutation(internal.handoffsInternal.updateHandoffStatus, {
    handoffId,
    status,
    assignedAgent,
  });

  return jsonResponse({ ok: true });
});

/** GET /api/handoffs — List handoffs (filtered by status) */
export const listHandoffs = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appSlug = url.searchParams.get("appSlug");
  const appSecret = url.searchParams.get("appSecret");
  const status = url.searchParams.get("status");

  if (!appSlug || !appSecret) {
    return jsonResponse({ error: "Missing appSlug or appSecret" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const handoffs = await ctx.runQuery(
    internal.handoffsInternal.listHandoffs,
    { appSlug, status: status ?? undefined }
  );

  return jsonResponse({ handoffs });
});
