/**
 * Channel-agnostic conversation types shared across all packages.
 */

/** Supported communication channels */
export type Channel = 'web' | 'voice-pstn' | 'voice-webrtc' | 'sms' | 'email';

/** Conversation participant role */
export type Role = 'user' | 'model' | 'system' | 'agent';

/** Canonical message format used across all channels */
export interface Message {
  id: string;
  role: Role;
  content: string;
  channel: Channel;
  ts: number;
  metadata?: Record<string, unknown>;
}

/** Conversation state */
export type ConversationStatus = 'active' | 'handed_off' | 'resolved' | 'abandoned';

/** A conversation session across any channel */
export interface Conversation {
  id: string;
  appSlug: string;
  sessionId: string;
  channel: Channel;
  status: ConversationStatus;
  messages: Message[];
  startedAt: number;
  endedAt?: number;
  metadata?: Record<string, unknown>;
}

/** Telemetry event emitted by any channel */
export interface PlatformEvent {
  type: string;
  ts: number;
  sessionId: string;
  channel: Channel;
  data?: Record<string, unknown>;
}
