/**
 * Human handoff types.
 *
 * When the AI can't resolve an issue — or the user explicitly asks —
 * the conversation is escalated to a human agent with full context.
 */

import type { Message, Channel } from './types';

/** Why a handoff was triggered */
export type HandoffReason =
  | 'user_requested'
  | 'low_confidence'
  | 'sentiment_negative'
  | 'tool_failed'
  | 'topic_boundary'
  | 'max_turns_exceeded'
  | 'guardrail_violation'
  | 'custom';

/** Handoff lifecycle status */
export type HandoffStatus = 'pending' | 'claimed' | 'resolved' | 'expired';

/** Priority level for handoff routing */
export type HandoffPriority = 'low' | 'normal' | 'high' | 'urgent';

/** A handoff request from AI to human agent */
export interface Handoff {
  id: string;
  appSlug: string;
  sessionId: string;
  channel: Channel;
  reason: HandoffReason;
  reasonDetail?: string;
  status: HandoffStatus;
  priority: HandoffPriority;
  transcript: Message[];
  aiSummary?: string;
  assignedAgent?: string;
  customerData?: Record<string, unknown>;
  createdAt: number;
  claimedAt?: number;
  resolvedAt?: number;
}

/** Configuration for automatic handoff triggers */
export interface HandoffTrigger {
  type: HandoffReason;
  /** For sentiment: threshold (0-1). For max_turns: turn count. */
  threshold?: number;
  /** Keywords that trigger handoff (for user_requested) */
  keywords?: string[];
  /** Custom evaluator function name (Convex action) */
  evaluator?: string;
}

/** Handoff configuration per app */
export interface HandoffConfig {
  enabled: boolean;
  triggers: HandoffTrigger[];
  defaultPriority: HandoffPriority;
  /** Max seconds before an unclaimed handoff expires */
  expirationSeconds: number;
  /** Webhook URL to notify external systems (Zendesk, Salesforce, etc.) */
  webhookUrl?: string;
}
