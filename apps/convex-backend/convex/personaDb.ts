import { internalMutation } from "./_generated/server";
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
