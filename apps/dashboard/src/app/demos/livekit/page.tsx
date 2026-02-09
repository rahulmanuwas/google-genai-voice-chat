'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScenarioPicker } from '@/components/demos/ScenarioPicker';
import { ScenarioStatePanel } from '@/components/demos/ScenarioStatePanel';
import { DEFAULT_SCENARIO, getScenarioById } from '@/lib/scenarios';
import { PageHeader } from '@/components/layout/page-header';

const LiveKitVoiceChat = dynamic(
  () => import('@genai-voice/livekit').then((mod) => mod.LiveKitVoiceChat),
  { ssr: false },
);

export default function LiveKitDemo() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO.id);
  const scenario = getScenarioById(scenarioId);

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

  if (missing.length > 0) {
    return (
      <div>
        <MissingEnvCard vars={missing} hint="This demo requires a deployed Convex backend with LiveKit endpoints and a LiveKit Cloud account." />
      </div>
    );
  }

  const hasStatePanel = scenario.id === 'dentist' || scenario.id === 'ecommerce';

  return (
    <div className="space-y-6">
      <PageHeader title="LiveKit Agent" description="Click Start Voice Chat to connect to a server-side AI agent.">
        <ScenarioPicker value={scenarioId} onChange={setScenarioId} />
      </PageHeader>

      <div className={`grid grid-cols-1 gap-6 ${hasStatePanel ? 'lg:grid-cols-2' : ''}`}>
        <Card>
          <CardContent className="pt-6">
            <LiveKitVoiceChat
              key={scenario.id}
              convexUrl={convexUrl!}
              appSlug={scenario.appSlug}
              getSessionToken={getSessionToken}
              serverUrl={livekitUrl}
            />
          </CardContent>
        </Card>

        {hasStatePanel && (
          <ScenarioStatePanel key={scenario.id} scenario={scenario} />
        )}
      </div>
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
