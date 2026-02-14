/**
 * Types for LiveKit React conversation events.
 */

import type { AgentState } from '@livekit/components-react';

// Re-export AgentState from LiveKit components — the canonical type is:
// 'disconnected' | 'connecting' | 'pre-connect-buffering' | 'failed'
// | 'initializing' | 'idle' | 'listening' | 'thinking' | 'speaking'
export type { AgentState };

/** A single transcript message from the voice conversation */
export interface TranscriptMessage {
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
  id: string;
}

/** Callbacks fired by ConversationEventBridge for host-app consumption */
export interface ConversationEventCallbacks {
  /** Fired when the agent transitions between states */
  onAgentStateChange?: (state: AgentState) => void;
  /** Fired for each new finalized transcript entry */
  onTranscript?: (message: TranscriptMessage) => void;
  /** Fired when the conversation ends (room disconnects) */
  onConversationEnd?: (reason: string) => void;
  /** Fired when a handoff is detected via room metadata */
  onHandoff?: (data: { reason: string; priority: string; timestamp: number }) => void;
}

/** Imperative handle for transcript export */
export interface TranscriptHandle {
  getTranscript(): TranscriptMessage[];
}

/** Server-driven UI strings from persona config */
export interface PersonaUIStrings {
  greetingMessage?: string;
  errorMessage?: string;
  connectButtonText?: string;
  disconnectButtonText?: string;
  connectingText?: string;
  agentTransferWaitingMessage?: string;
}
