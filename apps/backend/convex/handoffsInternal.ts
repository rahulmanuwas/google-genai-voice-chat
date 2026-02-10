"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/** Notify an external system about a new handoff via webhook */
export const notifyWebhook = internalAction({
  args: {
    webhookUrl: v.string(),
    handoffId: v.string(),
    appSlug: v.string(),
    sessionId: v.string(),
    reason: v.string(),
    priority: v.string(),
  },
  handler: async (_ctx, args) => {
    try {
      const response = await fetch(args.webhookUrl, {
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
      if (!response.ok) {
        console.error(
          `Webhook notification failed (${response.status}): ${args.webhookUrl}`
        );
      }
    } catch (err) {
      console.error(
        "Webhook notification failed:",
        err instanceof Error ? err.message : String(err)
      );
    }
  },
});
