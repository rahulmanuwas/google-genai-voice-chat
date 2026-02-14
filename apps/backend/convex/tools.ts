import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

/** GET /api/tools?appSlug=...&appSecret=...  or  ?sessionToken=... — List active tools for an app */
export const listTools = corsHttpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const tools = await ctx.runQuery(internal.tools.getActiveToolDefinitionRecords, {
    appSlug: auth.app.slug,
  });

  return jsonResponse({ tools });
});

/** POST /api/tools/execute — Execute a tool call */
export const executeTool = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { sessionId, toolName, parameters, traceId, spanId } = body as {
    sessionId: string;
    toolName: string;
    parameters: Record<string, unknown>;
    traceId?: string;
    spanId?: string;
  };

  if (!sessionId || !toolName) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
  const { app } = auth;

  // Check per-turn action limits
  if (app.maxActionsPerTurn) {
    const recentCount = await ctx.runQuery(
      internal.tools.countRecentToolExecutionRecords,
      { appSlug: app.slug, sessionId, windowMs: 60_000 }
    );
    if (recentCount >= (app.maxActionsPerTurn as number)) {
      return jsonResponse({ error: "Max actions per turn exceeded" }, 429);
    }
  }

  const result = await ctx.runAction(internal.toolsInternal.executeToolAction, {
    appSlug: app.slug,
    sessionId,
    toolName,
    parameters: JSON.stringify(parameters),
    traceId,
    spanId,
  });

  return jsonResponse(result);
});

/** GET /api/tools/executions — List recent tool executions */
export const listExecutions = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const executions = await ctx.runQuery(
    internal.tools.listToolExecutionRecords,
    { appSlug: all ? undefined : auth.app.slug }
  );

  return jsonResponse({ executions });
});

/** GET /api/tools/all — List all tools (including inactive) for dashboard */
export const listAllTools = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const tools = await ctx.runQuery(
    internal.tools.listToolDefinitionRecords,
    { appSlug: all ? undefined : auth.app.slug }
  );

  return jsonResponse({ tools });
});

/** POST /api/tools — Register a new tool */
export const registerTool = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    name,
    description,
    parametersSchema,
    endpoint,
    headers,
    httpMethod,
    requiresConfirmation,
    requiresAuth,
  } = body as {
    name: string;
    description: string;
    parametersSchema: string;
    endpoint?: string;
    headers?: string;
    httpMethod?: string;
    requiresConfirmation?: boolean;
    requiresAuth?: boolean;
  };

  if (!name || !description || !parametersSchema) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  if (!endpoint) {
    return jsonResponse({ error: "Active tools must have an endpoint" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const toolId = await ctx.runMutation(internal.tools.upsertToolDefinitionRecord, {
    appSlug: auth.app.slug,
    name,
    description,
    parametersSchema,
    endpoint,
    headers,
    httpMethod: httpMethod ?? "POST",
    requiresConfirmation: requiresConfirmation ?? false,
    requiresAuth: requiresAuth ?? false,
  });

  return jsonResponse({ id: toolId });
});

/** Get all active tools for an app */
export const getActiveToolDefinitionRecords = internalQuery({
  args: { appSlug: v.string() },
  handler: async (ctx, args) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();
    return tools.filter((tool) => tool.isActive).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parametersSchema: tool.parametersSchema,
      requiresConfirmation: tool.requiresConfirmation,
      requiresAuth: tool.requiresAuth,
    }));
  },
});

/** Count recent tool executions in a time window (for rate limiting) */
export const countRecentToolExecutionRecords = internalQuery({
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
    return executions.filter((execution) => execution.executedAt > cutoff).length;
  },
});

/** Upsert a tool definition */
export const upsertToolDefinitionRecord = internalMutation({
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
export const logToolExecutionRecord = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    toolName: v.string(),
    parameters: v.string(),
    result: v.optional(v.string()),
    status: v.string(),
    executedAt: v.float64(),
    durationMs: v.float64(),
    traceId: v.optional(v.string()),
    spanId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("toolExecutions", args);
  },
});

/** List all tools (including inactive, for dashboard) */
export const listToolDefinitionRecords = internalQuery({
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
export const listToolExecutionRecords = internalQuery({
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
export const getToolDefinitionRecordByName = internalQuery({
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
