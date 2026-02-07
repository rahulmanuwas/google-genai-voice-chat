import { internalMutation, internalQuery } from "./_generated/server";
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
    handoffId: v.id("handoffs"),
    status: v.string(),
    assignedAgent: v.optional(v.string()),
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

    await ctx.db.patch(handoff._id, updates);
  },
});

/** List handoffs with optional app and status filter */
export const listHandoffs = internalQuery({
  args: {
    appSlug: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
    // Global: return all handoffs
    const all = await ctx.db.query("handoffs").order("desc").take(50);
    if (args.status) return all.filter((h) => h.status === args.status);
    return all;
  },
});
