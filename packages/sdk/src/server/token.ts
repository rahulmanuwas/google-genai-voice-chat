import { AccessToken } from 'livekit-server-sdk';
import type { LiveKitRoomConfig } from '../types';

export interface CreateTokenOptions {
  /** LiveKit API key (defaults to LIVEKIT_API_KEY env var) */
  apiKey?: string;
  /** LiveKit API secret (defaults to LIVEKIT_API_SECRET env var) */
  apiSecret?: string;
  /** Room name to grant access to */
  roomName: string;
  /** Participant identity */
  identity: string;
  /** Display name */
  name?: string;
  /** Token TTL in seconds (default: 3600) */
  ttl?: number;
  /** Room configuration for agent dispatch metadata */
  roomConfig?: LiveKitRoomConfig;
}

/**
 * Create a LiveKit access token for a participant.
 * Uses LIVEKIT_API_KEY and LIVEKIT_API_SECRET from env if not provided.
 */
export async function createLiveKitToken(options: CreateTokenOptions): Promise<string> {
  const apiKey = options.apiKey ?? process.env.LIVEKIT_API_KEY;
  const apiSecret = options.apiSecret ?? process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set');
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: options.identity,
    name: options.name,
    ttl: options.ttl ?? 3600,
  });

  token.addGrant({
    room: options.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  // Attach room config as metadata for the agent to read
  if (options.roomConfig) {
    token.metadata = JSON.stringify(options.roomConfig);
  }

  return await token.toJwt();
}
