'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { FadeIn } from '@/components/ui/fade-in';
import { ScenarioPicker } from '@/components/demos/ScenarioPicker';
import { AgentModePicker, type AgentMode } from '@/components/demos/AgentModePicker';
import { DemoObservabilityPanel } from '@/components/demos/DemoObservabilityPanel';
import { useScenarioStateChanges } from '@/lib/hooks/use-scenario-state-changes';
import { useDemoTimeline } from '@/lib/hooks/use-demo-timeline';
import { DEFAULT_SCENARIO, getScenarioById } from '@/lib/scenarios';
import { createConvexRoomCallbacks } from '@genai-voice/sdk';

const LiveKitVoiceChat = dynamic(
  () => import('@genai-voice/sdk').then((mod) => mod.LiveKitVoiceChat),
  { ssr: false },
);

export function LiveDemo() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO.id);
  const [agentMode, setAgentMode] = useState<AgentMode>('pipeline');
  const [demoTrack, setDemoTrack] = useState<'user' | 'developer'>('user');
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

  const callbacks = useMemo(
    () => convexUrl ? createConvexRoomCallbacks({
      convexUrl,
      appSlug: scenario.appSlug,
      getSessionToken,
    }) : undefined,
    [convexUrl, scenario.appSlug, getSessionToken],
  );

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
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-2">
            Real tool execution, real backend — running live below.
          </p>
        </FadeIn>

        {/* Dual track toggle */}
        <FadeIn delay={0.05} className="mb-8 flex justify-center">
          <div className="inline-flex items-center rounded-full bg-white/[0.04] border border-white/[0.06] p-0.5">
            <button
              onClick={() => setDemoTrack('user')}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                demoTrack === 'user'
                  ? 'bg-brand/12 text-brand ring-1 ring-brand/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              User Demo
            </button>
            <button
              onClick={() => setDemoTrack('developer')}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                demoTrack === 'developer'
                  ? 'bg-brand/12 text-brand ring-1 ring-brand/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Developer Demo
            </button>
          </div>
        </FadeIn>

        {demoTrack === 'user' && (
        <FadeIn delay={0.1} className="mb-8 flex flex-wrap justify-center gap-4">
          <ScenarioPicker value={scenarioId} onChange={setScenarioId} />
          <AgentModePicker value={agentMode} onChange={setAgentMode} />
        </FadeIn>
        )}

        {demoTrack === 'user' ? (
          missing ? (
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
                    key={`${scenario.id}-${agentMode}`}
                    callbacks={callbacks!}
                    serverUrl={livekitUrl!}
                    agentMode={agentMode}
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
          )
        ) : (
          <FadeIn delay={0.2}>
            <div className="mx-auto max-w-3xl rounded-xl border border-white/[0.06] bg-[hsl(0_0%_4%)] overflow-hidden">
              {/* Terminal header */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.06]">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                <span className="ml-3 text-[10px] text-muted-foreground/50">developer-demo — pi runtime</span>
              </div>
              {/* Demo walkthrough */}
              <div className="p-6 font-mono text-[12px] sm:text-[13px] leading-relaxed space-y-4">
                <div>
                  <p className="text-muted-foreground/50">$ riyaan agent start --runtime pi --voice</p>
                  <p className="text-brand/80 mt-1">Agent started with Pi runtime (voice enabled)</p>
                  <p className="text-muted-foreground/40">Listening on wss://localhost:7880...</p>
                </div>
                <div>
                  <p className="text-muted-foreground/50">[voice] &quot;Add a tool that checks warranty status&quot;</p>
                  <p className="text-foreground/70 mt-1">Creating tool &quot;check_warranty_status&quot;...</p>
                  <p className="text-foreground/60">  Parameters: orderId (string, required)</p>
                  <p className="text-foreground/60">  Endpoint: POST /api/tools/execute</p>
                  <p className="text-brand/80 mt-1">Tool registered. Guardrails applied automatically.</p>
                </div>
                <div>
                  <p className="text-muted-foreground/50">[voice] &quot;Switch provider to Anthropic&quot;</p>
                  <p className="text-foreground/70 mt-1">Switching provider: google → anthropic</p>
                  <p className="text-brand/80">Provider switched. Tools and guardrails preserved.</p>
                </div>
                <div>
                  <p className="text-muted-foreground/50">[voice] &quot;Run a test call with the dentist scenario&quot;</p>
                  <p className="text-foreground/70 mt-1">Starting test call...</p>
                  <p className="text-foreground/60">  Scenario: dentist-appointment</p>
                  <p className="text-foreground/60">  Provider: anthropic | Voice: gemini-realtime</p>
                  <p className="text-brand/80 mt-1">Call connected. Speak to test your agent.</p>
                </div>
                <p className="text-muted-foreground/30 animate-pulse">_</p>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground/40">
              Live terminal coming soon. This preview shows voice-driven agent building.
            </p>
          </FadeIn>
        )}

      </div>
    </section>
  );
}
