import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Create or update an outbound trigger by app + name */
export const upsertTrigger = internalMutation({
  args: {
    appSlug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    eventType: v.string(),
    channel: v.string(),
    conditionJson: v.optional(v.string()),
    template: v.string(),
    throttleMaxPerWindow: v.float64(),
    throttleWindowMs: v.float64(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("outboundTriggers")
      .withIndex("by_app_name", (q) =>
        q.eq("appSlug", args.appSlug).eq("name", args.name)
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        description: args.description,
        eventType: args.eventType,
        channel: args.channel,
        conditionJson: args.conditionJson,
        template: args.template,
        throttleMaxPerWindow: args.throttleMaxPerWindow,
        throttleWindowMs: args.throttleWindowMs,
        isActive: args.isActive,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("outboundTriggers", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** List outbound triggers */
export const listTriggers = internalQuery({
  args: {
    appSlug: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
    eventType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.appSlug && args.eventType) {
      const byEvent = await ctx.db
        .query("outboundTriggers")
        .withIndex("by_app_eventType", (q) =>
          q.eq("appSlug", args.appSlug!).eq("eventType", args.eventType!)
        )
        .order("desc")
        .take(100);
      if (args.activeOnly === undefined) return byEvent;
      return byEvent.filter((trigger) => trigger.isActive === args.activeOnly);
    }

    if (args.appSlug && args.activeOnly !== undefined) {
      return await ctx.db
        .query("outboundTriggers")
        .withIndex("by_app_active", (q) =>
          q.eq("appSlug", args.appSlug!).eq("isActive", args.activeOnly!)
        )
        .order("desc")
        .take(100);
    }

    if (args.appSlug) {
      const byApp = await ctx.db
        .query("outboundTriggers")
        .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(100);
      if (args.eventType) {
        return byApp.filter((trigger) => trigger.eventType === args.eventType);
      }
      return byApp;
    }

    const all = await ctx.db.query("outboundTriggers").order("desc").take(200);
    return all.filter((trigger) => {
      if (args.activeOnly !== undefined && trigger.isActive !== args.activeOnly) return false;
      if (args.eventType && trigger.eventType !== args.eventType) return false;
      return true;
    });
  },
});

/** Get active triggers for a specific app/event */
export const listActiveTriggersForEvent = internalQuery({
  args: {
    appSlug: v.string(),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    const triggers = await ctx.db
      .query("outboundTriggers")
      .withIndex("by_app_eventType", (q) =>
        q.eq("appSlug", args.appSlug).eq("eventType", args.eventType)
      )
      .collect();

    return triggers.filter((trigger) => trigger.isActive);
  },
});

/** Count recent successful dispatches for trigger+recipient within a time window */
export const countRecentDispatches = internalQuery({
  args: {
    triggerId: v.id("outboundTriggers"),
    recipient: v.string(),
    since: v.float64(),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("outboundDispatches")
      .withIndex("by_trigger_recipient_createdAt", (q) =>
        q
          .eq("triggerId", args.triggerId)
          .eq("recipient", args.recipient)
          .gte("createdAt", args.since)
      )
      .collect();

    return items.filter((dispatch) => dispatch.status === "sent").length;
  },
});

/** Insert outbound dispatch audit row */
export const createDispatch = internalMutation({
  args: {
    appSlug: v.string(),
    triggerId: v.id("outboundTriggers"),
    triggerName: v.string(),
    eventType: v.string(),
    channel: v.string(),
    recipient: v.string(),
    payload: v.string(),
    status: v.string(),
    reason: v.optional(v.string()),
    sentAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outboundDispatches", {
      appSlug: args.appSlug,
      triggerId: args.triggerId,
      triggerName: args.triggerName,
      eventType: args.eventType,
      channel: args.channel,
      recipient: args.recipient,
      payload: args.payload,
      status: args.status,
      reason: args.reason,
      createdAt: Date.now(),
      sentAt: args.sentAt,
    });
  },
});

/** Mark trigger's last-fired timestamp */
export const touchTrigger = internalMutation({
  args: { triggerId: v.id("outboundTriggers") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.triggerId, {
      lastTriggeredAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** List outbound dispatch logs */
export const listDispatches = internalQuery({
  args: {
    appSlug: v.optional(v.string()),
    eventType: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    if (args.appSlug) {
      const byApp = await ctx.db
        .query("outboundDispatches")
        .withIndex("by_app_createdAt", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(limit);

      if (args.eventType) {
        return byApp.filter((dispatch) => dispatch.eventType === args.eventType);
      }
      return byApp;
    }

    const all = await ctx.db.query("outboundDispatches").order("desc").take(limit);
    if (args.eventType) {
      return all.filter((dispatch) => dispatch.eventType === args.eventType);
    }
    return all;
  },
});
