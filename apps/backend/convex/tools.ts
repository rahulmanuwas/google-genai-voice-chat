import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

/** GET /api/tools?appSlug=...&appSecret=...  or  ?sessionToken=... — List active tools for an app */
export const listTools = corsHttpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const tools = await ctx.runQuery(internal.toolsDb.getActiveTools, {
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
      internal.toolsDb.countRecentExecutions,
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
    internal.toolsDb.listExecutions,
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
    internal.toolsDb.listAllTools,
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

  const toolId = await ctx.runMutation(internal.toolsDb.upsertTool, {
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
