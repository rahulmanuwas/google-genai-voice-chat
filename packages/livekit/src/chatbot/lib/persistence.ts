/**
 * Pluggable persistence for text chat messages.
 */

import type { ChatMessage } from './types';

/** Adapter interface for message persistence */
export interface PersistenceAdapter {
  load(key: string): Promise<ChatMessage[]>;
  save(key: string, messages: ChatMessage[]): Promise<void>;
  clear(key: string): Promise<void>;
}

/** No-op adapter (default — no persistence) */
export const NonePersistence: PersistenceAdapter = {
  async load() { return []; },
  async save() {},
  async clear() {},
};

/** localStorage-backed persistence adapter */
export const LocalStoragePersistence: PersistenceAdapter = {
  async load(key: string): Promise<ChatMessage[]> {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw) as ChatMessage[];
    } catch {
      return [];
    }
  },

  async save(key: string, messages: ChatMessage[]): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(messages));
    } catch {
      // localStorage full or unavailable — silently fail
    }
  },

  async clear(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {
      // silently fail
    }
  },
};

/** Resolve a persistence config value to an adapter instance */
export function resolvePersistence(
  value?: 'none' | 'localStorage' | PersistenceAdapter,
): PersistenceAdapter {
  if (!value || value === 'none') return NonePersistence;
  if (value === 'localStorage') return LocalStoragePersistence;
  return value;
}
