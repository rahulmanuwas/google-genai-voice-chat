'use client';

import useSWR, { type SWRConfiguration } from 'swr';
import { useSession } from './use-session';
import type {
  OverviewData,
  Insight,
  Handoff,
  Tool,
  ToolExecution,
  GuardrailRule,
  GuardrailViolation,
  KnowledgeGap,
  KnowledgeDocument,
  PersonaConfig,
  Persona,
  Experiment,
  QaScenario,
  QaRun,
  OutboundTrigger,
  OutboundDispatch,
  Message,
  Conversation,
  ConversationAnnotation,
  TraceTimelineEvent,
} from '@/types/api';

function useAuthFetcher() {
  const { api } = useSession();
  return api
    ? <T>(path: string) => api.get<T>(path)
    : null;
}

function useApiSWR<T>(path: string | null, opts?: SWRConfiguration) {
  const fetcher = useAuthFetcher();
  return useSWR<T>(
    fetcher && path ? path : null,
    fetcher ? () => fetcher<T>(path!) : null,
    { revalidateOnFocus: false, ...opts },
  );
}

// ─── Overview ──────────────────────────────────────────────────

export function useOverview(since?: number) {
  const params = new URLSearchParams({ all: 'true' });
  if (since) params.set('since', String(since));
  return useApiSWR<OverviewData>(`/api/analytics/overview?${params}`);
}

// ─── Insights ──────────────────────────────────────────────────

export function useInsights() {
  return useApiSWR<{ insights: Insight[] }>('/api/analytics/insights?all=true');
}

// ─── Conversations ─────────────────────────────────────────────

export function useConversations(status?: string) {
  const path = status
    ? `/api/conversations?all=true&status=${status}`
    : '/api/conversations?all=true';
  return useApiSWR<{ conversations: Conversation[] }>(path);
}

// ─── Handoffs ──────────────────────────────────────────────────

export function useHandoffs(status?: string) {
  const path = status
    ? `/api/handoffs?all=true&status=${status}`
    : '/api/handoffs?all=true';
  return useApiSWR<{ handoffs: Handoff[] }>(path);
}

// ─── Tools ─────────────────────────────────────────────────────

export function useTools() {
  return useApiSWR<{ tools: Tool[] }>('/api/tools/all?all=true');
}

export function useToolExecutions() {
  return useApiSWR<{ executions: ToolExecution[] }>('/api/tools/executions?all=true');
}

// ─── Guardrails ────────────────────────────────────────────────

export function useGuardrailRules() {
  return useApiSWR<{ rules: GuardrailRule[] }>('/api/guardrails/rules?all=true');
}

export function useGuardrailViolations() {
  return useApiSWR<{ violations: GuardrailViolation[] }>('/api/guardrails/violations?all=true');
}

// ─── Knowledge ─────────────────────────────────────────────────

export function useKnowledgeGaps() {
  return useApiSWR<{ gaps: KnowledgeGap[] }>('/api/knowledge/gaps?all=true');
}

export function useKnowledgeDocuments() {
  return useApiSWR<{ documents: KnowledgeDocument[] }>('/api/knowledge/documents?all=true');
}

// ─── Persona ───────────────────────────────────────────────────

export function usePersona() {
  return useApiSWR<PersonaConfig>('/api/persona');
}

export function usePersonas() {
  return useApiSWR<{ personas: Persona[] }>('/api/personas');
}

// ─── Experiments ───────────────────────────────────────────────

export function useExperiments() {
  return useApiSWR<{ experiments: Experiment[] }>('/api/experiments?all=true');
}

// ─── QA Framework ───────────────────────────────────────────────

export function useQaScenarios(active?: boolean) {
  const params = new URLSearchParams({ all: 'true' });
  if (active !== undefined) params.set('active', String(active));
  return useApiSWR<{ scenarios: QaScenario[] }>(`/api/qa/scenarios?${params.toString()}`);
}

export function useQaRuns(scenarioId?: string) {
  const params = new URLSearchParams({ all: 'true' });
  if (scenarioId) params.set('scenarioId', scenarioId);
  return useApiSWR<{ runs: QaRun[] }>(`/api/qa/runs?${params.toString()}`);
}

// ─── Outbound Trigger Engine ───────────────────────────────────

export function useOutboundTriggers(active?: boolean) {
  const params = new URLSearchParams({ all: 'true' });
  if (active !== undefined) params.set('active', String(active));
  return useApiSWR<{ triggers: OutboundTrigger[] }>(`/api/outbound/triggers?${params.toString()}`);
}

export function useOutboundDispatches(eventType?: string) {
  const params = new URLSearchParams({ all: 'true' });
  if (eventType) params.set('eventType', eventType);
  return useApiSWR<{ dispatches: OutboundDispatch[] }>(`/api/outbound/dispatches?${params.toString()}`);
}

// ─── Messages ──────────────────────────────────────────────────

export function useMessages(sessionId: string | null) {
  return useApiSWR<{ messages: Message[] }>(
    sessionId ? `/api/messages?sessionId=${sessionId}` : null,
  );
}

// ─── Single Conversation (by sessionId from full list) ─────────

export function useConversationBySession(sessionId: string | null) {
  const { data, ...rest } = useApiSWR<{ conversations: Conversation[] }>(
    sessionId ? `/api/conversations?all=true` : null,
  );
  const conversation = data?.conversations?.find((c) => c.sessionId === sessionId) ?? null;
  return { data: conversation, ...rest };
}

// ─── Annotations (Error Analysis) ──────────────────────────────

export function useAnnotation(sessionId: string | null) {
  return useApiSWR<{ annotation: ConversationAnnotation | null }>(
    sessionId ? `/api/annotations?sessionId=${sessionId}` : null,
  );
}

export function useAnnotations(quality?: string) {
  const params = new URLSearchParams({ all: 'true' });
  if (quality) params.set('quality', quality);
  return useApiSWR<{ annotations: ConversationAnnotation[] }>(`/api/annotations?${params}`);
}

// ─── Trace Timeline ─────────────────────────────────────────────

export function useTraceTimeline(traceId: string | null, sessionId?: string) {
  const params = new URLSearchParams();
  if (traceId) params.set('traceId', traceId);
  if (sessionId) params.set('sessionId', sessionId);
  return useApiSWR<{ traceId: string; timeline: TraceTimelineEvent[] }>(
    traceId ? `/api/traces?${params}` : null,
  );
}
