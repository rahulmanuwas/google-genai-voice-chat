'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScenarioPicker } from '@/components/demos/ScenarioPicker';
import { AgentModePicker, type AgentMode } from '@/components/demos/AgentModePicker';
import { ScenarioStatePanel } from '@/components/demos/ScenarioStatePanel';
import { DEFAULT_SCENARIO, getScenarioById } from '@/lib/scenarios';
import { PageHeader } from '@/components/layout/page-header';
import { DemoObservabilityPanel } from '@/components/demos/DemoObservabilityPanel';
import { useScenarioStateChanges } from '@/lib/hooks/use-scenario-state-changes';
import { useDemoTimeline } from '@/lib/hooks/use-demo-timeline';
import { createConvexRoomCallbacks } from '@genai-voice/sdk';

const LiveKitVoiceChat = dynamic(
  () => import('@genai-voice/sdk').then((mod) => mod.LiveKitVoiceChat),
  { ssr: false },
);

export default function LiveKitDemo() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO.id);
  const [agentMode, setAgentMode] = useState<AgentMode>('pipeline');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeRoomName, setActiveRoomName] = useState<string | null>(null);
  const scenario = getScenarioById(scenarioId);
  const { changes: stateChanges } = useScenarioStateChanges(scenario);
  const {
    mergedTimeline,
    handleAgentStateChange,
    handleTranscript,
    handleHandoff,
  } = useDemoTimeline(scenario.id, stateChanges);

  const missing = [
    !convexUrl && 'NEXT_PUBLIC_CONVEX_URL',
    !livekitUrl && 'NEXT_PUBLIC_LIVEKIT_URL',
  ].filter(Boolean) as string[];

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

  const resetSessionProbe = useCallback(() => {
    setActiveSessionId(null);
    setActiveRoomName(null);
  }, []);

  const handleRoomCreated = useCallback(({ sessionId, roomName }: { sessionId: string; roomName: string }) => {
    setActiveSessionId(sessionId);
    setActiveRoomName(roomName);
  }, []);

  const handleScenarioChange = useCallback((nextScenarioId: string) => {
    setScenarioId(nextScenarioId);
    resetSessionProbe();
  }, [resetSessionProbe]);

  const handleAgentModeChange = useCallback((nextAgentMode: AgentMode) => {
    setAgentMode(nextAgentMode);
    resetSessionProbe();
  }, [resetSessionProbe]);

  const hasStatePanel = scenario.id === 'dentist' || scenario.id === 'ecommerce';

  return (
    <div className="space-y-6">
      <PageHeader title="LiveKit Agent" description="Click Start Voice Chat to connect to a server-side AI agent.">
        <div className="flex flex-wrap items-center gap-4">
          <ScenarioPicker value={scenarioId} onChange={handleScenarioChange} />
          <AgentModePicker value={agentMode} onChange={handleAgentModeChange} />
        </div>
      </PageHeader>

      {missing.length > 0 ? (
        <MissingEnvCard
          vars={missing}
          hint="This demo requires a deployed Convex backend with LiveKit endpoints and a LiveKit Cloud account."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
          <Card>
            <CardContent className="pt-6">
              {(activeSessionId || activeRoomName) && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {activeSessionId && <Badge variant="secondary">session {activeSessionId}</Badge>}
                  {activeRoomName && <Badge variant="outline">room {activeRoomName}</Badge>}
                  <Badge variant="outline">{scenario.appSlug}</Badge>
                </div>
              )}
              <LiveKitVoiceChat
                key={`${scenario.id}-${agentMode}`}
                callbacks={callbacks!}
                serverUrl={livekitUrl}
                agentMode={agentMode}
                roomMetadata={{
                  surface: 'livekit-demo',
                  scenarioId: scenario.id,
                  appSlug: scenario.appSlug,
                }}
                onRoomCreated={handleRoomCreated}
                thinkingAudioSrc="/chieuk-thinking-289286.mp3"
                onAgentStateChange={handleAgentStateChange}
                onTranscript={handleTranscript}
                onHandoff={handleHandoff}
              />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <DemoObservabilityPanel
              scenario={scenario}
              timeline={mergedTimeline}
              stateChanges={stateChanges}
            />

            {hasStatePanel && (
              <ScenarioStatePanel key={scenario.id} scenario={scenario} />
            )}
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
