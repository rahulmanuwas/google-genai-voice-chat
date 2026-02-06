"use node";

import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";

/** Create a new handoff record */
export const createHandoff = internalMutation({
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

/** Update handoff status (claim or resolve) */
export const updateHandoffStatus = internalMutation({
  args: {
    handoffId: v.string(),
    status: v.string(),
    assignedAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const handoff = await ctx.db.get(args.handoffId as any);
    if (!handoff) throw new Error("Handoff not found");

    const updates: Record<string, unknown> = { status: args.status };

    if (args.status === "claimed") {
      updates.claimedAt = Date.now();
      if (args.assignedAgent) updates.assignedAgent = args.assignedAgent;
    } else if (args.status === "resolved") {
      updates.resolvedAt = Date.now();
    }

    await ctx.db.patch(handoff._id, updates);
  },
});

/** List handoffs with optional status filter */
export const listHandoffs = internalQuery({
  args: {
    appSlug: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("handoffs")
        .withIndex("by_app_status", (q) =>
          q.eq("appSlug", args.appSlug).eq("status", args.status!)
        )
        .order("desc")
        .take(50);
    }
    return await ctx.db
      .query("handoffs")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .order("desc")
      .take(50);
  },
});

/** Notify an external system about a new handoff via webhook */
export const notifyWebhook = internalAction({
  args: {
    webhookUrl: v.string(),
    handoffId: v.any(),
    appSlug: v.string(),
    sessionId: v.string(),
    reason: v.string(),
    priority: v.string(),
  },
  handler: async (_ctx, args) => {
    try {
      await fetch(args.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "handoff.created",
          handoffId: args.handoffId,
          appSlug: args.appSlug,
          sessionId: args.sessionId,
          reason: args.reason,
          priority: args.priority,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("Webhook notification failed:", err);
    }
  },
});
