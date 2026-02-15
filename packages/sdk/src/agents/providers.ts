/**
 * Static provider and model registry.
 *
 * For dynamic discovery of all 22+ providers, use:
 *   const adapter = getAdapter();
 *   const providers = await adapter.discoverProviders();
 */

import type { ProviderInfo } from './types';

/** Well-known providers with curated model lists */
const PROVIDERS: ProviderInfo[] = [
  {
    id: 'google',
    name: 'Google',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', contextWindow: 1000000 },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)', contextWindow: 1000000 },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1000000 },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1000000 },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', contextWindow: 200000 },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', contextWindow: 200000 },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', contextWindow: 200000 },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
      { id: 'o3', name: 'o3', contextWindow: 200000 },
      { id: 'o4-mini', name: 'o4-mini', contextWindow: 128000 },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', contextWindow: 64000 },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', contextWindow: 64000 },
    ],
  },
];

/** Get the static provider list */
export function getProviders(): ProviderInfo[] {
  return PROVIDERS;
}

/** Get the default model */
export function getDefaultModel(): { provider: string; model: string } {
  return { provider: 'google', model: 'gemini-3-flash-preview' };
}
