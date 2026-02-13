import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Create or update a QA scenario by app + name */
export const upsertScenario = internalMutation({
  args: {
    appSlug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    turns: v.string(),
    expectations: v.string(),
    tags: v.optional(v.string()),
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
      isActive: args.isActive,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** List QA scenarios with optional app and active filter */
export const listScenarios = internalQuery({
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
export const getScenario = internalQuery({
  args: { scenarioId: v.id("qaScenarios") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.scenarioId);
  },
});

/** Store a QA run result */
export const createRun = internalMutation({
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
export const listRuns = internalQuery({
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
