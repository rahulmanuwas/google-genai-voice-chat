import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  apps: defineTable({
    slug: v.string(),
    name: v.string(),
    secret: v.string(),
    isActive: v.boolean(),
    modelId: v.string(),
    replyAsAudio: v.boolean(),
    temperature: v.optional(v.float64()),
    systemPrompt: v.string(),
    tokenExpireMinutes: v.optional(v.float64()),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  }).index("by_slug", ["slug"]),

  conversations: defineTable({
    appSlug: v.string(),
    sessionId: v.string(),
    startedAt: v.float64(),
    endedAt: v.optional(v.float64()),
    messageCount: v.float64(),
    transcript: v.optional(v.string()),
  })
    .index("by_app", ["appSlug"])
    .index("by_session", ["sessionId"])
    .index("by_app_session", ["appSlug", "sessionId"]),

  events: defineTable({
    appSlug: v.string(),
    sessionId: v.string(),
    eventType: v.string(),
    ts: v.float64(),
    data: v.optional(v.string()),
  })
    .index("by_app", ["appSlug"])
    .index("by_session", ["sessionId"])
    .index("by_app_session", ["appSlug", "sessionId"]),
});
