import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Get all active tools for an app */
export const getActiveTools = internalQuery({
  args: { appSlug: v.string() },
  handler: async (ctx, args) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();
    return tools.filter((t) => t.isActive).map((t) => ({
      name: t.name,
      description: t.description,
      parametersSchema: t.parametersSchema,
      requiresConfirmation: t.requiresConfirmation,
      requiresAuth: t.requiresAuth,
    }));
  },
});

/** Count recent tool executions in a time window (for rate limiting) */
export const countRecentExecutions = internalQuery({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    windowMs: v.float64(),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.windowMs;
    const executions = await ctx.db
      .query("toolExecutions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return executions.filter((e) => e.executedAt > cutoff).length;
  },
});

/** Upsert a tool definition */
export const upsertTool = internalMutation({
  args: {
    appSlug: v.string(),
    name: v.string(),
    description: v.string(),
    parametersSchema: v.string(),
    endpoint: v.optional(v.string()),
    headers: v.optional(v.string()),
    httpMethod: v.string(),
    requiresConfirmation: v.boolean(),
    requiresAuth: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tools")
      .withIndex("by_app_name", (q) =>
        q.eq("appSlug", args.appSlug).eq("name", args.name)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        description: args.description,
        parametersSchema: args.parametersSchema,
        endpoint: args.endpoint,
        headers: args.headers,
        httpMethod: args.httpMethod,
        requiresConfirmation: args.requiresConfirmation,
        requiresAuth: args.requiresAuth,
        isActive: true,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("tools", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Log a tool execution result */
export const logExecution = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    toolName: v.string(),
    parameters: v.string(),
    result: v.optional(v.string()),
    status: v.string(),
    executedAt: v.float64(),
    durationMs: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("toolExecutions", args);
  },
});

/** List all tools (including inactive, for dashboard) */
export const listAllTools = internalQuery({
  args: { appSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.appSlug) {
      return await ctx.db
        .query("tools")
        .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!))
        .collect();
    }
    return await ctx.db.query("tools").collect();
  },
});

/** List recent tool executions */
export const listExecutions = internalQuery({
  args: { appSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.appSlug) {
      return await ctx.db
        .query("toolExecutions")
        .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(100);
    }
    return await ctx.db.query("toolExecutions").order("desc").take(100);
  },
});

/** Get full tool record by name (includes endpoint) */
export const getToolByName = internalQuery({
  args: { appSlug: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tools")
      .withIndex("by_app_name", (q) =>
        q.eq("appSlug", args.appSlug).eq("name", args.name)
      )
      .first();
  },
});
