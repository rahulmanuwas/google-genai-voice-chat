import { useState, useCallback, useRef, useEffect } from 'react';
import type { LiveKitRoomCallbacks } from './callbacks';
import { createConvexRoomCallbacks } from './callbacks';

export interface UseLiveKitVoiceChatOptions {
  /** Backend-agnostic room lifecycle callbacks */
  callbacks?: LiveKitRoomCallbacks;

  /** @deprecated Use callbacks instead. Convex deployment URL (e.g. https://my-app.convex.cloud) */
  convexUrl?: string;
  /** @deprecated Use callbacks instead. App slug for authentication */
  appSlug?: string;
  /** @deprecated Use callbacks instead. Use getSessionToken for browser clients */
  appSecret?: string;
  /** @deprecated Use callbacks instead. Async callback returning a short-lived session token (browser-safe) */
  getSessionToken?: () => Promise<string>;

  /** LiveKit server URL (defaults to token endpoint response) */
  serverUrl?: string;
  /** Participant identity (default: auto-generated) */
  identity?: string;
  /** Participant display name */
  name?: string;
  /** Auto-connect on mount (default: false) */
  autoConnect?: boolean;
  /** Agent mode: 'realtime' (Gemini native audio) or 'pipeline' (Deepgram STT → Gemini LLM → Deepgram TTS) */
  agentMode?: 'realtime' | 'pipeline';
  /** Additional room metadata merged with agentMode and sent to createRoom() */
  roomMetadata?: Record<string, unknown>;
  /** Callback fired after a room is created (before token fetch) */
  onRoomCreated?: (payload: {
    sessionId: string;
    roomName: string;
    metadata?: Record<string, unknown>;
  }) => void | Promise<void>;
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

  // Resolve callbacks: use provided callbacks, or auto-create from legacy Convex props (backwards compat)
  const callbacksRef = useRef<LiveKitRoomCallbacks | null>(null);

  // Capture the deleteRoom callback at connect-time for stable unmount cleanup
  const deleteRoomRef = useRef<((roomName: string) => Promise<void>) | null>(null);

  function resolveCallbacks(): LiveKitRoomCallbacks {
    if (options.callbacks) {
      callbacksRef.current = options.callbacks;
      return options.callbacks;
    }

    // Backwards compat: auto-create Convex callbacks from legacy props
    if (!options.convexUrl) {
      throw new Error(
        'useLiveKitVoiceChat: provide callbacks or convexUrl',
      );
    }

    if (!callbacksRef.current) {
      callbacksRef.current = createConvexRoomCallbacks({
        convexUrl: options.convexUrl,
        appSlug: options.appSlug ?? '',
        appSecret: options.appSecret,
        getSessionToken: options.getSessionToken,
      });
    }

    return callbacksRef.current;
  }

  const connect = useCallback(async () => {
    if (isConnecting) return;

    // Allow retry: reset state before attempting
    setIsConnecting(true);
    setError(null);
    setIsReady(false);
    isReadyRef.current = false;

    try {
      const cb = resolveCallbacks();

      // Step 1: Create a room (pass merged metadata so server-side agents can read mode/context)
      const metadata = {
        ...(options.roomMetadata ?? {}),
        ...(options.agentMode ? { agentMode: options.agentMode } : {}),
      };
      const roomMetadata = Object.keys(metadata).length > 0 ? metadata : undefined;
      const { roomName: newRoomName } = await cb.createRoom(
        sessionIdRef.current,
        roomMetadata ? { metadata: roomMetadata } : undefined,
      );

      if (options.onRoomCreated) {
        try {
          await options.onRoomCreated({
            sessionId: sessionIdRef.current,
            roomName: newRoomName,
            metadata: roomMetadata,
          });
        } catch {
          // Callback should not block connection lifecycle
        }
      }

      // Step 2: Get a token
      const { token: newToken, serverUrl: returnedServerUrl } =
        await cb.fetchToken(newRoomName, identityRef.current, options.name);

      // Capture deleteRoom for unmount cleanup
      deleteRoomRef.current = cb.deleteRoom;

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
  }, [
    isConnecting,
    options.callbacks,
    options.convexUrl,
    options.appSlug,
    options.appSecret,
    options.getSessionToken,
    options.name,
    options.serverUrl,
    options.agentMode,
    options.roomMetadata,
    options.onRoomCreated,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnect = useCallback(async () => {
    const currentRoomName = roomNameRef.current;
    if (!currentRoomName) return;

    try {
      const cb = resolveCallbacks();
      await cb.deleteRoom(currentRoomName);
    } catch {
      // Best-effort cleanup
    }

    setToken(null);
    setRoomName(null);
    roomNameRef.current = null;
    setIsReady(false);
    isReadyRef.current = false;
  }, [options.callbacks, options.convexUrl, options.appSlug, options.appSecret, options.getSessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const deleteRoom = deleteRoomRef.current;
      if (isReadyRef.current && currentRoomName && deleteRoom) {
        // Fire-and-forget cleanup
        deleteRoom(currentRoomName).catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
