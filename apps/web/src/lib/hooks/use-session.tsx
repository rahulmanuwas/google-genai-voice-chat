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
import { ApiClient, UnauthorizedError } from '../api-client';

interface SessionCtx {
  api: ApiClient | null;
  ready: boolean;
  error: string | null;
}

const Ctx = createContext<SessionCtx>({ api: null, ready: false, error: null });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch('/api/session', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to get session');
      const data = await res.json();
      setToken(data.sessionToken);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Session error');
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchToken();
    }
  }, [fetchToken]);

  const api = useMemo(() => {
    if (!token) return null;
    return new ApiClient(token);
  }, [token]);

  // Global handler for 401 errors — auto-refresh token
  useEffect(() => {
    const orig = window.fetch;
    window.fetch = async (...args) => {
      try {
        const res = await orig(...args);
        return res;
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          fetchedRef.current = false;
          fetchToken();
        }
        throw e;
      }
    };
    return () => {
      window.fetch = orig;
    };
  }, [fetchToken]);

  return (
    <Ctx.Provider value={{ api, ready: !!token, error }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  return useContext(Ctx);
}
