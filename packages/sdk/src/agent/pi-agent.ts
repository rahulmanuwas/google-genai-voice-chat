/**
 * Agent factory.
 *
 * `createAgent()` creates a Pi agent session with access to 22+ providers.
 */

import type { AgentConfig, AgentHandle } from './pi-types';
import { PiRuntimeAdapter } from './pi-runtime';

const adapter = new PiRuntimeAdapter();

/**
 * Create an agent session powered by Pi.
 *
 * @example
 * ```ts
 * const agent = await createAgent({
 *   provider: 'google',
 *   model: 'gemini-3-flash-preview',
 * });
 *
 * const response = await agent.prompt("What files are in the current directory?");
 * await agent.close();
 * ```
 */
export async function createAgent(config: AgentConfig = {}): Promise<AgentHandle> {
  return adapter.create(config);
}

/**
 * Check if the Pi runtime SDK is installed.
 */
export function isAvailable(): boolean {
  return adapter.isAvailable();
}

/**
 * Get the Pi runtime adapter (for advanced usage like dynamic provider discovery).
 */
export function getAdapter(): PiRuntimeAdapter {
  return adapter;
}
