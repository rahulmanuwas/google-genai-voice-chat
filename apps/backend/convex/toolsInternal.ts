"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { handleInternalTool, getInitialState } from "./toolHandlers";

/**
 * Validate parameters against a JSON Schema string.
 * Returns null if valid, or an error string if invalid.
 * Fail-open: returns null if schema is unparseable.
 */
function validateParameters(
  params: Record<string, unknown>,
  schemaStr: string,
): string | null {
  let schema: {
    properties?: Record<string, { type?: string }>;
    required?: string[];
  };
  try {
    schema = JSON.parse(schemaStr);
  } catch {
    return null; // Fail-open on unparseable schema
  }

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in params) || params[field] === undefined || params[field] === null) {
        return `Missing required field: "${field}"`;
      }
    }
  }

  // Check basic type matching
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (!(key in params) || params[key] === undefined || params[key] === null) continue;
      const value = params[key];
      const expectedType = prop.type;
      if (!expectedType) continue;

      let valid = true;
      switch (expectedType) {
        case "string":
          valid = typeof value === "string";
          break;
        case "number":
        case "integer":
          valid = typeof value === "number";
          break;
        case "boolean":
          valid = typeof value === "boolean";
          break;
        case "array":
          valid = Array.isArray(value);
          break;
        case "object":
          valid = typeof value === "object" && !Array.isArray(value);
          break;
      }
      if (!valid) {
        return `Field "${key}" expected type "${expectedType}", got "${typeof value}"`;
      }
    }
  }

  return null;
}

/** Execute a tool by calling its registered endpoint */
export const executeToolAction = internalAction({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    toolName: v.string(),
    parameters: v.string(),
    traceId: v.optional(v.string()),
    spanId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();

    // Look up the tool (single query instead of filtering all tools)
    const fullTool = await ctx.runQuery(internal.toolsDb.getToolByName, {
      appSlug: args.appSlug,
      name: args.toolName,
    });

    if (!fullTool || !fullTool.isActive) {
      const result = { success: false, error: `Tool "${args.toolName}" not found` };
      await ctx.runMutation(internal.toolsDb.logExecution, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        toolName: args.toolName,
        parameters: args.parameters,
        result: JSON.stringify(result),
        status: "error",
        executedAt: startedAt,
        durationMs: Date.now() - startedAt,
        traceId: args.traceId,
        spanId: args.spanId,
      });
      return result;
    }

    // Parse parameters once and validate against schema
    let parsedParams: Record<string, unknown> = {};
    try {
      parsedParams = JSON.parse(args.parameters);
    } catch { /* use empty params */ }

    const validationError = validateParameters(parsedParams, fullTool.parametersSchema);
    if (validationError) {
      const result = { success: false, error: `Parameter validation failed: ${validationError}` };
      await ctx.runMutation(internal.toolsDb.logExecution, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        toolName: args.toolName,
        parameters: args.parameters,
        result: JSON.stringify(result),
        status: "validation_error",
        executedAt: startedAt,
        durationMs: Date.now() - startedAt,
        traceId: args.traceId,
        spanId: args.spanId,
      });
      return result;
    }

    if (!fullTool.endpoint) {
      // Try internal mock handler for demo tools

      // Read current scenario state
      const stateRow = await ctx.runQuery(internal.scenarioStateDb.getState, {
        appSlug: args.appSlug,
      });
      let currentState: Record<string, unknown> | undefined;
      if (stateRow) {
        try {
          currentState = JSON.parse(stateRow.state);
        } catch { /* ignore parse errors */ }
      } else {
        // Auto-initialize state if it doesn't exist yet
        const initial = getInitialState(args.appSlug);
        if (initial) {
          currentState = initial;
          await ctx.runMutation(internal.scenarioStateDb.upsertState, {
            appSlug: args.appSlug,
            state: JSON.stringify(initial),
          });
        }
      }

      const handlerResult = handleInternalTool(args.toolName, parsedParams, currentState);
      if (handlerResult) {
        // Persist state update if the handler produced one
        if (handlerResult.stateUpdate) {
          await ctx.runMutation(internal.scenarioStateDb.upsertState, {
            appSlug: args.appSlug,
            state: JSON.stringify(handlerResult.stateUpdate),
          });
        }

        await ctx.runMutation(internal.toolsDb.logExecution, {
          appSlug: args.appSlug,
          sessionId: args.sessionId,
          toolName: args.toolName,
          parameters: args.parameters,
          result: JSON.stringify(handlerResult.result),
          status: "success",
          executedAt: startedAt,
          durationMs: Date.now() - startedAt,
          traceId: args.traceId,
          spanId: args.spanId,
        });
        return handlerResult.result;
      }

      // No mock handler — return error as before
      const result = { success: false, error: `Tool "${args.toolName}" has no endpoint configured` };
      await ctx.runMutation(internal.toolsDb.logExecution, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        toolName: args.toolName,
        parameters: args.parameters,
        result: JSON.stringify(result),
        status: "error",
        executedAt: startedAt,
        durationMs: Date.now() - startedAt,
        traceId: args.traceId,
        spanId: args.spanId,
      });
      return result;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (fullTool.headers) {
        try {
          const parsed = JSON.parse(fullTool.headers);
          if (parsed && typeof parsed === "object") {
            Object.assign(headers, parsed);
          }
        } catch {
          console.warn(`Invalid headers JSON for tool "${args.toolName}", using defaults`);
        }
      }

      const response = await fetch(fullTool.endpoint, {
        method: fullTool.httpMethod || "POST",
        headers,
        body: args.parameters,
      });

      const data = await response.json();
      const result = { success: response.ok, data };

      await ctx.runMutation(internal.toolsDb.logExecution, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        toolName: args.toolName,
        parameters: args.parameters,
        result: JSON.stringify(result),
        status: response.ok ? "success" : "error",
        executedAt: startedAt,
        durationMs: Date.now() - startedAt,
        traceId: args.traceId,
        spanId: args.spanId,
      });

      return result;
    } catch (err) {
      const result = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };

      await ctx.runMutation(internal.toolsDb.logExecution, {
        appSlug: args.appSlug,
        sessionId: args.sessionId,
        toolName: args.toolName,
        parameters: args.parameters,
        result: JSON.stringify(result),
        status: "error",
        executedAt: startedAt,
        durationMs: Date.now() - startedAt,
        traceId: args.traceId,
        spanId: args.spanId,
      });

      return result;
    }
  },
});
