import { internal } from "./_generated/api";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

/** POST /api/guardrails/check — Validate input or output against guardrail rules */
export const checkGuardrails = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { sessionId, content, direction } = body as {
    sessionId: string;
    content: string;
    direction: "input" | "output";
  };

  if (!sessionId || !content || !direction) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
  const { app } = auth;

  if (!app.guardrailsEnabled) {
    return jsonResponse({ allowed: true, violations: [] });
  }

  const result = await ctx.runMutation(
    internal.guardrailsInternal.evaluateGuardrailContentRecord,
    { appSlug: app.slug, sessionId, content, direction }
  );

  return jsonResponse(result);
});

/** POST /api/guardrails/rules — Create or update a guardrail rule */
export const upsertRule = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { type, pattern, action, userMessage } = body as {
    type: string;
    pattern: string;
    action: string;
    userMessage?: string;
  };

  if (!type || !pattern || !action) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const ruleId = await ctx.runMutation(
    internal.guardrailsInternal.createGuardrailRuleRecord,
    { appSlug: auth.app.slug, type, pattern, action, userMessage }
  );

  return jsonResponse({ id: ruleId });
});

/** GET /api/guardrails/violations — List guardrail violations */
export const listViolations = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const violations = await ctx.runQuery(
    internal.guardrailsInternal.listGuardrailViolationRecords,
    { appSlug: all ? undefined : auth.app.slug }
  );

  return jsonResponse({ violations });
});

/** PATCH /api/guardrails/violations — Annotate violation correctness (TP/FP) */
export const annotateViolation = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const { violationId, annotatedCorrectness, annotatedBy } = body as {
    violationId: string;
    annotatedCorrectness: "true_positive" | "false_positive";
    annotatedBy?: string;
  };

  if (!violationId || !annotatedCorrectness) {
    return jsonResponse({ error: "Missing required fields: violationId, annotatedCorrectness" }, 400);
  }

  if (!["true_positive", "false_positive"].includes(annotatedCorrectness)) {
    return jsonResponse({ error: "annotatedCorrectness must be 'true_positive' or 'false_positive'" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  await ctx.runMutation(internal.guardrailsInternal.annotateGuardrailViolationRecord, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    violationId: violationId as any,
    annotatedCorrectness,
    annotatedBy: annotatedBy ?? "dashboard-user",
    appSlug: auth.app.slug,
  });

  return jsonResponse({ ok: true });
});

/** GET /api/guardrails/rules — List all guardrail rules */
export const listRules = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const rules = await ctx.runQuery(internal.guardrailsInternal.listGuardrailRuleRecords, {
    appSlug: all ? undefined : auth.app.slug,
  });

  return jsonResponse({ rules });
});
