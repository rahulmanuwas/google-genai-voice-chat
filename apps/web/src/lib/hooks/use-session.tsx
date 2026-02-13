'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiClient } from '../api-client';

interface SessionCtx {
  api: ApiClient | null;
  ready: boolean;
  error: string | null;
  refreshSession: () => Promise<string | null>;
}

const Ctx = createContext<SessionCtx>({
  api: null,
  ready: false,
  error: null,
  refreshSession: async () => null,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const tokenRef = useRef<string | null>(null);

  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/session', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to get session');
      const data = await res.json();
      if (typeof data.sessionToken !== 'string' || data.sessionToken.length === 0) {
        throw new Error('Invalid session token response');
      }
      tokenRef.current = data.sessionToken;
      setToken(data.sessionToken);
      setError(null);
      return data.sessionToken;
    } catch (e) {
      tokenRef.current = null;
      setToken(null);
      setError(e instanceof Error ? e.message : 'Session error');
      return null;
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = fetchToken().finally(() => {
        refreshPromiseRef.current = null;
      });
    }
    return refreshPromiseRef.current;
  }, [fetchToken]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      void refreshSession();
    }
  }, [refreshSession]);

  const api = useMemo(() => {
    if (!token) return null;
    return new ApiClient({
      getSessionToken: () => tokenRef.current,
      onUnauthorized: refreshSession,
    });
  }, [token, refreshSession]);

  return (
    <Ctx.Provider value={{ api, ready: !!token, error, refreshSession }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  return useContext(Ctx);
}
