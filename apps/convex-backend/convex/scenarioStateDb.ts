import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Get the current scenario state for an app */
export const getState = internalQuery({
  args: { appSlug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scenarioState")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .first();
  },
});

/** Upsert scenario state — creates if missing, updates if exists */
export const upsertState = internalMutation({
  args: {
    appSlug: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("scenarioState")
      .withIndex("by_app", (q) => q.eq("appSlug", args.appSlug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        state: args.state,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("scenarioState", {
        appSlug: args.appSlug,
        state: args.state,
        updatedAt: Date.now(),
      });
    }
  },
});
