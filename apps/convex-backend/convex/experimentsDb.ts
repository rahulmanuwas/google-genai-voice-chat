import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Create a new experiment */
export const createExperiment = internalMutation({
  args: {
    appSlug: v.string(),
    name: v.string(),
    variants: v.string(), // JSON array of { id, weight, config }
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("experiments", {
      appSlug: args.appSlug,
      name: args.name,
      variants: args.variants,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

/** List experiments for an app */
export const listExperiments = internalQuery({
  args: { appSlug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("experiments")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .order("desc")
      .collect();
  },
});

/** Get a specific experiment by ID */
export const getExperiment = internalQuery({
  args: { experimentId: v.id("experiments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.experimentId);
  },
});

/** Check if session already has an exposure for this experiment */
export const getExposure = internalQuery({
  args: {
    experimentId: v.id("experiments"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const exposures = await ctx.db
      .query("experimentExposures")
      .withIndex("by_experiment", (q) => q.eq("experimentId", args.experimentId))
      .collect();
    return exposures.find((e) => e.sessionId === args.sessionId) ?? null;
  },
});

/** Log an experiment exposure */
export const logExposure = internalMutation({
  args: {
    appSlug: v.string(),
    experimentId: v.id("experiments"),
    sessionId: v.string(),
    variantId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("experimentExposures", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
