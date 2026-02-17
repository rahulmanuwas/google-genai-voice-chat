/**
 * @genai-voice/sdk/agents — Pi-powered agent API.
 *
 * Create agents with access to 22+ providers (Anthropic, OpenAI, Google,
 * DeepSeek, Mistral, xAI, Groq, and more) through a single API.
 * Platform features (guardrails, knowledge, analytics, tools) apply
 * across all providers.
 *
 * @example
 * ```ts
 * import { createAgent } from '@genai-voice/sdk/agents';
 *
 * const agent = await createAgent({
 *   provider: 'google',
 *   model: 'gemini-3-flash-preview',
 * });
 *
 * await agent.prompt("What files are in the current directory?");
 * await agent.close();
 * ```
 */

// Core factory
export { createAgent, isAvailable, getAdapter } from './agent';

// Types
export type {
  AgentConfig,
  AgentHandle,
  AgentState,
  AgentEventType,
  ToolDefinition,
  ToolParameter,
  ProviderInfo,
  ModelInfo,
  PiOptions,
  ToolPolicyConfig,
  ToolPolicyLayer,
  ToolPolicyRule,
  ToolPolicyDecision,
  ToolPolicyBlockedTool,
  ModelFallbackCandidate,
  AuthProfileConfig,
  AgentRunMetadata,
  AgentPluginContext,
  AgentPluginService,
  AgentPluginServiceCleanup,
} from './types';

// Providers
export { getProviders, getDefaultModel } from './providers';

// Tools bridge
export { convertTool, convertTools } from './tools-bridge';
export { evaluateToolPolicy } from './tool-policy';

// Callbacks bridge
export { createCallbacksBridge } from './callbacks';

// Runtime adapter (for advanced usage like dynamic provider discovery)
export { PiRuntimeAdapter } from './pi-runtime';

// Plugin registry
export {
  registerTool,
  unregisterTool,
  listRegisteredTools,
  clearRegisteredTools,
  registerService,
  unregisterService,
  listRegisteredServices,
  clearRegisteredServices,
} from './plugins';
