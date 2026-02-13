'use client';

import useSWR from 'swr';

interface ScenarioStateResponse {
  appSlug: string;
  state: Record<string, unknown> | null;
  updatedAt: number | null;
}

const fetcher = async (url: string): Promise<ScenarioStateResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch scenario state');
  return res.json();
};

export function useScenarioState(appSlug: string) {
  const { data, error, isLoading, mutate } = useSWR<ScenarioStateResponse>(
    `/api/scenario-state?appSlug=${appSlug}`,
    fetcher,
    {
      refreshInterval: 2000,
      revalidateOnFocus: false,
    },
  );

  const reset = async () => {
    const res = await fetch('/api/scenario-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appSlug }),
    });
    if (!res.ok) throw new Error('Failed to reset scenario state');
    mutate();
  };

  return {
    state: data?.state ?? null,
    updatedAt: data?.updatedAt ?? null,
    isLoading,
    error,
    reset,
    mutate,
  };
}
