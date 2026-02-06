import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse } from "./helpers";

/** GET /api/tools?appSlug=...&appSecret=... — List active tools for an app */
export const listTools = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appSlug = url.searchParams.get("appSlug");
  const appSecret = url.searchParams.get("appSecret");

  if (!appSlug || !appSecret) {
    return jsonResponse({ error: "Missing appSlug or appSecret" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const tools = await ctx.runQuery(internal.toolsInternal.getActiveTools, {
    appSlug,
  });

  return jsonResponse({ tools });
});

/** POST /api/tools/execute — Execute a tool call */
export const executeTool = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionId, toolName, parameters } = body as {
    appSlug: string;
    appSecret: string;
    sessionId: string;
    toolName: string;
    parameters: Record<string, unknown>;
  };

  if (!appSlug || !appSecret || !sessionId || !toolName) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Check per-turn action limits
  if (app.maxActionsPerTurn) {
    const recentCount = await ctx.runQuery(
      internal.toolsInternal.countRecentExecutions,
      { appSlug, sessionId, windowMs: 60_000 }
    );
    if (recentCount >= app.maxActionsPerTurn) {
      return jsonResponse({ error: "Max actions per turn exceeded" }, 429);
    }
  }

  const result = await ctx.runAction(internal.toolsInternal.executeToolAction, {
    appSlug,
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
    name,
    description,
    parametersSchema,
    endpoint,
    headers,
    httpMethod,
    requiresConfirmation,
    requiresAuth,
  } = body as {
    appSlug: string;
    appSecret: string;
    name: string;
    description: string;
    parametersSchema: string;
    endpoint?: string;
    headers?: string;
    httpMethod?: string;
    requiresConfirmation?: boolean;
    requiresAuth?: boolean;
  };

  if (!appSlug || !appSecret || !name || !description || !parametersSchema) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const toolId = await ctx.runMutation(internal.toolsInternal.upsertTool, {
    appSlug,
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
