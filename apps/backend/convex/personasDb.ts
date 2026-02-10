import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** List all active personas */
export const listPersonas = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("personas")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

/** Get a single persona by ID */
export const getPersonaById = internalQuery({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Create a new persona */
export const createPersona = internalMutation({
  args: {
    name: v.string(),
    systemPrompt: v.string(),
    voice: v.optional(v.string()),
    personaName: v.optional(v.string()),
    personaGreeting: v.optional(v.string()),
    personaTone: v.optional(v.string()),
    preferredTerms: v.optional(v.string()),
    blockedTerms: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("personas", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update fields on an existing persona */
export const updatePersonaById = internalMutation({
  args: {
    id: v.id("personas"),
    name: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    voice: v.optional(v.string()),
    personaName: v.optional(v.string()),
    personaGreeting: v.optional(v.string()),
    personaTone: v.optional(v.string()),
    preferredTerms: v.optional(v.string()),
    blockedTerms: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) updates[k] = val;
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
    }
  },
});

/** Soft-delete a persona (set isActive: false) */
export const deletePersona = internalMutation({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false, updatedAt: Date.now() });
  },
});
