'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { FadeIn } from '@/components/ui/fade-in';
import { ScenarioPicker } from '@/components/demos/ScenarioPicker';
import { DemoObservabilityPanel } from '@/components/demos/DemoObservabilityPanel';
import { useScenarioStateChanges } from '@/lib/hooks/use-scenario-state-changes';
import { useDemoTimeline } from '@/lib/hooks/use-demo-timeline';
import { DEFAULT_SCENARIO, getScenarioById } from '@/lib/scenarios';

const LiveKitVoiceChat = dynamic(
  () => import('@genai-voice/livekit').then((mod) => mod.LiveKitVoiceChat),
  { ssr: false },
);

export function LiveDemo() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO.id);
  const scenario = getScenarioById(scenarioId);

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

  const { changes: stateChanges } = useScenarioStateChanges(scenario);
  const {
    mergedTimeline,
    handleAgentStateChange,
    handleTranscript,
    handleHandoff,
  } = useDemoTimeline(scenario.id, stateChanges);

  const missing = !convexUrl || !livekitUrl;

  return (
    <section id="try" className="relative py-20 sm:py-28 lg:py-36 border-t border-border overflow-hidden">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 30%, hsl(38 92% 50% / 0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <FadeIn className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Talk to a production AI agent.{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand to-brand-secondary">
              Right now.
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-2">
            LiveKit WebRTC, Gemini multimodal, Convex backend, real tool
            execution — all running live below.
          </p>
        </FadeIn>

        <FadeIn delay={0.1} className="mb-8 flex justify-center">
          <ScenarioPicker value={scenarioId} onChange={setScenarioId} />
        </FadeIn>

        {missing ? (
          <FadeIn delay={0.2}>
            <div className="mx-auto max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Live demo unavailable — missing environment configuration.
              </p>
            </div>
          </FadeIn>
        ) : (
          <FadeIn delay={0.2}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm">
                <LiveKitVoiceChat
                  key={scenario.id}
                  convexUrl={convexUrl!}
                  appSlug={scenario.appSlug}
                  getSessionToken={getSessionToken}
                  serverUrl={livekitUrl!}
                  thinkingAudioSrc="/chieuk-thinking-289286.mp3"
                  onAgentStateChange={handleAgentStateChange}
                  onTranscript={handleTranscript}
                  onHandoff={handleHandoff}
                />
              </div>

              <DemoObservabilityPanel
                scenario={scenario}
                timeline={mergedTimeline}
                stateChanges={stateChanges}
                hideActions
              />
            </div>
          </FadeIn>
        )}

      </div>
    </section>
  );
}
