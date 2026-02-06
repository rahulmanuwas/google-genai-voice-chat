/**
 * Tool/Action framework types.
 *
 * Tools let the AI agent execute real actions — look up orders,
 * process returns, book appointments, modify subscriptions —
 * not just answer questions.
 */

/** JSON Schema subset for tool parameter validation */
export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: string[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

/** Schema describing a tool's parameters */
export interface ToolParametersSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

/** Tool definition — registered per app */
export interface ToolDefinition {
  /** Unique name (e.g. "lookupOrder", "cancelSubscription") */
  name: string;

  /** Human-readable description sent to the LLM as function declaration */
  description: string;

  /** JSON Schema for the tool's input parameters */
  parameters: ToolParametersSchema;

  /** Whether to prompt the user for confirmation before execution */
  requiresConfirmation?: boolean;

  /** Whether this tool requires authenticated user context */
  requiresAuth?: boolean;
}

/** Context provided to tool execution */
export interface ToolContext {
  appSlug: string;
  sessionId: string;
  userId?: string;
  channel: import('./types').Channel;
  metadata?: Record<string, unknown>;
}

/** Result of a tool execution */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** If set, this message is shown to the user directly */
  displayMessage?: string;
}

/** Execution status for audit logging */
export type ToolExecutionStatus = 'pending' | 'success' | 'error' | 'confirmation_pending' | 'cancelled';

/** Audit record of a tool execution */
export interface ToolExecution {
  id: string;
  appSlug: string;
  sessionId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  result?: ToolResult;
  status: ToolExecutionStatus;
  executedAt: number;
  durationMs: number;
}
