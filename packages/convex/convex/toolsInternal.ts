"use node";

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
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

/** Execute a tool by calling its registered endpoint */
export const executeToolAction = internalAction({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    toolName: v.string(),
    parameters: v.string(),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();

    // Look up the tool
    const tools = await ctx.runQuery(internal.toolsInternal.getActiveTools, {
      appSlug: args.appSlug,
    });
    const tool = tools.find((t: { name: string }) => t.name === args.toolName);

    if (!tool) {
      const result = { success: false, error: `Tool "${args.toolName}" not found` };
      await ctx.runMutation(internal.toolsInternal.logExecution, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        toolName: args.toolName,
        parameters: args.parameters,
        result: JSON.stringify(result),
        status: "error",
        executedAt: startedAt,
        durationMs: Date.now() - startedAt,
      });
      return result;
    }

    // Look up the full tool record (with endpoint) from DB
    const fullTool = await ctx.runQuery(internal.toolsInternal.getToolByName, {
      appSlug: args.appSlug,
      name: args.toolName,
    });

    if (!fullTool?.endpoint) {
      const result = { success: false, error: `Tool "${args.toolName}" has no endpoint configured` };
      await ctx.runMutation(internal.toolsInternal.logExecution, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        toolName: args.toolName,
        parameters: args.parameters,
        result: JSON.stringify(result),
        status: "error",
        executedAt: startedAt,
        durationMs: Date.now() - startedAt,
      });
      return result;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (fullTool.headers) {
        Object.assign(headers, JSON.parse(fullTool.headers));
      }

      const response = await fetch(fullTool.endpoint, {
        method: fullTool.httpMethod || "POST",
        headers,
        body: args.parameters,
      });

      const data = await response.json();
      const result = { success: response.ok, data };

      await ctx.runMutation(internal.toolsInternal.logExecution, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        toolName: args.toolName,
        parameters: args.parameters,
        result: JSON.stringify(result),
        status: response.ok ? "success" : "error",
        executedAt: startedAt,
        durationMs: Date.now() - startedAt,
      });

      return result;
    } catch (err) {
      const result = {
        success: false,
        error: (err as Error).message,
      };

      await ctx.runMutation(internal.toolsInternal.logExecution, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        toolName: args.toolName,
        parameters: args.parameters,
        result: JSON.stringify(result),
        status: "error",
        executedAt: startedAt,
        durationMs: Date.now() - startedAt,
      });

      return result;
    }
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
