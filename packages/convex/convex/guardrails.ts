import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse } from "./helpers";

/** POST /api/guardrails/check — Validate input or output against guardrail rules */
export const checkGuardrails = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionId, content, direction } = body as {
    appSlug: string;
    appSecret: string;
    sessionId: string;
    content: string;
    direction: "input" | "output";
  };

  if (!appSlug || !appSecret || !sessionId || !content || !direction) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (!app.guardrailsEnabled) {
    return jsonResponse({ allowed: true, violations: [] });
  }

  const result = await ctx.runMutation(
    internal.guardrailsInternal.evaluateContent,
    { appSlug, sessionId, content, direction }
  );

  return jsonResponse(result);
});

/** POST /api/guardrails/rules — Create or update a guardrail rule */
export const upsertRule = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, type, pattern, action, userMessage } = body as {
    appSlug: string;
    appSecret: string;
    type: string;
    pattern: string;
    action: string;
    userMessage?: string;
  };

  if (!appSlug || !appSecret || !type || !pattern || !action) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const app = await ctx.runQuery(internal.apps.getAppBySlug, { slug: appSlug });
  if (!app || app.secret !== appSecret || !app.isActive) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const ruleId = await ctx.runMutation(
    internal.guardrailsInternal.createRule,
    { appSlug, type, pattern, action, userMessage }
  );

  return jsonResponse({ id: ruleId });
});

/** GET /api/guardrails/rules — List all guardrail rules for an app */
export const listRules = httpAction(async (ctx, request) => {
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

  const rules = await ctx.runQuery(internal.guardrailsInternal.getRules, {
    appSlug,
  });

  return jsonResponse({ rules });
});
