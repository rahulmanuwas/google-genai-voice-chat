'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScenarioPicker } from '@/components/demos/ScenarioPicker';
import { AgentModePicker, type AgentMode } from '@/components/demos/AgentModePicker';
import { DEFAULT_SCENARIO, getScenarioById } from '@/lib/scenarios';
import { PageHeader } from '@/components/layout/page-header';
import { DemoObservabilityPanel } from '@/components/demos/DemoObservabilityPanel';
import { ScenarioStatePanel } from '@/components/demos/ScenarioStatePanel';
import { useScenarioStateChanges } from '@/lib/hooks/use-scenario-state-changes';
import { useDemoTimeline } from '@/lib/hooks/use-demo-timeline';

const CallRoom = dynamic(() => import('./CallRoom'), { ssr: false });

interface CallResult {
  roomName: string;
  participantIdentity?: string;
  viewerToken: string;
  serverUrl: string;
}

export default function TwilioCallDemo() {
  const [to, setTo] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [result, setResult] = useState<CallResult | null>(null);
  const [callEnded, setCallEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO.id);
  const [agentMode, setAgentMode] = useState<AgentMode>('realtime');
  const scenario = getScenarioById(scenarioId);
  const { changes: stateChanges } = useScenarioStateChanges(scenario);
  const {
    mergedTimeline,
    addTimeline,
    handleAgentStateChange,
    handleTranscript,
    handleHandoff,
  } = useDemoTimeline(scenario.id, stateChanges);

  const handleScenarioChange = useCallback((nextScenarioId: string) => {
    setScenarioId(nextScenarioId);
    setResult(null);
    setCallEnded(false);
    setError(null);
    setIsStarting(false);
  }, []);

  const start = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    setResult(null);
    setCallEnded(false);
    addTimeline({
      subsystem: 'system',
      status: 'info',
      title: 'Dialing outbound PSTN call',
      detail: `Destination: ${to || 'unknown'}`,
    });

    try {
      const res = await fetch('/api/twilio/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, appSlug: scenario.appSlug, agentMode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to start call');
      if (!data.roomName || !data.viewerToken) {
        throw new Error('Unexpected response: missing roomName or viewerToken');
      }
      setResult({
        roomName: data.roomName,
        participantIdentity: data.participant?.participantIdentity,
        viewerToken: data.viewerToken,
        serverUrl: data.serverUrl,
      });
      addTimeline({
        subsystem: 'system',
        status: 'success',
        title: 'Outbound room connected',
        detail: `Room: ${data.roomName}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      addTimeline({
        subsystem: 'system',
        status: 'error',
        title: 'Failed to start call',
        detail: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsStarting(false);
    }
  }, [addTimeline, to, scenario.appSlug]);

  const onCallEnded = useCallback(() => {
    setCallEnded(true);
    addTimeline({
      subsystem: 'system',
      status: 'warning',
      title: 'Call ended',
      detail: 'Remote participant disconnected.',
    });
  }, [addTimeline]);

  const resetCall = useCallback(() => {
    setResult(null);
    setCallEnded(false);
    addTimeline({
      subsystem: 'system',
      status: 'info',
      title: 'Call room reset',
      detail: 'Ready for a new outbound call.',
    });
  }, [addTimeline]);

  return (
    <div className="space-y-6">
      <PageHeader title="PSTN Call" description="LiveKit SIP outbound call via Twilio trunk" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle>LiveKit SIP Outbound Call</CardTitle>
                  <Badge variant="secondary">Twilio Trunk</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <ScenarioPicker value={scenarioId} onChange={handleScenarioChange} />
                  <AgentModePicker value={agentMode} onChange={setAgentMode} />
                </div>
              </div>
              <CardDescription>
                Dials a phone number via LiveKit SIP using your configured Twilio SIP trunk,
                bridges the call into a LiveKit room, and shows live transcriptions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">To (E.164)</Label>
                <Input
                  id="phone"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="+15551234567"
                  autoComplete="off"
                  disabled={!!result}
                />
              </div>

              <div className="flex items-center gap-3">
                {!result ? (
                  <Button onClick={start} disabled={isStarting}>
                    {isStarting ? 'Starting...' : 'Start Call'}
                  </Button>
                ) : callEnded ? (
                  <Button onClick={resetCall}>New Call</Button>
                ) : (
                  <Button variant="destructive" onClick={resetCall}>
                    End Call
                  </Button>
                )}

                {result && !callEnded && (
                  <span className="text-sm text-green-500">
                    Connected to room: <code className="text-xs">{result.roomName}</code>
                  </span>
                )}
                {callEnded && (
                  <span className="text-sm text-muted-foreground">
                    Call ended
                  </span>
                )}
              </div>

              {error && (
                <div className="text-sm text-destructive">
                  Error: <code className="text-xs">{error}</code>
                </div>
              )}
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Live Transcription</CardTitle>
              </CardHeader>
              <CardContent>
                <CallRoom
                  token={result.viewerToken}
                  serverUrl={result.serverUrl}
                  onCallEnded={onCallEnded}
                  onAgentStateChange={handleAgentStateChange}
                  onTranscript={handleTranscript}
                  onHandoff={handleHandoff}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <DemoObservabilityPanel
            scenario={scenario}
            timeline={mergedTimeline}
            stateChanges={stateChanges}
          />

          {(scenario.id === 'dentist' || scenario.id === 'ecommerce') && (
            <ScenarioStatePanel key={scenario.id} scenario={scenario} />
          )}
        </div>
      </div>
    </div>
  );
}
