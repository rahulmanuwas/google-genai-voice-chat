"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

interface LlmJudgeCriterion {
  name: string;
  description: string;
  weight?: number;
}

interface LlmJudgeResult {
  criterion: string;
  passed: boolean;
  reasoning: string;
}

/**
 * Evaluate a response using an LLM judge (Gemini 2.0 Flash).
 * Returns binary pass/fail per criterion (per Hamel: avoid Likert scales).
 */
export const evaluateWithLlmAction = internalAction({
  args: {
    responseText: v.string(),
    criteria: v.string(), // JSON LlmJudgeCriterion[]
    conversationContext: v.optional(v.string()), // optional conversation turns for context
  },
  handler: async (_ctx, args): Promise<string> => {
    const criteria: LlmJudgeCriterion[] = JSON.parse(args.criteria);

    if (criteria.length === 0) {
      return JSON.stringify([]);
    }

    const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY not set");
    }

    const criteriaList = criteria
      .map(
        (c, i) =>
          `${i + 1}. **${c.name}**: ${c.description}`
      )
      .join("\n");

    const contextBlock = args.conversationContext
      ? `\n## Conversation Context\n${args.conversationContext}\n`
      : "";

    const prompt = `You are an expert evaluator for AI assistant responses. Evaluate the following response against each criterion.

For each criterion, provide:
- A binary PASS or FAIL judgment (no partial scores)
- Brief reasoning (1-2 sentences)
${contextBlock}
## Response to Evaluate
${args.responseText}

## Criteria
${criteriaList}

## Instructions
Return a JSON array with one object per criterion:
[
  { "criterion": "<name>", "passed": true/false, "reasoning": "<brief explanation>" }
]

Return ONLY the JSON array, no other text.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

    // Parse the LLM response
    let results: LlmJudgeResult[];
    try {
      results = JSON.parse(text);
    } catch {
      // Try to extract JSON from markdown code blocks
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        results = JSON.parse(match[1]);
      } else {
        throw new Error(`Failed to parse LLM judge response: ${text.slice(0, 200)}`);
      }
    }

    return JSON.stringify(results);
  },
});

/**
 * Run a QA scenario with LLM-as-Judge evaluation.
 * Combines string_match checks with LLM judge if evaluatorType is 'llm_judge' or 'hybrid'.
 */
export const runWithLlmJudgeAction = internalAction({
  args: {
    appSlug: v.string(),
    scenarioId: v.id("qaScenarios"),
    sessionId: v.optional(v.string()),
    responseText: v.string(),
    calledTools: v.string(), // JSON string[]
    handoffTriggered: v.boolean(),
    executionMode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Fetch the scenario
    const scenario = await ctx.runQuery(internal.qa.getQaScenarioRecordById, {
      scenarioId: args.scenarioId,
    });
    if (!scenario) throw new Error("Scenario not found");

    const expectations = JSON.parse(scenario.expectations || "{}");
    const evaluatorType = scenario.evaluatorType ?? "string_match";
    const calledTools: string[] = JSON.parse(args.calledTools);

    // String match checks (same as existing evaluateQaRun logic)
    const results: Array<{ check: string; passed: boolean; detail: string }> = [];

    if (evaluatorType !== "llm_judge") {
      // Run string_match checks
      const normalizedResponse = args.responseText.toLowerCase();
      const normalizedTools = new Set(calledTools.map((t: string) => t.toLowerCase()));

      for (const phrase of expectations.shouldContain ?? []) {
        const passed = normalizedResponse.includes(phrase.toLowerCase());
        results.push({
          check: "shouldContain",
          passed,
          detail: passed
            ? `Response includes "${phrase}".`
            : `Missing required phrase "${phrase}".`,
        });
      }

      for (const phrase of expectations.shouldNotContain ?? []) {
        const passed = !normalizedResponse.includes(phrase.toLowerCase());
        results.push({
          check: "shouldNotContain",
          passed,
          detail: passed
            ? `Response does not contain blocked phrase "${phrase}".`
            : `Response contains blocked phrase "${phrase}".`,
        });
      }

      if (expectations.shouldCallTool) {
        const expectedTools = Array.isArray(expectations.shouldCallTool)
          ? expectations.shouldCallTool
          : [expectations.shouldCallTool];
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

      if (expectations.shouldHandoff !== undefined) {
        const expected = expectations.shouldHandoff;
        const actual = args.handoffTriggered;
        const passed = expected === actual;
        results.push({
          check: "shouldHandoff",
          passed,
          detail: passed
            ? `Handoff expectation matched (${expected}).`
            : `Expected handoff=${expected}, got handoff=${actual}.`,
        });
      }
    }

    // LLM judge checks
    let llmJudgeScores: LlmJudgeResult[] = [];
    if (evaluatorType === "llm_judge" || evaluatorType === "hybrid") {
      const criteria = scenario.llmJudgeCriteria;
      if (criteria) {
        const conversationContext = JSON.parse(scenario.turns || "[]")
          .map((t: { role: string; content: string }) => `${t.role}: ${t.content}`)
          .join("\n");

        const llmResultsJson = await ctx.runAction(
          internal.qaInternal.evaluateWithLlmAction,
          {
            responseText: args.responseText,
            criteria,
            conversationContext,
          }
        );

        llmJudgeScores = JSON.parse(llmResultsJson);

        // Merge LLM judge results into main results
        for (const score of llmJudgeScores) {
          results.push({
            check: `llm_judge:${score.criterion}`,
            passed: score.passed,
            detail: score.reasoning,
          });
        }
      }
    }

    const totalChecks = results.length;
    const passedChecks = results.filter((r) => r.passed).length;
    // No checks produced = vacuously passed with score 1
    const score = totalChecks === 0 ? 1 : passedChecks / totalChecks;
    const status = totalChecks === 0 || passedChecks === totalChecks ? "passed" : "failed";

    // Save the run
    const input = {
      responseText: args.responseText,
      calledTools,
      handoffTriggered: args.handoffTriggered,
    };

    const runId = await ctx.runMutation(internal.qa.createQaRunRecord, {
      appSlug: args.appSlug,
      scenarioId: args.scenarioId as Id<"qaScenarios">,
      scenarioName: scenario.name,
      sessionId: args.sessionId,
      status,
      score,
      totalChecks,
      passedChecks,
      results: JSON.stringify(results),
      input: JSON.stringify(input),
      executionMode: args.executionMode ?? "manual",
      llmJudgeScores: llmJudgeScores.length > 0 ? JSON.stringify(llmJudgeScores) : undefined,
    });

    return {
      id: runId,
      status,
      score,
      totalChecks,
      passedChecks,
      results,
      llmJudgeScores,
    };
  },
});
