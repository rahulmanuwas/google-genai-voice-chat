import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Existing tables ───────────────────────────────────────────

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
    // Persona (brand voice)
    personaId: v.optional(v.id("personas")),
    personaName: v.optional(v.string()),
    personaGreeting: v.optional(v.string()),
    personaTone: v.optional(v.string()),
    preferredTerms: v.optional(v.string()),
    blockedTerms: v.optional(v.string()),
    // Guardrails config
    guardrailsEnabled: v.optional(v.boolean()),
    maxActionsPerTurn: v.optional(v.float64()),
    // Handoff config
    handoffEnabled: v.optional(v.boolean()),
    handoffWebhookUrl: v.optional(v.string()),
    handoffExpirationSeconds: v.optional(v.float64()),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  }).index("by_slug", ["slug"]),

  conversations: defineTable({
    appSlug: v.string(),
    sessionId: v.string(),
    channel: v.optional(v.string()),
    status: v.optional(v.string()),
    startedAt: v.float64(),
    endedAt: v.optional(v.float64()),
    messageCount: v.float64(),
    transcript: v.optional(v.string()),
    resolution: v.optional(v.string()),
    experimentVariant: v.optional(v.string()),
  })
    .index("by_app", ["appSlug"])
    .index("by_session", ["sessionId"])
    .index("by_app_session", ["appSlug", "sessionId"])
    .index("by_app_status", ["appSlug", "status"])
    .index("by_app_startedAt", ["appSlug", "startedAt"]),

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

  // ─── Tool / Action Framework ───────────────────────────────────

  tools: defineTable({
    appSlug: v.string(),
    name: v.string(),
    description: v.string(),
    parametersSchema: v.string(),
    endpoint: v.optional(v.string()),
    headers: v.optional(v.string()),
    httpMethod: v.optional(v.string()),
    requiresConfirmation: v.boolean(),
    requiresAuth: v.boolean(),
    isActive: v.boolean(),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_app", ["appSlug"])
    .index("by_app_name", ["appSlug", "name"]),

  toolExecutions: defineTable({
    appSlug: v.string(),
    sessionId: v.string(),
    toolName: v.string(),
    parameters: v.string(),
    result: v.optional(v.string()),
    status: v.string(),
    executedAt: v.float64(),
    durationMs: v.float64(),
  })
    .index("by_session", ["sessionId"])
    .index("by_app", ["appSlug"])
    .index("by_app_status", ["appSlug", "status"]),

  // ─── Human Handoff ─────────────────────────────────────────────

  handoffs: defineTable({
    appSlug: v.string(),
    sessionId: v.string(),
    channel: v.string(),
    reason: v.string(),
    reasonDetail: v.optional(v.string()),
    status: v.string(),
    priority: v.string(),
    transcript: v.string(),
    aiSummary: v.optional(v.string()),
    assignedAgent: v.optional(v.string()),
    customerData: v.optional(v.string()),
    createdAt: v.float64(),
    claimedAt: v.optional(v.float64()),
    resolvedAt: v.optional(v.float64()),
  })
    .index("by_status", ["status"])
    .index("by_app", ["appSlug"])
    .index("by_app_status", ["appSlug", "status"])
    .index("by_session", ["sessionId"])
    .index("by_app_createdAt", ["appSlug", "createdAt"]),

  // ─── Guardrails & Trust/Safety ─────────────────────────────────

  guardrailRules: defineTable({
    appSlug: v.string(),
    type: v.string(),
    pattern: v.string(),
    action: v.string(),
    userMessage: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.float64(),
  })
    .index("by_app", ["appSlug"])
    .index("by_app_type", ["appSlug", "type"]),

  guardrailViolations: defineTable({
    appSlug: v.string(),
    sessionId: v.string(),
    ruleId: v.id("guardrailRules"),
    type: v.string(),
    direction: v.string(),
    content: v.string(),
    action: v.string(),
    createdAt: v.float64(),
  })
    .index("by_app", ["appSlug"])
    .index("by_session", ["sessionId"]),

  // ─── Knowledge Management (RAG) ───────────────────────────────

  knowledgeDocuments: defineTable({
    appSlug: v.string(),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    sourceType: v.string(),
    embedding: v.array(v.float64()),
    lastUpdated: v.float64(),
    updatedBy: v.optional(v.string()),
  })
    .index("by_app", ["appSlug"])
    .index("by_app_title", ["appSlug", "title"])
    .index("by_app_category", ["appSlug", "category"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["appSlug", "category"],
    }),

  knowledgeGaps: defineTable({
    appSlug: v.string(),
    sessionId: v.string(),
    query: v.string(),
    bestMatchScore: v.float64(),
    createdAt: v.float64(),
    resolved: v.boolean(),
  })
    .index("by_app", ["appSlug"])
    .index("by_app_resolved", ["appSlug", "resolved"]),

  // ─── Analytics & Insights ──────────────────────────────────────

  insights: defineTable({
    appSlug: v.string(),
    period: v.string(),
    totalConversations: v.float64(),
    resolutionRate: v.float64(),
    handoffRate: v.float64(),
    avgDurationMs: v.float64(),
    avgCSAT: v.optional(v.float64()),
    topTopics: v.string(),
    knowledgeGaps: v.string(),
    toolUsage: v.string(),
    computedAt: v.float64(),
  }).index("by_app_period", ["appSlug", "period"]),

  csatRatings: defineTable({
    appSlug: v.string(),
    sessionId: v.string(),
    rating: v.float64(),
    comment: v.optional(v.string()),
    createdAt: v.float64(),
  })
    .index("by_app", ["appSlug"])
    .index("by_session", ["sessionId"]),

  // ─── A/B Testing ───────────────────────────────────────────────

  experiments: defineTable({
    appSlug: v.string(),
    name: v.string(),
    variants: v.string(),
    isActive: v.boolean(),
    createdAt: v.float64(),
  }).index("by_app", ["appSlug"]),

  experimentExposures: defineTable({
    appSlug: v.string(),
    experimentId: v.id("experiments"),
    sessionId: v.string(),
    variantId: v.string(),
    createdAt: v.float64(),
  })
    .index("by_experiment", ["experimentId"])
    .index("by_session", ["sessionId"]),

  // ─── Messages (Transcription Storage) ────────────────────────

  messages: defineTable({
    appSlug: v.string(),
    sessionId: v.string(),
    roomName: v.optional(v.string()),
    participantIdentity: v.string(),
    role: v.string(),           // 'user' | 'agent'
    content: v.string(),
    isFinal: v.boolean(),
    language: v.optional(v.string()),
    createdAt: v.float64(),
  })
    .index("by_session", ["sessionId"])
    .index("by_app_session", ["appSlug", "sessionId"])
    .index("by_room", ["roomName"]),

  // ─── Session Tokens ──────────────────────────────────────────
  sessions: defineTable({
    appSlug: v.string(),
    token: v.string(),
    expiresAt: v.float64(),
    createdAt: v.float64(),
  })
    .index("by_token", ["token"])
    .index("by_app", ["appSlug"]),

  // ─── LiveKit Rooms & Participants ─────────────────────────────

  livekitRooms: defineTable({
    appSlug: v.string(),
    roomName: v.string(),
    sessionId: v.string(),
    status: v.string(), // 'waiting' | 'active' | 'ended'
    maxParticipants: v.float64(),
    emptyTimeout: v.float64(),
    enableRecording: v.boolean(),
    participantCount: v.float64(),
    createdAt: v.float64(),
    endedAt: v.optional(v.float64()),
  })
    .index("by_app", ["appSlug"])
    .index("by_room_name", ["roomName"])
    .index("by_app_status", ["appSlug", "status"])
    .index("by_session", ["sessionId"]),

  livekitParticipants: defineTable({
    appSlug: v.string(),
    roomId: v.id("livekitRooms"),
    identity: v.string(),
    name: v.optional(v.string()),
    role: v.string(), // 'user' | 'agent' | 'observer'
    joinedAt: v.float64(),
    leftAt: v.optional(v.float64()),
  })
    .index("by_room", ["roomId"])
    .index("by_identity", ["identity"]),

  // ─── Personas (Reusable Brand Voices) ─────────────────────────

  personas: defineTable({
    name: v.string(),
    systemPrompt: v.string(),
    personaName: v.optional(v.string()),
    personaGreeting: v.optional(v.string()),
    personaTone: v.optional(v.string()),
    preferredTerms: v.optional(v.string()),
    blockedTerms: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  }).index("by_active", ["isActive"]),

  // ─── Scenario State (Live Demo Data) ──────────────────────────

  scenarioState: defineTable({
    appSlug: v.string(),
    state: v.string(), // JSON blob
    updatedAt: v.float64(),
  }).index("by_app", ["appSlug"]),
});
