'use client';

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface AppFilterContextValue {
  selectedApp: string | null;
  setSelectedApp: (app: string | null) => void;
  availableApps: string[];
  setAvailableApps: (apps: string[]) => void;
}

const AppFilterContext = createContext<AppFilterContextValue | null>(null);

export function AppFilterProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [selectedApp, setSelectedAppState] = useState<string | null>(
    () => searchParams.get('app') || null,
  );
  const [availableApps, setAvailableApps] = useState<string[]>([]);

  const setSelectedApp = useCallback((app: string | null) => {
    setSelectedAppState(app);
    const params = new URLSearchParams(searchParams.toString());
    if (app) {
      params.set('app', app);
    } else {
      params.delete('app');
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const value = useMemo(
    () => ({ selectedApp, setSelectedApp, availableApps, setAvailableApps }),
    [selectedApp, setSelectedApp, availableApps],
  );

  return (
    <AppFilterContext.Provider value={value}>
      {children}
    </AppFilterContext.Provider>
  );
}

export function useAppFilter() {
  const ctx = useContext(AppFilterContext);
  if (!ctx) throw new Error('useAppFilter must be used within AppFilterProvider');
  return ctx;
}
