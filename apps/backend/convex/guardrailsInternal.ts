import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Evaluate content against all active guardrail rules for an app */
export const evaluateContent = internalMutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    content: v.string(),
    direction: v.string(),
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("guardrailRules")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .collect();

    const activeRules = rules.filter((r) => r.isActive);
    const violations: Array<{
      ruleId: string;
      type: string;
      action: string;
      userMessage?: string;
    }> = [];
    let blocked = false;

    for (const rule of activeRules) {
      let matched = false;

      switch (rule.type) {
        case "blocked_topic":
        case "topic_boundary": {
          // Pattern is a comma-separated list of keywords
          const keywords = rule.pattern
            .split(",")
            .map((k) => k.trim().toLowerCase());
          const contentLower = args.content.toLowerCase();
          matched = keywords.some((kw) => contentLower.includes(kw));
          break;
        }
        case "pii_filter": {
          // Pattern is a regex for PII detection
          try {
            const regex = new RegExp(rule.pattern, "gi");
            matched = regex.test(args.content);
          } catch (err) {
            console.warn(
              `Invalid regex in guardrail rule ${rule._id}: ${rule.pattern}`,
              err instanceof Error ? err.message : String(err)
            );
          }
          break;
        }
        case "jailbreak_detection": {
          // Pattern is a comma-separated list of jailbreak indicators
          const indicators = rule.pattern
            .split(",")
            .map((k) => k.trim().toLowerCase());
          const contentLower = args.content.toLowerCase();
          matched = indicators.some((ind) => contentLower.includes(ind));
          break;
        }
        default: {
          // Custom or unknown type: try regex match
          try {
            const regex = new RegExp(rule.pattern, "gi");
            matched = regex.test(args.content);
          } catch (err) {
            console.warn(
              `Invalid regex in guardrail rule ${rule._id} (type: ${rule.type}): ${rule.pattern}`,
              err instanceof Error ? err.message : String(err)
            );
          }
        }
      }

      if (matched) {
        if (rule.action === "block") blocked = true;

        violations.push({
          ruleId: rule._id,
          type: rule.type,
          action: rule.action,
          userMessage: rule.userMessage ?? undefined,
        });

        // Log the violation
        await ctx.db.insert("guardrailViolations", {
          appSlug: args.appSlug,
          sessionId: args.sessionId,
          ruleId: rule._id,
          type: rule.type,
          direction: args.direction,
          content: args.content.slice(0, 500), // Truncate for storage
          action: rule.action,
          createdAt: Date.now(),
        });
      }
    }

    return {
      allowed: !blocked,
      violations,
    };
  },
});

/** Create a guardrail rule */
export const createRule = internalMutation({
  args: {
    appSlug: v.string(),
    type: v.string(),
    pattern: v.string(),
    action: v.string(),
    userMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("guardrailRules", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

/** Get all rules (optionally filtered by app) */
export const getRules = internalQuery({
  args: { appSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.appSlug) {
      return await ctx.db
        .query("guardrailRules")
        .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!))
        .collect();
    }
    return await ctx.db.query("guardrailRules").collect();
  },
});

/** Annotate a violation's correctness (true positive / false positive) */
export const annotateViolation = internalMutation({
  args: {
    violationId: v.id("guardrailViolations"),
    annotatedCorrectness: v.string(), // 'true_positive' | 'false_positive'
    annotatedBy: v.string(),
    appSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const violation = await ctx.db.get(args.violationId);
    if (!violation) throw new Error("Violation not found");
    if (violation.appSlug !== args.appSlug) {
      throw new Error("Violation does not belong to this app");
    }
    await ctx.db.patch(args.violationId, {
      annotatedCorrectness: args.annotatedCorrectness,
      annotatedBy: args.annotatedBy,
      annotatedAt: Date.now(),
    });
  },
});

/** List guardrail violations (optionally filtered by app) */
export const listViolations = internalQuery({
  args: { appSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.appSlug) {
      return await ctx.db
        .query("guardrailViolations")
        .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug!))
        .order("desc")
        .take(100);
    }
    return await ctx.db.query("guardrailViolations").order("desc").take(100);
  },
});
