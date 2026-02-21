import { RoomServiceClient } from 'livekit-server-sdk';

export interface RoomOptions {
  /** LiveKit API key (defaults to LIVEKIT_API_KEY env var) */
  apiKey?: string;
  /** LiveKit API secret (defaults to LIVEKIT_API_SECRET env var) */
  apiSecret?: string;
  /** LiveKit server URL (defaults to LIVEKIT_URL env var) */
  serverUrl?: string;
}

export interface CreateRoomOptions extends RoomOptions {
  /** Unique room name */
  roomName: string;
  /** Max participants (default: 2) */
  maxParticipants?: number;
  /** Empty room timeout in seconds (default: 300) */
  emptyTimeout?: number;
  /** Room metadata (JSON string) — available to agents via room.metadata */
  metadata?: string;
  /** Agent dispatches — specify which agents to dispatch to this room */
  agents?: Array<{ agentName: string; metadata?: string }>;
}

function getClient(options?: RoomOptions): RoomServiceClient {
  const url = options?.serverUrl ?? process.env.LIVEKIT_URL;
  const apiKey = options?.apiKey ?? process.env.LIVEKIT_API_KEY;
  const apiSecret = options?.apiSecret ?? process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new Error('LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set');
  }

  return new RoomServiceClient(url, apiKey, apiSecret);
}

/** Create a LiveKit room via the server API */
export async function createRoom(options: CreateRoomOptions) {
  const client = getClient(options);

  const createOptions: Record<string, unknown> = {
    name: options.roomName,
    maxParticipants: options.maxParticipants ?? 2,
    emptyTimeout: options.emptyTimeout ?? 300,
    metadata: options.metadata,
  };

  if (options.agents?.length) {
    createOptions.agents = options.agents;
  }

  return await client.createRoom(createOptions as any);
}

/** Delete (close) a LiveKit room via the server API */
export async function deleteRoom(roomName: string, options?: RoomOptions) {
  const client = getClient(options);
  await client.deleteRoom(roomName);
}
