'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  createTimelineEvent,
  inferSignalsFromAgentText,
  type DemoTimelineEvent,
  type ScenarioStateChange,
} from '@/lib/demo-observability';
import type { AgentState, TranscriptMessage } from '@genai-voice/livekit';

export function useDemoTimeline(scenarioId: string, stateChanges: ScenarioStateChange[]) {
  const [timelineByScenario, setTimelineByScenario] = useState<Record<string, DemoTimelineEvent[]>>({});
  const [agentStateByScenario, setAgentStateByScenario] = useState<Record<string, AgentState>>({});

  const timeline = useMemo(
    () => timelineByScenario[scenarioId] ?? [],
    [timelineByScenario, scenarioId],
  );
  const agentState = agentStateByScenario[scenarioId] ?? 'disconnected';

  const addTimeline = useCallback((event: Omit<DemoTimelineEvent, 'id' | 'ts'> & { ts?: number }) => {
    setTimelineByScenario((prev) => {
      const current = prev[scenarioId] ?? [];
      return {
        ...prev,
        [scenarioId]: [createTimelineEvent(event), ...current].slice(0, 120),
      };
    });
  }, [scenarioId]);

  const stateTimeline = useMemo(() => {
    const derived: DemoTimelineEvent[] = [];
    for (const change of stateChanges) {
      derived.push(createTimelineEvent({
        id: `${change.id}:state`,
        ts: change.ts,
        subsystem: 'state',
        status: 'success',
        title: change.title,
        detail: change.detail,
      }));
      if (change.inferredTool) {
        derived.push(createTimelineEvent({
          id: `${change.id}:tool`,
          ts: change.ts,
          subsystem: 'tool',
          status: 'success',
          title: `Tool effect detected: ${change.inferredTool}`,
          detail: `State changed after ${change.inferredTool}.`,
        }));
      }
    }
    return derived;
  }, [stateChanges]);

  const mergedTimeline = useMemo(
    () => [...stateTimeline, ...timeline].sort((a, b) => b.ts - a.ts).slice(0, 120),
    [stateTimeline, timeline],
  );

  const handleAgentStateChange = useCallback((state: AgentState) => {
    setAgentStateByScenario((prev) => ({ ...prev, [scenarioId]: state }));
    const label = state.replace(/-/g, ' ');
    addTimeline({
      subsystem: state === 'failed' ? 'system' : 'conversation',
      status: state === 'failed' ? 'error' : 'info',
      title: `Agent state: ${label}`,
      detail: 'LiveKit voice assistant state transitioned.',
    });
  }, [addTimeline, scenarioId]);

  const handleTranscript = useCallback((message: TranscriptMessage) => {
    if (message.role === 'user') {
      addTimeline({
        ts: message.timestamp,
        subsystem: 'conversation',
        status: 'info',
        title: 'User utterance captured',
        detail: message.text.slice(0, 180),
      });
      return;
    }

    addTimeline({
      ts: message.timestamp,
      subsystem: 'conversation',
      status: 'success',
      title: 'Agent response transcribed',
      detail: message.text.slice(0, 180),
    });

    const inferred = inferSignalsFromAgentText(message.text);
    for (const signal of inferred) {
      addTimeline({
        ts: message.timestamp,
        subsystem: signal.subsystem,
        status: signal.status,
        title: signal.title,
        detail: signal.detail,
      });
    }
  }, [addTimeline]);

  const handleHandoff = useCallback((data: { reason: string; priority: string; timestamp: number }) => {
    addTimeline({
      ts: data.timestamp,
      subsystem: 'handoff',
      status: 'warning',
      title: 'Handoff initiated',
      detail: `reason=${data.reason}, priority=${data.priority}`,
    });
  }, [addTimeline]);

  return {
    timeline,
    mergedTimeline,
    agentState,
    addTimeline,
    handleAgentStateChange,
    handleTranscript,
    handleHandoff,
  };
}
