// ─── Overview ──────────────────────────────────────────────────
export interface OverviewData {
  totalConversations: number;
  resolutionRate: number;
  handoffRate: number;
  avgCSAT: number | null;
  avgDurationMs: number;
  toolSuccessRate: number | null;
  toolUsage: Record<string, number>;
  totalToolExecutions: number;
  totalGuardrailViolations: number;
  pendingHandoffs: number;
  unresolvedGaps: number;
  conversationsLast24h: number;
  handoffsLast24h: number;
}

// ─── Insights ──────────────────────────────────────────────────
export interface Insight {
  _id: string;
  appSlug: string;
  period: string;
  totalConversations: number;
  resolutionRate: number;
  handoffRate: number;
  avgDurationMs: number;
  avgCSAT?: number;
  topTopics: string;
  knowledgeGaps: string;
  toolUsage: string;
  computedAt: number;
}

// ─── Handoffs ──────────────────────────────────────────────────
export interface Handoff {
  _id: string;
  appSlug: string;
  sessionId: string;
  channel: string;
  reason: string;
  reasonDetail?: string;
  status: string;
  priority: string;
  transcript: string;
  aiSummary?: string;
  assignedAgent?: string;
  customerData?: string;
  createdAt: number;
  claimedAt?: number;
  resolvedAt?: number;
}

// ─── Tools ─────────────────────────────────────────────────────
export interface Tool {
  _id: string;
  appSlug: string;
  name: string;
  description: string;
  parametersSchema: string;
  endpoint?: string;
  headers?: string;
  httpMethod?: string;
  requiresConfirmation: boolean;
  requiresAuth: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// ─── Guardrails ────────────────────────────────────────────────
export interface GuardrailRule {
  _id: string;
  appSlug: string;
  type: string;
  pattern: string;
  action: string;
  userMessage?: string;
  isActive: boolean;
  createdAt: number;
}

// ─── Knowledge ─────────────────────────────────────────────────
export interface KnowledgeGap {
  _id: string;
  appSlug: string;
  sessionId: string;
  query: string;
  bestMatchScore: number;
  createdAt: number;
  resolved: boolean;
}

export interface KnowledgeSearchResult {
  _id: string;
  title: string;
  content: string;
  category: string;
  _score: number;
}

// ─── Persona ───────────────────────────────────────────────────
export interface PersonaConfig {
  personaName: string | null;
  personaGreeting: string | null;
  personaTone: string | null;
  preferredTerms: string | null;
  blockedTerms: string | null;
}

// ─── Experiments ───────────────────────────────────────────────
export interface ExperimentVariant {
  id: string;
  weight: number;
  config?: Record<string, unknown>;
}

export interface Experiment {
  _id: string;
  appSlug: string;
  name: string;
  variants: ExperimentVariant[];
  isActive: boolean;
  createdAt: number;
}

// ─── Conversations ─────────────────────────────────────────────
export interface Conversation {
  _id: string;
  appSlug: string;
  sessionId: string;
  channel?: string;
  status?: string;
  startedAt: number;
  endedAt?: number;
  messageCount: number;
  transcript?: string;
  resolution?: string;
  experimentVariant?: string;
}

// ─── Tool Executions ───────────────────────────────────────────
export interface ToolExecution {
  _id: string;
  appSlug: string;
  sessionId: string;
  toolName: string;
  parameters: string;
  result?: string;
  status: string;
  executedAt: number;
  durationMs: number;
}

// ─── Guardrail Violations ──────────────────────────────────────
export interface GuardrailViolation {
  _id: string;
  appSlug: string;
  sessionId: string;
  ruleId: string;
  type: string;
  direction: string;
  content: string;
  action: string;
  createdAt: number;
}

// ─── Knowledge Documents ───────────────────────────────────────
export interface KnowledgeDocument {
  _id: string;
  appSlug: string;
  title: string;
  content: string;
  category: string;
  sourceType: string;
  lastUpdated: number;
  updatedBy?: string;
}

// ─── Messages ──────────────────────────────────────────────────
export interface Message {
  _id: string;
  appSlug: string;
  sessionId: string;
  roomName?: string;
  participantIdentity: string;
  role: string;
  content: string;
  isFinal: boolean;
  language?: string;
  createdAt: number;
}
