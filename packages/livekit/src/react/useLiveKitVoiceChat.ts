import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseLiveKitVoiceChatOptions {
  /** Convex deployment URL (e.g. https://my-app.convex.cloud) */
  convexUrl: string;
  /** App slug for authentication */
  appSlug: string;
  /** @deprecated Use getSessionToken for browser clients */
  appSecret?: string;
  /** Async callback returning a short-lived session token (browser-safe) */
  getSessionToken?: () => Promise<string>;
  /** LiveKit server URL (defaults to token endpoint response) */
  serverUrl?: string;
  /** Participant identity (default: auto-generated) */
  identity?: string;
  /** Participant display name */
  name?: string;
  /** Auto-connect on mount (default: false) */
  autoConnect?: boolean;
}

export interface UseLiveKitVoiceChatReturn {
  /** LiveKit access token (null until fetched) */
  token: string | null;
  /** Room name for the session */
  roomName: string | null;
  /** LiveKit WebSocket server URL */
  serverUrl: string | null;
  /** Whether a token has been fetched and is ready for LiveKitRoom */
  isReady: boolean;
  /** Whether a connection attempt is in progress */
  isConnecting: boolean;
  /** Last error encountered */
  error: string | null;
  /** Create room + fetch token for LiveKitRoom */
  connect: () => Promise<void>;
  /** Clean up room and reset state (allows retry) */
  disconnect: () => Promise<void>;
}

/**
 * Hook for managing LiveKit voice chat sessions.
 * Handles room creation, token fetching, and connection lifecycle.
 *
 * This hook provides `token`, `roomName`, and `serverUrl` for use with
 * LiveKitRoom from @livekit/components-react. The `isReady` flag indicates
 * when these values are available. Actual WebRTC connection state should
 * be tracked via LiveKitRoom's `onConnected`/`onDisconnected` callbacks.
 */
export function useLiveKitVoiceChat(
  options: UseLiveKitVoiceChatOptions,
): UseLiveKitVoiceChatReturn {
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(
    options.serverUrl ?? null,
  );
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string>(
    `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const identityRef = useRef<string>(
    options.identity ??
      `user-${Math.random().toString(36).slice(2, 8)}`,
  );

  // Refs to track current state for cleanup effect
  const roomNameRef = useRef<string | null>(null);
  const isReadyRef = useRef(false);
  // Cache last resolved token for sync cleanup (sendBeacon-style fire-and-forget)
  const cachedAuthRef = useRef<Record<string, string>>({});

  /** Resolve auth credentials for request bodies */
  async function resolveAuth(): Promise<Record<string, string>> {
    if (options.getSessionToken) {
      const token = await options.getSessionToken();
      const auth = { sessionToken: token };
      cachedAuthRef.current = auth;
      return auth;
    }
    if (!options.appSecret) {
      throw new Error(
        'useLiveKitVoiceChat: provide getSessionToken() (recommended) or appSecret (server-only)',
      );
    }
    const auth = { appSlug: options.appSlug, appSecret: options.appSecret };
    cachedAuthRef.current = auth;
    return auth;
  }

  const connect = useCallback(async () => {
    if (isConnecting) return;

    // Allow retry: reset state before attempting
    setIsConnecting(true);
    setError(null);
    setIsReady(false);
    isReadyRef.current = false;

    try {
      const auth = await resolveAuth();

      // Step 1: Create a room
      const roomResponse = await fetch(
        new URL('/api/livekit/rooms', options.convexUrl).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...auth,
            sessionId: sessionIdRef.current,
          }),
        },
      );

      if (!roomResponse.ok) {
        throw new Error(`Failed to create room: ${roomResponse.statusText}`);
      }

      const { roomName: newRoomName } = (await roomResponse.json()) as {
        roomName: string;
      };

      // Step 2: Get a token
      const tokenResponse = await fetch(
        new URL('/api/livekit/token', options.convexUrl).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...auth,
            roomName: newRoomName,
            identity: identityRef.current,
            name: options.name,
          }),
        },
      );

      if (!tokenResponse.ok) {
        throw new Error(`Failed to get token: ${tokenResponse.statusText}`);
      }

      const { token: newToken, serverUrl: returnedServerUrl } =
        (await tokenResponse.json()) as {
          token: string;
          serverUrl?: string;
        };

      setRoomName(newRoomName);
      roomNameRef.current = newRoomName;
      setToken(newToken);
      if (returnedServerUrl && !options.serverUrl) {
        setServerUrl(returnedServerUrl);
      }
      setIsReady(true);
      isReadyRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, options.convexUrl, options.appSlug, options.appSecret, options.getSessionToken, options.name, options.serverUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnect = useCallback(async () => {
    const currentRoomName = roomNameRef.current;
    if (!currentRoomName) return;

    try {
      const auth = await resolveAuth();
      await fetch(
        new URL('/api/livekit/rooms', options.convexUrl).toString(),
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...auth,
            roomName: currentRoomName,
          }),
        },
      );
    } catch {
      // Best-effort cleanup
    }

    setToken(null);
    setRoomName(null);
    roomNameRef.current = null;
    setIsReady(false);
    isReadyRef.current = false;
  }, [options.convexUrl, options.appSlug, options.appSecret, options.getSessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-connect if requested
  useEffect(() => {
    if (options.autoConnect) {
      connect();
    }
  }, [options.autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up on unmount — uses refs to avoid stale closure
  useEffect(() => {
    return () => {
      const currentRoomName = roomNameRef.current;
      if (isReadyRef.current && currentRoomName) {
        // Fire-and-forget cleanup using cached auth (sync context)
        fetch(new URL('/api/livekit/rooms', options.convexUrl).toString(), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...cachedAuthRef.current,
            roomName: currentRoomName,
          }),
        }).catch(() => {});
      }
    };
  }, [options.convexUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    token,
    roomName,
    serverUrl,
    isReady,
    isConnecting,
    error,
    connect,
    disconnect,
  };
}
