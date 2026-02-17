'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { createConvexRoomCallbacks } from '@genai-voice/sdk';
import { PageHeader } from '@/components/layout/page-header';
import { ScenarioPicker } from '@/components/demos/ScenarioPicker';
import { AgentModePicker, type AgentMode } from '@/components/demos/AgentModePicker';
import {
  useAgentSessionRuns,
  useKnowledgeSearchMetrics,
  useSessionGuardrailViolations,
  useSessionHandoffs,
} from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { DEFAULT_SCENARIO, getScenarioById } from '@/lib/scenarios';
import type { AgentSessionRun, KnowledgeSearchResult } from '@/types/api';
import { formatDuration, timeAgo } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const LiveKitVoiceChat = dynamic(
  () => import('@genai-voice/sdk').then((mod) => mod.LiveKitVoiceChat),
  { ssr: false },
);

const DEFAULT_QUERY_BY_SCENARIO: Record<string, string> = {
  dentist: 'Can you find Maria Garcia and check the fee if she cancels tomorrow?',
  ecommerce: 'Track order CB-20251234 and tell me if a return can be started.',
  earnings: 'Compare Q4 2025 revenue and gross margin versus Q3 2025.',
};

const WINDOW_24H_MS = 24 * 60 * 60 * 1000;

function toNumber(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function scoreClass(score: number) {
  if (score >= 0.75) return 'text-emerald-400';
  if (score >= 0.45) return 'text-amber-400';
  return 'text-red-400';
}

function summarizeRuns(runs: AgentSessionRun[]) {
  if (runs.length === 0) {
    return {
      successRate: 0,
      avgDurationMs: 0,
      totalFallbacks: 0,
      totalContextRecoveries: 0,
      totalTruncationChars: 0,
    };
  }

  const successCount = runs.filter((run) => run.status === 'success').length;
  const totalDurationMs = runs.reduce((sum, run) => sum + run.durationMs, 0);
  const totalFallbacks = runs.reduce((sum, run) => sum + run.fallbackCount, 0);
  const totalContextRecoveries = runs.reduce((sum, run) => sum + run.contextRecoveryCount, 0);
  const totalTruncationChars = runs.reduce((sum, run) => sum + run.toolOutputTruncatedChars, 0);

  return {
    successRate: successCount / runs.length,
    avgDurationMs: totalDurationMs / runs.length,
    totalFallbacks,
    totalContextRecoveries,
    totalTruncationChars,
  };
}

export default function CapabilityLabPage() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const { api, ready } = useSession();

  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO.id);
  const [agentMode, setAgentMode] = useState<AgentMode>('pipeline');
  const [roomName, setRoomName] = useState<string | null>(null);
  const [autoSessionId, setAutoSessionId] = useState<string | null>(null);
  const [sessionProbeId, setSessionProbeId] = useState('');
  const [searchQuery, setSearchQuery] = useState(DEFAULT_QUERY_BY_SCENARIO[DEFAULT_SCENARIO.id]);
  const [alphaVector, setAlphaVector] = useState('0.62');
  const [alphaKeyword, setAlphaKeyword] = useState('0.38');
  const [alphaMemory, setAlphaMemory] = useState('0.20');
  const [includeTranscriptMemory, setIncludeTranscriptMemory] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[] | null>(null);

  const scenario = getScenarioById(scenarioId);
  const activeSessionId = sessionProbeId.trim() || autoSessionId || null;

  const metricsSince = useMemo(() => Date.now() - WINDOW_24H_MS, []);
  const { data: knowledgeMetrics } = useKnowledgeSearchMetrics(metricsSince);
  const { data: runsData, isLoading: runsLoading } = useAgentSessionRuns(
    activeSessionId,
    20,
    scenario.appSlug,
  );
  const { data: guardrailsData, isLoading: guardrailsLoading } = useSessionGuardrailViolations(activeSessionId);
  const { data: handoffsData, isLoading: handoffsLoading } = useSessionHandoffs(activeSessionId, scenario.appSlug);

  useEffect(() => {
    setSearchQuery(DEFAULT_QUERY_BY_SCENARIO[scenario.id] ?? DEFAULT_QUERY_BY_SCENARIO.earnings);
    setRoomName(null);
    setAutoSessionId(null);
    setSessionProbeId('');
    setSearchResults(null);
    setSearchError(null);
  }, [scenario.id, agentMode]);

  const getSessionToken = useCallback(async () => {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appSlug: scenario.appSlug }),
    });
    if (!res.ok) throw new Error('Failed to get session token');
    const data = await res.json();
    return data.sessionToken as string;
  }, [scenario.appSlug]);

  const callbacks = useMemo(
    () => convexUrl ? createConvexRoomCallbacks({
      convexUrl,
      appSlug: scenario.appSlug,
      getSessionToken,
    }) : undefined,
    [convexUrl, scenario.appSlug, getSessionToken],
  );

  const handleRoomCreated = useCallback((payload: {
    sessionId: string;
    roomName: string;
    metadata?: Record<string, unknown>;
  }) => {
    setAutoSessionId(payload.sessionId);
    setSessionProbeId(payload.sessionId);
    setRoomName(payload.roomName);
  }, []);

  const runHybridProbe = useCallback(async () => {
    if (!api || !searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    try {
      const response = await api.post<{ results: KnowledgeSearchResult[] }>('/api/knowledge/search', {
        query: searchQuery,
        topK: 6,
        sessionId: activeSessionId ?? undefined,
        includeTranscriptMemory,
        alphaVector: toNumber(alphaVector, 0.62),
        alphaKeyword: toNumber(alphaKeyword, 0.38),
        alphaMemory: toNumber(alphaMemory, 0.20),
      });
      setSearchResults(response.results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search probe failed');
    } finally {
      setSearching(false);
    }
  }, [
    activeSessionId,
    alphaKeyword,
    alphaMemory,
    alphaVector,
    api,
    includeTranscriptMemory,
    searchQuery,
  ]);

  const runs = useMemo(() => runsData?.runs ?? [], [runsData?.runs]);
  const runSummary = useMemo(() => summarizeRuns(runs), [runs]);
  const guardrails = guardrailsData?.violations ?? [];
  const handoffs = handoffsData?.handoffs ?? [];

  const missing = [
    !convexUrl && 'NEXT_PUBLIC_CONVEX_URL',
    !livekitUrl && 'NEXT_PUBLIC_LIVEKIT_URL',
  ].filter(Boolean) as string[];

  if (!ready) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capability Lab"
        description="Run one live session, then inspect runtime recovery, safety signals, and hybrid retrieval quality."
      >
        <div className="flex flex-wrap items-center gap-4">
          <ScenarioPicker value={scenarioId} onChange={setScenarioId} />
          <AgentModePicker value={agentMode} onChange={setAgentMode} />
        </div>
      </PageHeader>

      {missing.length > 0 ? (
        <MissingEnvCard
          vars={missing}
          hint="Capability Lab needs Convex + LiveKit env vars configured."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">1. Live Runtime Session</CardTitle>
                <CardDescription>
                  Starts a LiveKit agent room with metadata (`agentMode`, `scenarioId`, `surface`) and captures
                  the resulting session id for telemetry probes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sessionProbeId">Session ID</Label>
                    <Input
                      id="sessionProbeId"
                      value={sessionProbeId}
                      onChange={(e) => setSessionProbeId(e.target.value)}
                      placeholder="Auto-populated when room is created"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Room</Label>
                    <div className="flex h-10 items-center rounded-md border border-border px-3 text-sm text-muted-foreground">
                      {roomName ?? 'No active room yet'}
                    </div>
                  </div>
                </div>

                {activeSessionId && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Session: {activeSessionId}</Badge>
                    <Badge variant="outline">App: {scenario.appSlug}</Badge>
                    <Badge variant="outline">Mode: {agentMode}</Badge>
                  </div>
                )}

                <div className="rounded-lg border border-border p-4">
                  <LiveKitVoiceChat
                    key={`${scenario.id}-${agentMode}`}
                    callbacks={callbacks!}
                    serverUrl={livekitUrl}
                    agentMode={agentMode}
                    roomMetadata={{
                      surface: 'capability-lab',
                      scenarioId: scenario.id,
                      appSlug: scenario.appSlug,
                    }}
                    onRoomCreated={handleRoomCreated}
                    thinkingAudioSrc="/chieuk-thinking-289286.mp3"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">2. Hybrid Retrieval Probe</CardTitle>
                <CardDescription>
                  Exercise weighted vector + BM25 + transcript-memory retrieval and inspect which source won.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="probeQuery">Query</Label>
                  <Input
                    id="probeQuery"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ask something that needs memory + keyword precision"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <WeightInput id="alphaVector" label="alphaVector" value={alphaVector} onChange={setAlphaVector} />
                  <WeightInput id="alphaKeyword" label="alphaKeyword" value={alphaKeyword} onChange={setAlphaKeyword} />
                  <WeightInput id="alphaMemory" label="alphaMemory" value={alphaMemory} onChange={setAlphaMemory} />
                </div>

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeTranscriptMemory}
                    onChange={(e) => setIncludeTranscriptMemory(e.target.checked)}
                    className="h-4 w-4 rounded border-border bg-background"
                  />
                  Include transcript memory
                </label>

                <Button onClick={runHybridProbe} disabled={searching || !searchQuery.trim()}>
                  {searching ? 'Running probe...' : 'Run probe'}
                </Button>

                {searchError && (
                  <p className="text-sm text-destructive">{searchError}</p>
                )}

                {searchResults && (
                  <div className="space-y-3">
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No matches returned for this probe.</p>
                    ) : (
                      searchResults.map((result) => (
                        <div key={`${result.sourceType ?? 'doc'}-${result._id}`} className="rounded-lg border border-border p-3">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{result.title}</p>
                            <Badge variant="outline" className="text-[10px]">{result.sourceType ?? 'document'}</Badge>
                            <Badge variant="secondary" className={`text-[10px] ${scoreClass(result.score)}`}>
                              score {result.score.toFixed(3)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{result.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">3. Runtime Resilience</CardTitle>
                <CardDescription>
                  Recent Pi run metadata for the selected session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!activeSessionId ? (
                  <p className="text-sm text-muted-foreground">
                    Start a session (or paste a session id) to inspect run telemetry.
                  </p>
                ) : runsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading runs...</p>
                ) : runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No runs recorded yet for this session.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <StatCell label="Runs" value={String(runs.length)} />
                      <StatCell label="Success" value={`${Math.round(runSummary.successRate * 100)}%`} />
                      <StatCell label="Avg duration" value={formatDuration(runSummary.avgDurationMs)} />
                      <StatCell label="Fallbacks" value={String(runSummary.totalFallbacks)} />
                      <StatCell label="Context recoveries" value={String(runSummary.totalContextRecoveries)} />
                      <StatCell label="Truncated chars" value={String(runSummary.totalTruncationChars)} />
                    </div>

                    <div className="space-y-2">
                      {runs.slice(0, 6).map((run) => (
                        <div key={run._id} className="rounded-md border border-border p-2.5">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-xs font-medium">
                              {run.provider}/{run.model}
                            </span>
                            <Badge variant={run.status === 'success' ? 'secondary' : 'destructive'} className="text-[10px]">
                              {run.status}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDuration(run.durationMs)} • attempts {run.attemptCount} • {timeAgo(run.startedAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">4. Safety + Escalation Signals</CardTitle>
                <CardDescription>
                  Guardrail violations and handoffs scoped to this session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!activeSessionId ? (
                  <p className="text-sm text-muted-foreground">Session-scoped safety metrics will appear after room creation.</p>
                ) : (guardrailsLoading || handoffsLoading) ? (
                  <p className="text-sm text-muted-foreground">Loading safety signals...</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <StatCell label="Violations" value={String(guardrails.length)} />
                      <StatCell label="Handoffs" value={String(handoffs.length)} />
                    </div>

                    {(guardrails.length === 0 && handoffs.length === 0) ? (
                      <p className="text-sm text-muted-foreground">No safety or escalation events recorded for this session.</p>
                    ) : (
                      <div className="space-y-2">
                        {guardrails.slice(0, 4).map((violation) => (
                          <div key={violation._id} className="rounded-md border border-border p-2.5">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-xs font-medium">Guardrail: {violation.type}</span>
                              <Badge variant="destructive" className="text-[10px]">{violation.action}</Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {violation.direction} • {timeAgo(violation.createdAt)}
                            </p>
                          </div>
                        ))}
                        {handoffs.slice(0, 4).map((handoff) => (
                          <div key={handoff._id} className="rounded-md border border-border p-2.5">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-xs font-medium">Handoff: {handoff.reason}</span>
                              <Badge variant="secondary" className="text-[10px]">{handoff.priority}</Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              status={handoff.status} • {timeAgo(handoff.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Knowledge Quality (Last 24h)</CardTitle>
                <CardDescription>
                  Hybrid retrieval health summary from `/api/knowledge/metrics`.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <StatCell label="Searches" value={String(knowledgeMetrics?.totalSearches ?? 0)} />
                  <StatCell label="Avg top score" value={(knowledgeMetrics?.avgTopScore ?? 0).toFixed(2)} />
                  <StatCell label="Gap rate" value={`${Math.round((knowledgeMetrics?.gapRate ?? 0) * 100)}%`} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Extensibility Surface</CardTitle>
                <CardDescription>
                  SDK plugin and channel APIs you can wire into demos without forking.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
{`import { registerTool, registerService } from '@genai-voice/sdk/agent';

registerTool({ name: 'refund_lookup', description: '...' });
registerService({
  name: 'crm-sync',
  async start(ctx) { /* connect */ },
  async stop(ctx) { /* cleanup */ },
});`}
                </pre>
                <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
{`import { createChannelAdapterRegistry } from '@genai-voice/sdk/core';

const registry = createChannelAdapterRegistry();
registry.register({
  id: 'slack-main',
  channel: 'slack',
  capabilities: { supportsTextIn: true, supportsStreaming: true, ... },
});`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function MissingEnvCard({ vars, hint }: { vars: string[]; hint?: string }) {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Missing Environment Variables</CardTitle>
        <CardDescription>
          Add the following to your <code className="text-xs">.env.local</code> file:
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1">
          {vars.map((v) => (
            <li key={v}>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{v}</code>
            </li>
          ))}
        </ul>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function WeightInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
      />
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
