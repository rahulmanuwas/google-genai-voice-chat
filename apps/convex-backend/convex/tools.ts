import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest } from "./helpers";

/** GET /api/tools?appSlug=...&appSecret=...  or  ?sessionToken=... — List active tools for an app */
export const listTools = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appSlug = url.searchParams.get("appSlug") ?? undefined;
  const appSecret = url.searchParams.get("appSecret") ?? undefined;
  const sessionToken = url.searchParams.get("sessionToken") ?? undefined;

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const tools = await ctx.runQuery(internal.toolsDb.getActiveTools, {
    appSlug: auth.app.slug,
  });

  return jsonResponse({ tools });
});

/** POST /api/tools/execute — Execute a tool call */
export const executeTool = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionToken, sessionId, toolName, parameters } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    sessionId: string;
    toolName: string;
    parameters: Record<string, unknown>;
  };

  if (!sessionId || !toolName) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
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
  });

  return jsonResponse(result);
});

/** POST /api/tools — Register a new tool */
export const registerTool = httpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    appSlug,
    appSecret,
    sessionToken,
    name,
    description,
    parametersSchema,
    endpoint,
    headers,
    httpMethod,
    requiresConfirmation,
    requiresAuth,
  } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
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

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
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
