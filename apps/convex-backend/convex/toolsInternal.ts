"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/** Execute a tool by calling its registered endpoint */
export const executeToolAction = internalAction({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    toolName: v.string(),
    parameters: v.string(),
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
      });
      return result;
    }

    if (!fullTool.endpoint) {
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
      });

      return result;
    }
  },
});
