'use client';

import useSWR from 'swr';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ScenarioStateResponse {
  appSlug: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: Record<string, any> | null;
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
    await fetch('/api/scenario-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appSlug }),
    });
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
