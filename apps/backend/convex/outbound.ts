import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

const SUPPORTED_CHANNELS = new Set(["sms", "email", "push", "voice"]);

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getPathValue(source: Record<string, unknown>, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, path: string) => {
    const value = getPathValue(context, path);
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function sortedStringify(value: unknown): string {
  if (value === null || value === undefined || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(sortedStringify).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + sortedStringify((value as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}

function conditionsMatch(
  eventData: Record<string, unknown>,
  condition: Record<string, unknown>
): boolean {
  for (const [key, expected] of Object.entries(condition)) {
    const actual = getPathValue(eventData, key);
    if (Array.isArray(expected)) {
      if (!expected.some((item) => item === actual)) return false;
      continue;
    }
    if (expected && typeof expected === "object") {
      if (sortedStringify(expected) !== sortedStringify(actual)) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

/** POST /api/outbound/triggers — Create or update outbound trigger */
export const upsertOutboundTrigger = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    name,
    description,
    eventType,
    channel,
    condition,
    template,
    throttleMaxPerWindow,
    throttleWindowMs,
    isActive,
  } = body as {
    name: string;
    description?: string;
    eventType: string;
    channel: string;
    condition?: Record<string, unknown>;
    template: string;
    throttleMaxPerWindow?: number;
    throttleWindowMs?: number;
    isActive?: boolean;
  };

  if (!name || !eventType || !channel || !template) {
    return jsonResponse({ error: "name, eventType, channel, and template are required" }, 400);
  }

  const normalizedChannel = channel.toLowerCase();
  if (!SUPPORTED_CHANNELS.has(normalizedChannel)) {
    return jsonResponse({ error: "Unsupported channel" }, 400);
  }

  const maxPerWindow = Number(throttleMaxPerWindow ?? 1);
  const windowMs = Number(throttleWindowMs ?? 86_400_000);
  if (!Number.isFinite(maxPerWindow) || maxPerWindow <= 0) {
    return jsonResponse({ error: "throttleMaxPerWindow must be a positive number" }, 400);
  }
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    return jsonResponse({ error: "throttleWindowMs must be a positive number" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const triggerId = await ctx.runMutation(internal.outbound.upsertOutboundTriggerRecord, {
    appSlug: auth.app.slug,
    name: name.trim(),
    description: description?.trim() || undefined,
    eventType: eventType.trim(),
    channel: normalizedChannel,
    conditionJson: condition ? JSON.stringify(condition) : undefined,
    template,
    throttleMaxPerWindow: maxPerWindow,
    throttleWindowMs: windowMs,
    isActive: isActive ?? true,
  });

  return jsonResponse({ id: triggerId });
});

/** GET /api/outbound/triggers — List outbound triggers */
export const listOutboundTriggers = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";
  const active = url.searchParams.get("active");
  const eventType = url.searchParams.get("eventType") ?? undefined;

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const activeOnly = active === "true" ? true : active === "false" ? false : undefined;

  const triggers = await ctx.runQuery(internal.outbound.listOutboundTriggerRecords, {
    appSlug: all ? undefined : auth.app.slug,
    activeOnly,
    eventType,
  });

  return jsonResponse({
    triggers: triggers.map((trigger) => ({
      ...trigger,
      condition: parseJson<Record<string, unknown>>(trigger.conditionJson, {}),
    })),
  });
});

/** POST /api/outbound/dispatch — Evaluate and dispatch outbound triggers */
export const dispatchOutbound = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    eventType,
    recipient,
    eventData,
    channel,
    sessionId,
  } = body as {
    eventType: string;
    recipient: string;
    eventData?: Record<string, unknown>;
    channel?: string;
    sessionId?: string;
  };

  if (!eventType || !recipient) {
    return jsonResponse({ error: "eventType and recipient are required" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const normalizedChannel = channel ? channel.toLowerCase() : undefined;
  if (normalizedChannel && !SUPPORTED_CHANNELS.has(normalizedChannel)) {
    return jsonResponse({ error: "Unsupported channel" }, 400);
  }

  const payload = eventData ?? {};
  const triggers = await ctx.runQuery(internal.outbound.listActiveOutboundTriggerRecordsForEvent, {
    appSlug: auth.app.slug,
    eventType,
  });

  const sent: Array<{ triggerId: string; triggerName: string; dispatchId: string }> = [];
  const skipped: Array<{ triggerId: string; triggerName: string; reason: string; dispatchId: string }> = [];
  const triggersToTouch: Array<typeof triggers[number]["_id"]> = [];

  const basePayloadJson = JSON.stringify({ eventData: payload, sessionId });

  async function recordSkip(
    trigger: (typeof triggers)[number],
    reason: string,
  ) {
    const dispatchId = await ctx.runMutation(internal.outbound.createOutboundDispatchRecord, {
      appSlug: auth.app.slug,
      triggerId: trigger._id,
      triggerName: trigger.name,
      eventType: trigger.eventType,
      channel: trigger.channel,
      recipient,
      payload: basePayloadJson,
      status: "skipped",
      reason,
      sentAt: undefined,
    });
    skipped.push({
      triggerId: String(trigger._id),
      triggerName: trigger.name,
      reason,
      dispatchId: String(dispatchId),
    });
  }

  for (const trigger of triggers) {
    if (normalizedChannel && trigger.channel !== normalizedChannel) {
      await recordSkip(trigger, "channel_mismatch");
      continue;
    }

    const condition = parseJson<Record<string, unknown>>(trigger.conditionJson, {});
    if (!conditionsMatch(payload, condition)) {
      await recordSkip(trigger, "condition_mismatch");
      continue;
    }

    const since = Date.now() - trigger.throttleWindowMs;
    const recentCount = await ctx.runQuery(internal.outbound.countRecentOutboundDispatchRecords, {
      triggerId: trigger._id,
      recipient,
      since,
    });
    if (recentCount >= trigger.throttleMaxPerWindow) {
      await recordSkip(trigger, "throttled");
      continue;
    }

    const message = renderTemplate(trigger.template, payload);
    const dispatchId = await ctx.runMutation(internal.outbound.createOutboundDispatchRecord, {
      appSlug: auth.app.slug,
      triggerId: trigger._id,
      triggerName: trigger.name,
      eventType: trigger.eventType,
      channel: trigger.channel,
      recipient,
      payload: JSON.stringify({ eventData: payload, sessionId, message }),
      status: "sent",
      reason: undefined,
      sentAt: Date.now(),
    });

    triggersToTouch.push(trigger._id);
    sent.push({
      triggerId: String(trigger._id),
      triggerName: trigger.name,
      dispatchId: String(dispatchId),
    });
  }

  // Batch touch all fired triggers
  await Promise.all(
    triggersToTouch.map((triggerId) =>
      ctx.runMutation(internal.outbound.touchOutboundTriggerRecord, { triggerId })
    ),
  );

  return jsonResponse({
    eventType,
    recipient,
    processed: triggers.length,
    sent,
    skipped,
  });
});

/** GET /api/outbound/dispatches — List outbound dispatch logs */
export const listOutboundDispatches = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";
  const eventType = url.searchParams.get("eventType") ?? undefined;
  const limit = url.searchParams.get("limit");

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const dispatches = await ctx.runQuery(internal.outbound.listOutboundDispatchRecords, {
    appSlug: all ? undefined : auth.app.slug,
    eventType,
    limit: limit ? Number(limit) : undefined,
  });

  return jsonResponse({
    dispatches: dispatches.map((dispatch) => ({
      ...dispatch,
      payload: parseJson<Record<string, unknown>>(dispatch.payload, {}),
    })),
  });
});

/** Create or update an outbound trigger by app + name */
export const upsertOutboundTriggerRecord = internalMutation({
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
export const listOutboundTriggerRecords = internalQuery({
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
export const listActiveOutboundTriggerRecordsForEvent = internalQuery({
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
export const countRecentOutboundDispatchRecords = internalQuery({
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
export const createOutboundDispatchRecord = internalMutation({
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
export const touchOutboundTriggerRecord = internalMutation({
  args: { triggerId: v.id("outboundTriggers") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.triggerId, {
      lastTriggeredAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** List outbound dispatch logs */
export const listOutboundDispatchRecords = internalQuery({
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
