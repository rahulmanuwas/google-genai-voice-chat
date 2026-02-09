import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Update persona fields on an app */
export const updatePersona = internalMutation({
  args: {
    appId: v.id("apps"),
    personaName: v.optional(v.string()),
    personaGreeting: v.optional(v.string()),
    personaTone: v.optional(v.string()),
    preferredTerms: v.optional(v.string()),
    blockedTerms: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { appId, ...fields } = args;

    // Only patch fields that were explicitly provided
    const updates: Record<string, string> = {};
    if (fields.personaName !== undefined) updates.personaName = fields.personaName;
    if (fields.personaGreeting !== undefined) updates.personaGreeting = fields.personaGreeting;
    if (fields.personaTone !== undefined) updates.personaTone = fields.personaTone;
    if (fields.preferredTerms !== undefined) updates.preferredTerms = fields.preferredTerms;
    if (fields.blockedTerms !== undefined) updates.blockedTerms = fields.blockedTerms;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(appId, {
        ...updates,
        updatedAt: Date.now(),
      });
    }
  },
});

/** Assign a persona to an app */
export const assignPersonaToApp = internalMutation({
  args: {
    appId: v.id("apps"),
    personaId: v.id("personas"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.appId, {
      personaId: args.personaId,
      updatedAt: Date.now(),
    });
  },
});

/** Clear persona assignment from an app */
export const clearAppPersona = internalMutation({
  args: { appId: v.id("apps") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.appId, {
      personaId: undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Look up any app by slug (for persona assignment) */
export const getAppBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apps")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});
