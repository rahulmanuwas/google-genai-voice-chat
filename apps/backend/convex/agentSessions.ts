/**
 * HTTP action handlers for agent sessions.
 */

import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { authenticateRequest, getFullAuthCredentials, jsonResponse } from "./helpers";

/** POST /api/agents/session — Create a new agent session */
export const createAgentSessionHandler = httpAction(async (ctx, request) => {
  const body = await request.json();
  const creds = getFullAuthCredentials(request, body);
  const auth = await authenticateRequest(ctx, creds);
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const { runtime, provider, model, branchId, threadId, cwd } = body;
  if (!runtime || runtime !== "pi") {
    return jsonResponse({ error: "Invalid runtime. Must be 'pi'." }, 400);
  }

  const sessionId = `${runtime}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await ctx.runMutation(api.agentSessionsDb.createAgentSession, {
    appSlug: auth.app.slug,
    sessionId,
    runtime,
    provider,
    model,
    branchId,
    threadId,
    cwd,
  });

  return jsonResponse({ sessionId, runtime, status: "active" }, 201);
});

/** GET /api/agents/session — Get an agent session by sessionId */
export const getAgentSessionHandler = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const creds = getFullAuthCredentials(request);
  const auth = await authenticateRequest(ctx, creds);
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  if (!sessionId) {
    return jsonResponse({ error: "sessionId query parameter is required" }, 400);
  }

  const session = await ctx.runQuery(api.agentSessionsDb.getAgentSession, {
    appSlug: auth.app.slug,
    sessionId,
  });
  if (!session) {
    return jsonResponse({ error: "Agent session not found" }, 404);
  }

  return jsonResponse(session);
});

/** POST /api/agents/prompt — Forward a prompt to an active agent session */
export const promptAgentHandler = httpAction(async (ctx, request) => {
  const body = await request.json();
  const creds = getFullAuthCredentials(request, body);
  const auth = await authenticateRequest(ctx, creds);
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const { sessionId, text } = body;
  if (!sessionId || !text) {
    return jsonResponse({ error: "sessionId and text are required" }, 400);
  }

  const session = await ctx.runQuery(api.agentSessionsDb.getAgentSession, {
    appSlug: auth.app.slug,
    sessionId,
  });
  if (!session) {
    return jsonResponse({ error: "Agent session not found" }, 404);
  }
  if (session.status !== "active") {
    return jsonResponse({ error: "Agent session is not active" }, 400);
  }

  // TODO: Forward to actual runtime process via WebSocket/RPC
  // For now, acknowledge the prompt
  return jsonResponse({
    sessionId,
    status: "queued",
    message: `Prompt queued for ${session.runtime} runtime`,
  });
});

/** POST /api/agents/session/run — Persist metadata for one prompt run */
export const recordAgentSessionRunHandler = httpAction(async (ctx, request) => {
  const body = await request.json();
  const creds = getFullAuthCredentials(request, body);
  const auth = await authenticateRequest(ctx, creds);
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const { sessionId, run } = body as {
    sessionId?: string;
    run?: {
      runId?: string;
      runtime?: string;
      provider?: string;
      model?: string;
      status?: string;
      startedAt?: number;
      endedAt?: number;
      durationMs?: number;
      attemptCount?: number;
      fallbackCount?: number;
      contextRecoveryCount?: number;
      toolOutputTruncatedChars?: number;
      promptChars?: number;
      responseChars?: number;
      authProfileId?: string;
      failureReason?: string;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
    };
  };

  if (!sessionId || !run?.runId || !run.provider || !run.model || !run.status) {
    return jsonResponse({ error: "sessionId, runId, provider, model, and status are required" }, 400);
  }

  await ctx.runMutation(api.agentSessionsDb.recordAgentSessionRun, {
    appSlug: auth.app.slug,
    sessionId,
    runId: run.runId,
    runtime: run.runtime ?? "pi",
    provider: run.provider,
    model: run.model,
    status: run.status,
    startedAt: run.startedAt ?? Date.now(),
    endedAt: run.endedAt ?? Date.now(),
    durationMs: run.durationMs ?? 0,
    attemptCount: run.attemptCount ?? 1,
    fallbackCount: run.fallbackCount ?? 0,
    contextRecoveryCount: run.contextRecoveryCount ?? 0,
    toolOutputTruncatedChars: run.toolOutputTruncatedChars ?? 0,
    promptChars: run.promptChars ?? 0,
    responseChars: run.responseChars ?? 0,
    authProfileId: run.authProfileId,
    failureReason: run.failureReason,
    errorMessage: run.errorMessage,
    metadata: run.metadata ? JSON.stringify(run.metadata) : undefined,
  });

  return jsonResponse({ ok: true, sessionId, runId: run.runId });
});

/** GET /api/agents/session/runs — List recent runs for an agent session */
export const listAgentSessionRunsHandler = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const limitRaw = url.searchParams.get("limit");
  const creds = getFullAuthCredentials(request);
  const auth = await authenticateRequest(ctx, creds);
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  if (!sessionId) {
    return jsonResponse({ error: "sessionId query parameter is required" }, 400);
  }

  const limit = limitRaw ? Number(limitRaw) : undefined;
  const runs = await ctx.runQuery(api.agentSessionsDb.listAgentSessionRuns, {
    appSlug: auth.app.slug,
    sessionId,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return jsonResponse({ sessionId, runs });
});

/** GET /api/agents/runtimes — List available runtimes and models */
export const listRuntimesHandler = httpAction(async (ctx, request) => {
  const creds = getFullAuthCredentials(request);
  const auth = await authenticateRequest(ctx, creds);
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const runtimes = await ctx.runQuery(api.agentSessionsDb.getAvailableRuntimes, {});
  return jsonResponse({ runtimes });
});
