import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const seedApp = internalMutation({
  args: {
    slug: v.string(),
    name: v.string(),
    secret: v.string(),
    modelId: v.string(),
    replyAsAudio: v.boolean(),
    systemPrompt: v.string(),
    tokenExpireMinutes: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("apps")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        secret: args.secret,
        modelId: args.modelId,
        replyAsAudio: args.replyAsAudio,
        systemPrompt: args.systemPrompt,
        tokenExpireMinutes: args.tokenExpireMinutes,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("apps", {
      slug: args.slug,
      name: args.name,
      secret: args.secret,
      isActive: true,
      modelId: args.modelId,
      replyAsAudio: args.replyAsAudio,
      systemPrompt: args.systemPrompt,
      tokenExpireMinutes: args.tokenExpireMinutes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
