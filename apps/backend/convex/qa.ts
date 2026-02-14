import { internal } from "./_generated/api";
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

  const scenarioId = await ctx.runMutation(internal.qaDb.upsertScenario, {
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

  const scenarios = await ctx.runQuery(internal.qaDb.listScenarios, {
    appSlug: all ? undefined : auth.app.slug,
    activeOnly,
  });

  return jsonResponse({
    scenarios: scenarios.map((scenario: any) => ({
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scenario = await ctx.runQuery(internal.qaDb.getScenario, { scenarioId: scenarioId as any });
  if (!scenario || scenario.appSlug !== auth.app.slug) {
    return jsonResponse({ error: "Scenario not found" }, 404);
  }

  // If scenario has LLM judge criteria or useLlmJudge flag, use the LLM judge path
  const evaluatorType = scenario.evaluatorType ?? "string_match";
  if (useLlmJudge || evaluatorType === "llm_judge" || evaluatorType === "hybrid") {
    const result = await ctx.runAction(internal.qaInternal.runWithLlmJudge, {
      appSlug: auth.app.slug,
      scenarioId,
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

  const runId = await ctx.runMutation(internal.qaDb.createRun, {
    appSlug: auth.app.slug,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scenarioId: scenarioId as any,
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

  const runs = await ctx.runQuery(internal.qaDb.listRuns, {
    appSlug: all ? undefined : auth.app.slug,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scenarioId: scenarioId ? (scenarioId as any) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return jsonResponse({
    runs: runs.map((run: any) => ({
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
