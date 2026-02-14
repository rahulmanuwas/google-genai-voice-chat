import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { jsonResponse, authenticateRequest, getAuthCredentialsFromRequest, getFullAuthCredentials, corsHttpAction } from "./helpers";

interface QaScenarioTurn {
  role: "user";
  content: string;
}

interface QaExpectations {
  shouldContain?: string[];
  shouldNotContain?: string[];
  shouldCallTool?: string | string[];
  shouldHandoff?: boolean;
}

interface QaCheckResult {
  check: string;
  passed: boolean;
  detail: string;
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function evaluateQaRun(args: {
  responseText: string;
  calledTools: string[];
  handoffTriggered?: boolean;
  expectations: QaExpectations;
}): { results: QaCheckResult[]; totalChecks: number; passedChecks: number; score: number } {
  const normalizedResponse = args.responseText.toLowerCase();
  const normalizedTools = new Set(args.calledTools.map((tool) => tool.toLowerCase()));
  const results: QaCheckResult[] = [];

  for (const phrase of args.expectations.shouldContain ?? []) {
    const passed = normalizedResponse.includes(phrase.toLowerCase());
    results.push({
      check: "shouldContain",
      passed,
      detail: passed
        ? `Response includes "${phrase}".`
        : `Missing required phrase "${phrase}".`,
    });
  }

  for (const phrase of args.expectations.shouldNotContain ?? []) {
    const passed = !normalizedResponse.includes(phrase.toLowerCase());
    results.push({
      check: "shouldNotContain",
      passed,
      detail: passed
        ? `Response does not contain blocked phrase "${phrase}".`
        : `Response contains blocked phrase "${phrase}".`,
    });
  }

  if (args.expectations.shouldCallTool) {
    const expectedTools = Array.isArray(args.expectations.shouldCallTool)
      ? args.expectations.shouldCallTool
      : [args.expectations.shouldCallTool];

    for (const tool of expectedTools) {
      const passed = normalizedTools.has(tool.toLowerCase());
      results.push({
        check: "shouldCallTool",
        passed,
        detail: passed
          ? `Tool "${tool}" was called.`
          : `Expected tool "${tool}" was not called.`,
      });
    }
  }

  if (args.expectations.shouldHandoff !== undefined) {
    const expected = args.expectations.shouldHandoff;
    const actual = Boolean(args.handoffTriggered);
    const passed = expected === actual;
    results.push({
      check: "shouldHandoff",
      passed,
      detail: passed
        ? `Handoff expectation matched (${expected}).`
        : `Expected handoff=${expected}, got handoff=${actual}.`,
    });
  }

  if (results.length === 0) {
    results.push({
      check: "hasExpectations",
      passed: true,
      detail: "Scenario has no explicit expectations. Marked as pass by default.",
    });
  }

  const totalChecks = results.length;
  const passedChecks = results.filter((result) => result.passed).length;
  const score = totalChecks === 0 ? 1 : passedChecks / totalChecks;

  return { results, totalChecks, passedChecks, score };
}

/** POST /api/qa/scenarios — Create or update a QA scenario */
export const upsertQaScenario = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    name,
    description,
    turns,
    expectations,
    tags,
    isActive,
    evaluatorType,
    llmJudgeCriteria,
  } = body as {
    name: string;
    description?: string;
    turns: QaScenarioTurn[];
    expectations?: QaExpectations;
    tags?: string[];
    isActive?: boolean;
    evaluatorType?: string;
    llmJudgeCriteria?: Array<{ name: string; description: string; weight?: number }>;
  };

  if (!name || !Array.isArray(turns) || turns.length === 0) {
    return jsonResponse({ error: "name and turns are required" }, 400);
  }

  const invalidTurn = turns.some(
    (turn) => turn.role !== "user" || typeof turn.content !== "string" || !turn.content.trim()
  );
  if (invalidTurn) {
    return jsonResponse({ error: "turns must be [{ role: 'user', content: string }]" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const scenarioId = await ctx.runMutation(internal.qa.upsertQaScenarioRecord, {
    appSlug: auth.app.slug,
    name: name.trim(),
    description: description?.trim() || undefined,
    turns: JSON.stringify(turns),
    expectations: JSON.stringify(expectations ?? {}),
    tags: tags && tags.length > 0 ? JSON.stringify(tags) : undefined,
    evaluatorType: evaluatorType ?? undefined,
    llmJudgeCriteria: llmJudgeCriteria ? JSON.stringify(llmJudgeCriteria) : undefined,
    isActive: isActive ?? true,
  });

  return jsonResponse({ id: scenarioId });
});

/** GET /api/qa/scenarios — List QA scenarios */
export const listQaScenarios = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";
  const active = url.searchParams.get("active");

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

  const activeOnly = active === "true" ? true : active === "false" ? false : undefined;

  const scenarios = await ctx.runQuery(internal.qa.listQaScenarioRecords, {
    appSlug: all ? undefined : auth.app.slug,
    activeOnly,
  });

  return jsonResponse({
    scenarios: scenarios.map((scenario) => ({
      ...scenario,
      turns: parseJson<QaScenarioTurn[]>(scenario.turns, []),
      expectations: parseJson<QaExpectations>(scenario.expectations, {}),
      tags: parseJson<string[]>(scenario.tags, []),
      evaluatorType: scenario.evaluatorType ?? "string_match",
      llmJudgeCriteria: parseJson<Array<{ name: string; description: string; weight?: number }>>(
        scenario.llmJudgeCriteria,
        [],
      ),
    })),
  });
});

/** POST /api/qa/runs — Evaluate an answer against a QA scenario */
export const runQaScenario = corsHttpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    scenarioId,
    sessionId,
    responseText,
    calledTools,
    handoffTriggered,
    useLlmJudge,
    executionMode,
  } = body as {
    scenarioId: string;
    sessionId?: string;
    responseText: string;
    calledTools?: string[];
    handoffTriggered?: boolean;
    useLlmJudge?: boolean;
    executionMode?: string;
  };

  if (!scenarioId || typeof responseText !== "string") {
    return jsonResponse({ error: "scenarioId and responseText are required" }, 400);
  }

  const auth = await authenticateRequest(ctx, getFullAuthCredentials(request, body));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
  const scenarioRecordId = scenarioId as Id<"qaScenarios">;

  const scenario = await ctx.runQuery(internal.qa.getQaScenarioRecordById, { scenarioId: scenarioRecordId });
  if (!scenario || scenario.appSlug !== auth.app.slug) {
    return jsonResponse({ error: "Scenario not found" }, 404);
  }

  // If scenario has LLM judge criteria or useLlmJudge flag, use the LLM judge path
  const evaluatorType = scenario.evaluatorType ?? "string_match";
  if (useLlmJudge || evaluatorType === "llm_judge" || evaluatorType === "hybrid") {
    const result = await ctx.runAction(internal.qaInternal.runWithLlmJudgeAction, {
      appSlug: auth.app.slug,
      scenarioId: scenarioRecordId,
      sessionId,
      responseText,
      calledTools: JSON.stringify(Array.isArray(calledTools) ? calledTools : []),
      handoffTriggered: Boolean(handoffTriggered),
      executionMode: executionMode ?? "manual",
    });
    return jsonResponse(result);
  }

  // Standard string_match evaluation
  const expectations = parseJson<QaExpectations>(scenario.expectations, {});
  const evaluation = evaluateQaRun({
    responseText,
    calledTools: Array.isArray(calledTools) ? calledTools : [],
    handoffTriggered,
    expectations,
  });

  const status = evaluation.passedChecks === evaluation.totalChecks ? "passed" : "failed";

  const input = {
    responseText,
    calledTools: Array.isArray(calledTools) ? calledTools : [],
    handoffTriggered: Boolean(handoffTriggered),
  };

  const runId = await ctx.runMutation(internal.qa.createQaRunRecord, {
    appSlug: auth.app.slug,
    scenarioId: scenarioRecordId,
    scenarioName: scenario.name,
    sessionId,
    status,
    score: evaluation.score,
    totalChecks: evaluation.totalChecks,
    passedChecks: evaluation.passedChecks,
    results: JSON.stringify(evaluation.results),
    input: JSON.stringify(input),
    executionMode: executionMode ?? "manual",
  });

  return jsonResponse({
    id: runId,
    status,
    score: evaluation.score,
    totalChecks: evaluation.totalChecks,
    passedChecks: evaluation.passedChecks,
    results: evaluation.results,
  });
});

/** GET /api/qa/runs — List QA run history */
export const listQaRuns = corsHttpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";
  const scenarioId = url.searchParams.get("scenarioId");
  const limit = url.searchParams.get("limit");

  const auth = await authenticateRequest(ctx, getAuthCredentialsFromRequest(request));
  if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
  const scenarioRecordId = scenarioId ? (scenarioId as Id<"qaScenarios">) : undefined;

  const runs = await ctx.runQuery(internal.qa.listQaRunRecords, {
    appSlug: all ? undefined : auth.app.slug,
    scenarioId: scenarioRecordId,
    limit: limit ? Number(limit) : undefined,
  });

  return jsonResponse({
    runs: runs.map((run) => ({
      ...run,
      results: parseJson<QaCheckResult[]>(run.results, []),
      input: parseJson<Record<string, unknown>>(run.input, {}),
      llmJudgeScores: parseJson<Array<{ criterion: string; passed: boolean; reasoning: string }>>(
        run.llmJudgeScores,
        [],
      ),
      executionMode: run.executionMode ?? "manual",
    })),
  });
});

/** Create or update a QA scenario by app + name */
export const upsertQaScenarioRecord = internalMutation({
  args: {
    appSlug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    turns: v.string(),
    expectations: v.string(),
    tags: v.optional(v.string()),
    evaluatorType: v.optional(v.string()),
    llmJudgeCriteria: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("qaScenarios")
      .withIndex("by_app_name", (q) =>
        q.eq("appSlug", args.appSlug).eq("name", args.name)
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        description: args.description,
        turns: args.turns,
        expectations: args.expectations,
        tags: args.tags,
        evaluatorType: args.evaluatorType,
        llmJudgeCriteria: args.llmJudgeCriteria,
        isActive: args.isActive,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("qaScenarios", {
      appSlug: args.appSlug,
      name: args.name,
      description: args.description,
      turns: args.turns,
      expectations: args.expectations,
      tags: args.tags,
      evaluatorType: args.evaluatorType,
      llmJudgeCriteria: args.llmJudgeCriteria,
      isActive: args.isActive,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** List QA scenarios with optional app and active filter */
export const listQaScenarioRecords = internalQuery({
  args: {
    appSlug: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.appSlug && args.activeOnly !== undefined) {
      return await ctx.db
        .query("qaScenarios")
        .withIndex("by_app_active", (q) =>
          q.eq("appSlug", args.appSlug!).eq("isActive", args.activeOnly!)
        )
        .order("desc")
        .take(100);
    }

    if (args.appSlug) {
      return await ctx.db
        .query("qaScenarios")
        .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(100);
    }

    const all = await ctx.db.query("qaScenarios").order("desc").take(200);
    if (args.activeOnly === undefined) return all;
    return all.filter((scenario) => scenario.isActive === args.activeOnly);
  },
});

/** Get a QA scenario by ID */
export const getQaScenarioRecordById = internalQuery({
  args: { scenarioId: v.id("qaScenarios") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.scenarioId);
  },
});

/** Store a QA run result */
export const createQaRunRecord = internalMutation({
  args: {
    appSlug: v.string(),
    scenarioId: v.id("qaScenarios"),
    scenarioName: v.string(),
    sessionId: v.optional(v.string()),
    status: v.string(),
    score: v.float64(),
    totalChecks: v.float64(),
    passedChecks: v.float64(),
    results: v.string(),
    input: v.optional(v.string()),
    executionMode: v.optional(v.string()),
    llmJudgeScores: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("qaRuns", {
      ...args,
      createdAt: now,
      completedAt: now,
    });
  },
});

/** List QA runs with optional app/scenario filter */
export const listQaRunRecords = internalQuery({
  args: {
    appSlug: v.optional(v.string()),
    scenarioId: v.optional(v.id("qaScenarios")),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    if (args.scenarioId) {
      return await ctx.db
        .query("qaRuns")
        .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId!))
        .order("desc")
        .take(limit);
    }

    if (args.appSlug) {
      return await ctx.db
        .query("qaRuns")
        .withIndex("by_app_createdAt", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("qaRuns").order("desc").take(limit);
  },
});
