import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest } from "./helpers";

/** POST /api/guardrails/check — Validate input or output against guardrail rules */
export const checkGuardrails = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionToken, sessionId, content, direction } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    sessionId: string;
    content: string;
    direction: "input" | "output";
  };

  if (!sessionId || !content || !direction) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
  const { app } = auth;

  if (!app.guardrailsEnabled) {
    return jsonResponse({ allowed: true, violations: [] });
  }

  const result = await ctx.runMutation(
    internal.guardrailsInternal.evaluateContent,
    { appSlug: app.slug, sessionId, content, direction }
  );

  return jsonResponse(result);
});

/** POST /api/guardrails/rules — Create or update a guardrail rule */
export const upsertRule = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { appSlug, appSecret, sessionToken, type, pattern, action, userMessage } = body as {
    appSlug?: string;
    appSecret?: string;
    sessionToken?: string;
    type: string;
    pattern: string;
    action: string;
    userMessage?: string;
  };

  if (!type || !pattern || !action) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const ruleId = await ctx.runMutation(
    internal.guardrailsInternal.createRule,
    { appSlug: auth.app.slug, type, pattern, action, userMessage }
  );

  return jsonResponse({ id: ruleId });
});

/** GET /api/guardrails/violations — List guardrail violations */
export const listViolations = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appSlug = url.searchParams.get("appSlug") ?? undefined;
  const appSecret = url.searchParams.get("appSecret") ?? undefined;
  const sessionToken = url.searchParams.get("sessionToken") ?? undefined;
  const all = url.searchParams.get("all") === "true";

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const violations = await ctx.runQuery(
    internal.guardrailsInternal.listViolations,
    { appSlug: all ? undefined : auth.app.slug }
  );

  return jsonResponse({ violations });
});

/** GET /api/guardrails/rules — List all guardrail rules */
export const listRules = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appSlug = url.searchParams.get("appSlug") ?? undefined;
  const appSecret = url.searchParams.get("appSecret") ?? undefined;
  const sessionToken = url.searchParams.get("sessionToken") ?? undefined;
  const all = url.searchParams.get("all") === "true";

  const auth = await authenticateRequest(ctx, { appSlug, appSecret, sessionToken });
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const rules = await ctx.runQuery(internal.guardrailsInternal.getRules, {
    appSlug: all ? undefined : auth.app.slug,
  });

  return jsonResponse({ rules });
});
