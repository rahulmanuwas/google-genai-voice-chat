/**
 * Agent types for the Pi runtime layer.
 *
 * Pi provides access to 22+ providers (Anthropic, OpenAI, Google, DeepSeek,
 * Mistral, xAI, Groq, and more) through a single unified API.
 */

import type { AgentCallbacks } from './callbacks';

/** Configuration for creating a Pi agent */
export interface AgentConfig {
  /** Provider to use (Pi supports 22+: 'anthropic', 'openai', 'google', 'deepseek', etc.) */
  provider?: string;
  /** Override the default model for the selected provider */
  model?: string;
  /** 'riyaan' keeps Pi's built-in coding tools enabled. Or pass custom tool definitions. */
  tools?: 'riyaan' | ToolDefinition[];
  /** Layered allow/deny policy for tools */
  toolPolicy?: ToolPolicyConfig;
  /** Enable voice I/O (Gemini realtime via LiveKit) */
  voice?: boolean;
  /** Working directory for file-based operations */
  cwd?: string;
  /** Platform integration callbacks (guardrails, persistence, tracing) */
  callbacks?: AgentCallbacks;
  /** Pi-specific options */
  piOptions?: PiOptions;
}

/** Tool definition in Riyaan's platform format */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  execute?: (params: Record<string, unknown>) => Promise<unknown> | unknown;
  /** External endpoint URL for server-side execution when execute() is omitted */
  endpoint?: string;
}

/** Parameter schema for a tool */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  default?: unknown;
}

/** Pi-specific options */
export interface PiOptions {
  /** Thinking level: 'off' | 'low' | 'medium' | 'high' | 'xhigh'. Default: 'high' */
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high' | 'xhigh';
  /** Pi extensions to load */
  extensions?: string[];
  /** Pi skills to enable */
  skills?: string[];
  /** Optional provider/model fallback chain, tried in order after the primary model */
  fallbackCandidates?: ModelFallbackCandidate[];
  /** Auth profiles to rotate through when a provider/model fails */
  authProfiles?: AuthProfileConfig[];
  /** Max total attempts for a single prompt (default: fallbackCandidates/auth profiles length) */
  maxAttempts?: number;
  /** Delay between retry attempts in ms (default: 400) */
  retryDelayMs?: number;
  /** Context overflow recovery retries before hard failure (default: 2) */
  contextOverflowRetries?: number;
  /** Max chars to keep from each tool result during overflow recovery (default: 2500) */
  toolResultMaxChars?: number;
  /** Max chars to keep in synthetic history summaries used during recovery/fallback (default: 12000) */
  historySummaryMaxChars?: number;
  /** Cooldown duration after auth/rate-limit failures (default: 120000) */
  authCooldownMs?: number;
  /** Failure count required before cooldown applies (default: 1) */
  authFailureThreshold?: number;
}

/** A provider/model pair that can be used as fallback for prompt execution. */
export interface ModelFallbackCandidate {
  provider: string;
  model: string;
  /** Restrict this candidate to a specific auth profile id */
  authProfileId?: string;
}

/** Auth profile for provider key rotation and cooldown handling. */
export interface AuthProfileConfig {
  id: string;
  /** Lower value = higher priority (default: 100) */
  priority?: number;
  /** Optional provider allow-list for this profile */
  providers?: string[];
  /** Direct env vars to set when this profile is active (target env name -> value) */
  env?: Record<string, string>;
  /** Copy env vars from existing process env (target env name -> source env name) */
  envFrom?: Record<string, string>;
  /** Cooldown override in ms for this profile */
  cooldownMs?: number;
  /** Failure threshold override for this profile */
  maxFailures?: number;
}

export type ToolPolicyEffect = 'allow' | 'deny';

export interface ToolPolicyRule {
  effect: ToolPolicyEffect;
  /** Match by explicit tool names */
  tools?: string[];
  /** Match by named groups resolved via ToolPolicyConfig.groups */
  groups?: string[];
  /** Optional regex pattern matched against tool name */
  pattern?: string;
}

export interface ToolPolicyLayer {
  /** Restrictive allow-list for this layer */
  allow?: string[];
  /** Explicit deny-list for this layer */
  deny?: string[];
  /** Sequential rules evaluated after allow/deny */
  rules?: ToolPolicyRule[];
}

export interface ToolPolicyConfig {
  /** Named tool groups for allow/deny expansion */
  groups?: Record<string, string[]>;
  /** Baseline policy layer */
  global?: ToolPolicyLayer;
  /** Provider-specific policy layers */
  providers?: Record<string, ToolPolicyLayer>;
  /** Model-specific policy layers */
  models?: Record<string, ToolPolicyLayer>;
  /** Final session layer that runs last */
  session?: ToolPolicyLayer;
}

export interface ToolPolicyBlockedTool {
  name: string;
  reason: string;
}

export interface ToolPolicyDecision {
  allowedToolNames: string[];
  blockedTools: ToolPolicyBlockedTool[];
}

export interface AgentRunMetadata {
  runId: string;
  runtime: 'pi';
  provider: string;
  model: string;
  status: 'success' | 'error';
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
  metadata?: Record<string, unknown>;
}

export interface AgentPluginContext {
  sessionId: string;
  cwd: string;
  runtime: 'pi';
  getProvider: () => string;
  getModel: () => string;
  emitEvent?: (eventType: string, data?: Record<string, unknown>) => Promise<void>;
}

export type AgentPluginServiceCleanup = (() => Promise<void> | void) | void;

export interface AgentPluginService {
  name: string;
  start?: (context: AgentPluginContext) => Promise<AgentPluginServiceCleanup> | AgentPluginServiceCleanup;
  stop?: (context: AgentPluginContext) => Promise<void> | void;
}

/** Handle to a running agent session */
export interface AgentHandle {
  /** Send a text prompt to the agent */
  prompt(text: string): Promise<string>;
  /** Get the current agent state */
  getState(): AgentState;
  /** Gracefully close the agent session */
  close(): Promise<void>;
  /** Subscribe to agent events */
  on(event: AgentEventType, handler: (...args: unknown[]) => void): void;
  /** Remove an event listener */
  off(event: AgentEventType, handler: (...args: unknown[]) => void): void;
  /** Unique session identifier */
  sessionId: string;
}

/** Agent lifecycle states */
export type AgentState =
  | 'initializing'
  | 'idle'
  | 'processing'
  | 'speaking'
  | 'error'
  | 'closed';

/** Events emitted by the agent */
export type AgentEventType =
  | 'state_change'
  | 'response'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'close';

/** Provider metadata */
export interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
}

/** Model metadata */
export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  supportsVoice?: boolean;
}
