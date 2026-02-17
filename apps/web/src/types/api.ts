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
  necessityScore?: number;
  resolutionQuality?: 'excellent' | 'good' | 'poor';
  agentFeedback?: string;
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
  score: number;
  sourceType?: string;
  sourceSessionId?: string;
}

export interface KnowledgeSearchMetrics {
  totalSearches: number;
  avgTopScore: number;
  gapRate: number;
}

// ─── Persona ───────────────────────────────────────────────────
export interface PersonaConfig {
  personaName: string | null;
  personaGreeting: string | null;
  personaTone: string | null;
  preferredTerms: string | null;
  blockedTerms: string | null;
}

export interface Persona {
  _id: string;
  name: string;
  systemPrompt: string;
  personaName?: string;
  personaGreeting?: string;
  personaTone?: string;
  preferredTerms?: string;
  blockedTerms?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
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

// ─── QA Framework ───────────────────────────────────────────────
export interface QaScenarioTurn {
  role: 'user';
  content: string;
}

export interface QaExpectations {
  shouldContain?: string[];
  shouldNotContain?: string[];
  shouldCallTool?: string | string[];
  shouldHandoff?: boolean;
}

export interface LlmJudgeCriterion {
  name: string;
  description: string;
  weight?: number;
}

export interface QaScenario {
  _id: string;
  appSlug: string;
  name: string;
  description?: string;
  turns: QaScenarioTurn[];
  expectations: QaExpectations;
  tags: string[];
  evaluatorType: 'string_match' | 'llm_judge' | 'hybrid';
  llmJudgeCriteria: LlmJudgeCriterion[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface QaCheckResult {
  check: string;
  passed: boolean;
  detail: string;
}

export interface QaRunInput {
  responseText?: string;
  calledTools?: string[];
  handoffTriggered?: boolean;
}

export interface LlmJudgeScore {
  criterion: string;
  passed: boolean;
  reasoning: string;
}

export interface QaRun {
  _id: string;
  appSlug: string;
  scenarioId: string;
  scenarioName: string;
  sessionId?: string;
  status: string;
  score: number;
  totalChecks: number;
  passedChecks: number;
  results: QaCheckResult[];
  input: QaRunInput;
  executionMode: 'manual' | 'automated' | 'ci';
  llmJudgeScores: LlmJudgeScore[];
  createdAt: number;
  completedAt: number;
}

// ─── Outbound Trigger Engine ───────────────────────────────────
export interface OutboundTrigger {
  _id: string;
  appSlug: string;
  name: string;
  description?: string;
  eventType: string;
  channel: string;
  condition: Record<string, unknown>;
  template: string;
  throttleMaxPerWindow: number;
  throttleWindowMs: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  lastTriggeredAt?: number;
}

export interface OutboundDispatch {
  _id: string;
  appSlug: string;
  triggerId: string;
  triggerName: string;
  eventType: string;
  channel: string;
  recipient: string;
  payload: Record<string, unknown>;
  status: string;
  reason?: string;
  createdAt: number;
  sentAt?: number;
}

// ─── Conversation Annotations ─────────────────────────────────
export interface ConversationAnnotation {
  _id: string;
  appSlug: string;
  sessionId: string;
  conversationId?: string;
  qualityRating: 'good' | 'bad' | 'mixed';
  failureModes: string[];
  notes: string;
  annotatedBy: string;
  createdAt: number;
  updatedAt: number;
}

export const FAILURE_MODES = [
  'hallucination',
  'wrong_tool',
  'tone_issue',
  'premature_handoff',
  'missed_handoff',
  'incomplete_response',
  'context_loss',
  'other',
] as const;

export type FailureMode = (typeof FAILURE_MODES)[number];

// ─── Trace Timeline ──────────────────────────────────────────────
export interface TraceTimelineEvent {
  type: 'event' | 'message' | 'tool_execution' | 'knowledge_search' | 'guardrail_violation' | 'handoff';
  timestamp: number;
  data: Record<string, unknown>;
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
  annotatedCorrectness?: 'true_positive' | 'false_positive';
  annotatedBy?: string;
  annotatedAt?: number;
  createdAt: number;
}

// ─── Agent Sessions ──────────────────────────────────────────────
export interface AgentSession {
  _id: string;
  appSlug: string;
  sessionId: string;
  runtime: string;
  provider?: string;
  model?: string;
  status: string;
  branchId?: string;
  threadId?: string;
  cwd?: string;
  runCount?: number;
  lastRunAt?: number;
  lastFailureReason?: string;
  createdAt: number;
  endedAt?: number;
}

export interface AgentSessionRun {
  _id: string;
  appSlug: string;
  sessionId: string;
  runId: string;
  runtime: string;
  provider: string;
  model: string;
  status: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  attemptCount: number;
  fallbackCount: number;
  contextRecoveryCount: number;
  toolOutputTruncatedChars: number;
  promptChars: number;
  responseChars: number;
  authProfileId?: string;
  failureReason?: string;
  errorMessage?: string;
  metadata?: string;
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
  traceId?: string;
  createdAt: number;
}
