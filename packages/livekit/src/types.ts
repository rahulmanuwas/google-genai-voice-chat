/**
 * LiveKit integration types.
 *
 * Types for room management, token generation, and voice agent
 * configuration when using LiveKit as the WebRTC transport layer.
 */

/** Room lifecycle status */
export type LiveKitRoomStatus = 'waiting' | 'active' | 'ended';

/** Participant role within a room */
export type LiveKitParticipantRole = 'user' | 'agent' | 'observer';

/** Configuration for creating a LiveKit room */
export interface LiveKitRoomConfig {
  /** Max participants allowed (default: 2 for 1:1 agent chat) */
  maxParticipants?: number;

  /** Room TTL in seconds (auto-close after idle) */
  emptyTimeout?: number;

  /** Whether to record the session */
  enableRecording?: boolean;
}

/** Configuration for the voice AI agent */
export interface LiveKitAgentConfig {
  /** Gemini native audio model to use (default: "gemini-2.5-flash-native-audio-preview-12-2025") */
  model?: string;

  /** Voice preset for speech synthesis */
  voice?: string;

  /** System instructions for the agent */
  instructions?: string;

  /** Model temperature (0-2) */
  temperature?: number;
}

/** A participant in a LiveKit room */
export interface LiveKitParticipant {
  /** LiveKit participant identity */
  identity: string;

  /** Display name */
  name?: string;

  /** Role in the session */
  role: LiveKitParticipantRole;

  /** When the participant joined */
  joinedAt: number;

  /** When the participant left (undefined if still connected) */
  leftAt?: number;
}

/** A LiveKit room record */
export interface LiveKitRoom {
  /** App this room belongs to */
  appSlug: string;

  /** Unique room name (generated) */
  roomName: string;

  /** Associated conversation session ID */
  sessionId: string;

  /** Current room status */
  status: LiveKitRoomStatus;

  /** Room configuration */
  config: LiveKitRoomConfig;

  /** Number of currently connected participants */
  participantCount: number;

  /** When the room was created */
  createdAt: number;

  /** When the room ended */
  endedAt?: number;
}

/** Request payload for token generation */
export interface LiveKitTokenRequest {
  /** App slug for authentication */
  appSlug: string;

  /** App secret for authentication */
  appSecret: string;

  /** Room to join */
  roomName: string;

  /** Participant identity */
  identity: string;

  /** Participant display name */
  name?: string;

  /** Token TTL in seconds (default: 3600) */
  ttl?: number;
}
