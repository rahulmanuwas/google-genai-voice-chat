import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Upsert an app record with persona and guardrails config */
export const seedScenarioApp = internalMutation({
  args: {
    slug: v.string(),
    name: v.string(),
    secret: v.string(),
    systemPrompt: v.string(),
    personaName: v.string(),
    personaGreeting: v.string(),
    personaTone: v.string(),
    guardrailsEnabled: v.boolean(),
    tools: v.array(
      v.object({
        name: v.string(),
        description: v.string(),
        parametersSchema: v.string(),
        requiresConfirmation: v.boolean(),
        requiresAuth: v.boolean(),
      })
    ),
    guardrailRules: v.array(
      v.object({
        type: v.string(),
        pattern: v.string(),
        action: v.string(),
        userMessage: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // ── Upsert app ──
    const existing = await ctx.db
      .query("apps")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        secret: args.secret,
        systemPrompt: args.systemPrompt,
        personaName: args.personaName,
        personaGreeting: args.personaGreeting,
        personaTone: args.personaTone,
        guardrailsEnabled: args.guardrailsEnabled,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("apps", {
        slug: args.slug,
        name: args.name,
        secret: args.secret,
        isActive: true,
        modelId: "gemini-2.5-flash-native-audio-preview-12-2025",
        replyAsAudio: true,
        systemPrompt: args.systemPrompt,
        personaName: args.personaName,
        personaGreeting: args.personaGreeting,
        personaTone: args.personaTone,
        guardrailsEnabled: args.guardrailsEnabled,
        createdAt: now,
        updatedAt: now,
      });
    }

    // ── Upsert tools (by appSlug + name) ──
    for (const tool of args.tools) {
      const existingTool = await ctx.db
        .query("tools")
        .withIndex("by_app_name", (q) =>
          q.eq("appSlug", args.slug).eq("name", tool.name)
        )
        .first();

      if (existingTool) {
        await ctx.db.patch(existingTool._id, {
          description: tool.description,
          parametersSchema: tool.parametersSchema,
          requiresConfirmation: tool.requiresConfirmation,
          requiresAuth: tool.requiresAuth,
          isActive: true,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("tools", {
          appSlug: args.slug,
          name: tool.name,
          description: tool.description,
          parametersSchema: tool.parametersSchema,
          requiresConfirmation: tool.requiresConfirmation,
          requiresAuth: tool.requiresAuth,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // ── Insert guardrail rules (skip duplicates by type + pattern) ──
    for (const rule of args.guardrailRules) {
      const existingRule = await ctx.db
        .query("guardrailRules")
        .withIndex("by_app_type", (q) =>
          q.eq("appSlug", args.slug).eq("type", rule.type)
        )
        .filter((q) => q.eq(q.field("pattern"), rule.pattern))
        .first();

      if (!existingRule) {
        await ctx.db.insert("guardrailRules", {
          appSlug: args.slug,
          type: rule.type,
          pattern: rule.pattern,
          action: rule.action,
          userMessage: rule.userMessage,
          isActive: true,
          createdAt: now,
        });
      }
    }
  },
});
