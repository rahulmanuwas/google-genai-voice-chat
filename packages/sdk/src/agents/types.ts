/**
 * Agent types for the Pi runtime layer.
 *
 * Pi provides access to 22+ providers (Anthropic, OpenAI, Google, DeepSeek,
 * Mistral, xAI, Groq, and more) through a single unified API.
 */

import type { AgentCallbacks } from '../agent/callbacks';

/** Configuration for creating a Pi agent */
export interface AgentConfig {
  /** Provider to use (Pi supports 22+: 'anthropic', 'openai', 'google', 'deepseek', etc.) */
  provider?: string;
  /** Override the default model for the selected provider */
  model?: string;
  /** 'riyaan' loads tools from the Convex backend. Or pass custom tool definitions. */
  tools?: 'riyaan' | ToolDefinition[];
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
  execute?: (params: Record<string, unknown>) => Promise<unknown>;
  /** External endpoint URL for server-side execution */
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
