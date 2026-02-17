import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

/** POST /api/handoffs — Create a new handoff request */
export const createHandoff = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    sessionId,
    channel,
    reason,
    reasonDetail,
    priority,
    transcript,
    aiSummary,
    customerData,
  } = body as {
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

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
  const { app } = auth;

  const handoffId = await ctx.runMutation(
    internal.handoffs.createHandoffRecord,
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
  await ctx.runMutation(internal.conversationsInternal.updateConversationStatusRecord, {
    appSlug: app.slug,
    sessionId,
    status: "handed_off",
  });

  // If a webhook is configured, notify external system
  if (app.handoffWebhookUrl) {
    await ctx.runAction(internal.handoffsInternal.notifyWebhookAction, {
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
export const updateHandoff = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    handoffId, status, assignedAgent,
    necessityScore, resolutionQuality, agentFeedback,
  } = body as {
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

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
  const handoffRecordId = handoffId as Id<"handoffs">;

  await ctx.runMutation(internal.handoffs.updateHandoffStatusRecord, {
    handoffId: handoffRecordId,
    status,
    assignedAgent,
    necessityScore,
    resolutionQuality,
    agentFeedback,
  });

  return jsonResponse({ ok: true });
});

/** GET /api/handoffs — List handoffs (filtered by status) */
export const listHandoffs = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const all = url.searchParams.get("all") === "true";
  const filterApp = url.searchParams.get("appSlug") ?? undefined;
  const sessionId = url.searchParams.get("sessionId") ?? undefined;

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const handoffs = await ctx.runQuery(
    internal.handoffs.listHandoffRecords,
    {
      appSlug: filterApp ?? (all ? undefined : auth.app.slug),
      status: status ?? undefined,
      sessionId,
    }
  );

  return jsonResponse({ handoffs });
});

/** Create a new handoff record */
export const createHandoffRecord = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    channel: v.string(),
    reason: v.string(),
    reasonDetail: v.optional(v.string()),
    priority: v.string(),
    transcript: v.string(),
    aiSummary: v.optional(v.string()),
    customerData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("handoffs", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

/** Update handoff status (claim or resolve) with optional quality feedback */
export const updateHandoffStatusRecord = internalMutation({
  args: {
    handoffId: v.id("handoffs"),
    status: v.string(),
    assignedAgent: v.optional(v.string()),
    necessityScore: v.optional(v.float64()),
    resolutionQuality: v.optional(v.string()),
    agentFeedback: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const handoff = await ctx.db.get(args.handoffId);
    if (!handoff) throw new Error("Handoff not found");

    const updates: Record<string, unknown> = { status: args.status };

    if (args.status === "claimed") {
      updates.claimedAt = Date.now();
      if (args.assignedAgent) updates.assignedAgent = args.assignedAgent;
    } else if (args.status === "resolved") {
      updates.resolvedAt = Date.now();
    }

    if (args.necessityScore !== undefined) updates.necessityScore = args.necessityScore;
    if (args.resolutionQuality) updates.resolutionQuality = args.resolutionQuality;
    if (args.agentFeedback) updates.agentFeedback = args.agentFeedback;

    await ctx.db.patch(handoff._id, updates);
  },
});

/** List handoffs with optional app and status filter */
export const listHandoffRecords = internalQuery({
  args: {
    appSlug: v.optional(v.string()),
    status: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sessionId) {
      const bySession = await ctx.db
        .query("handoffs")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId!))
        .collect();

      const filtered = bySession.filter((handoff) => {
        if (args.appSlug && handoff.appSlug !== args.appSlug) return false;
        if (args.status && handoff.status !== args.status) return false;
        return true;
      });

      return filtered.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
    }

    if (args.appSlug && args.status) {
      return await ctx.db
        .query("handoffs")
        .withIndex("by_app_status", (q) =>
          q.eq("appSlug", args.appSlug!).eq("status", args.status!)
        )
        .order("desc")
        .take(50);
    }
    if (args.appSlug) {
      return await ctx.db
        .query("handoffs")
        .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(50);
    }
    const all = await ctx.db.query("handoffs").order("desc").take(50);
    if (args.status) return all.filter((handoff) => handoff.status === args.status);
    return all;
  },
});
