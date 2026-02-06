/**
 * Guardrail and trust/safety types.
 *
 * Guardrails validate both user inputs and AI outputs
 * to prevent hallucination, off-topic responses, PII leakage,
 * jailbreaks, and brand-inconsistent behavior.
 */

/** Types of guardrail rules */
export type GuardrailType =
  | 'topic_boundary'
  | 'blocked_topic'
  | 'pii_filter'
  | 'jailbreak_detection'
  | 'response_validation'
  | 'max_actions_per_turn'
  | 'required_confirmation'
  | 'custom';

/** What happens when a guardrail is violated */
export type GuardrailAction = 'block' | 'warn' | 'log' | 'redirect';

/** A guardrail rule definition */
export interface GuardrailRule {
  id: string;
  appSlug: string;
  type: GuardrailType;
  /** Regex pattern, keyword list, or custom config (JSON) */
  pattern: string;
  action: GuardrailAction;
  /** Message shown to user when blocked/warned */
  userMessage?: string;
  isActive: boolean;
}

/** Direction of the message being checked */
export type GuardrailDirection = 'input' | 'output';

/** A recorded guardrail violation */
export interface GuardrailViolation {
  id: string;
  appSlug: string;
  sessionId: string;
  ruleId: string;
  type: GuardrailType;
  direction: GuardrailDirection;
  content: string;
  action: GuardrailAction;
  createdAt: number;
}

/** Guardrail configuration per app */
export interface GuardrailConfig {
  enabled: boolean;
  rules: GuardrailRule[];
  /** Max tool calls allowed per conversation turn */
  maxActionsPerTurn: number;
  /** Log all violations for audit (even when action is 'log') */
  auditLog: boolean;
}
