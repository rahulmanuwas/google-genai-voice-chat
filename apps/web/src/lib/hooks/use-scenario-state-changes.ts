'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useScenarioState } from './use-scenario-state';
import type { Scenario } from '@/lib/scenarios';
import {
  detectScenarioStateChanges,
  type ScenarioStateChange,
} from '@/lib/demo-observability';

function cloneState(state: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!state) return null;
  return JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
}

export function useScenarioStateChanges(scenario: Scenario) {
  const scenarioState = useScenarioState(scenario.appSlug);
  const [changes, setChanges] = useState<ScenarioStateChange[]>([]);
  const previousStateRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    previousStateRef.current = null;
    setChanges([]);
  }, [scenario.id]);

  useEffect(() => {
    const currentState = scenarioState.state;
    if (!currentState) {
      previousStateRef.current = null;
      return;
    }

    const previousState = previousStateRef.current;
    const timestamp = scenarioState.updatedAt ?? Date.now();

    if (previousState) {
      const deltas = detectScenarioStateChanges(
        scenario,
        previousState,
        currentState,
        timestamp,
      );
      if (deltas.length > 0) {
        const scoped = deltas.map((delta) => ({
          ...delta,
          id: `${scenario.id}:${delta.id}`,
        }));
        setChanges((prev) => [...scoped, ...prev].slice(0, 90));
      }
    }

    previousStateRef.current = cloneState(currentState);
  }, [scenario, scenarioState.state, scenarioState.updatedAt]);

  const scopedChanges = useMemo(
    () => changes.filter((change) => change.id.startsWith(`${scenario.id}:`)),
    [changes, scenario.id],
  );

  const latestChange = useMemo(
    () => (scopedChanges.length > 0 ? scopedChanges[0] : null),
    [scopedChanges],
  );

  return {
    ...scenarioState,
    changes: scopedChanges,
    latestChange,
  };
}
