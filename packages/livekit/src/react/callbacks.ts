/**
 * Room lifecycle callbacks for backend integration.
 *
 * Provides a backend-agnostic interface so the LiveKit React hook can
 * create rooms, fetch tokens, and clean up rooms without hard-coding
 * Convex (or any other backend).
 */

/** Backend-agnostic callbacks for LiveKit room lifecycle */
export interface LiveKitRoomCallbacks {
  /** Create a room and return the room name */
  createRoom: (sessionId: string) => Promise<{ roomName: string }>;

  /** Fetch a token (and optional server URL) for joining the room */
  fetchToken: (roomName: string, identity: string, name?: string) => Promise<{ token: string; serverUrl?: string }>;

  /** Delete/clean up a room */
  deleteRoom: (roomName: string) => Promise<void>;
}

/** Config for the built-in Convex room callbacks factory */
export interface ConvexRoomConfig {
  /** Convex deployment URL (e.g. https://my-app.convex.cloud) */
  convexUrl: string;
  /** App slug for authentication */
  appSlug: string;
  /** @deprecated Use getSessionToken for browser clients */
  appSecret?: string;
  /** Async callback returning a short-lived session token (browser-safe) */
  getSessionToken?: () => Promise<string>;
}

/** Resolve auth credentials for request bodies */
async function resolveAuth(config: ConvexRoomConfig): Promise<Record<string, string>> {
  if (config.getSessionToken) {
    const token = await config.getSessionToken();
    return { sessionToken: token };
  }
  if (!config.appSecret) {
    throw new Error(
      'ConvexRoomConfig: provide getSessionToken() (recommended) or appSecret (server-only)',
    );
  }
  return { appSlug: config.appSlug, appSecret: config.appSecret };
}

/**
 * Create LiveKitRoomCallbacks backed by a Convex deployment.
 * This is the default backend integration — pass the result to
 * `useLiveKitVoiceChat({ callbacks })`.
 */
export function createConvexRoomCallbacks(config: ConvexRoomConfig): LiveKitRoomCallbacks {
  // Cache last resolved auth for sync cleanup (sendBeacon-style fire-and-forget)
  let cachedAuth: Record<string, string> = {};

  return {
    async createRoom(sessionId: string): Promise<{ roomName: string }> {
      const auth = await resolveAuth(config);
      cachedAuth = auth;

      const res = await fetch(
        new URL('/api/livekit/rooms', config.convexUrl).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...auth, sessionId }),
        },
      );

      if (!res.ok) {
        throw new Error(`Failed to create room: ${res.statusText}`);
      }

      return (await res.json()) as { roomName: string };
    },

    async fetchToken(roomName: string, identity: string, name?: string): Promise<{ token: string; serverUrl?: string }> {
      const auth = await resolveAuth(config);
      cachedAuth = auth;

      const res = await fetch(
        new URL('/api/livekit/token', config.convexUrl).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...auth, roomName, identity, name }),
        },
      );

      if (!res.ok) {
        throw new Error(`Failed to get token: ${res.statusText}`);
      }

      return (await res.json()) as { token: string; serverUrl?: string };
    },

    async deleteRoom(roomName: string): Promise<void> {
      // Try fresh auth first, fall back to cached for sync cleanup contexts
      let auth: Record<string, string>;
      try {
        auth = await resolveAuth(config);
        cachedAuth = auth;
      } catch {
        auth = cachedAuth;
      }

      await fetch(
        new URL('/api/livekit/rooms', config.convexUrl).toString(),
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...auth, roomName }),
        },
      ).catch(() => {});
    },
  };
}
