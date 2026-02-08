'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScenarioPicker } from '@/components/demos/ScenarioPicker';
import { DEFAULT_SCENARIO, getScenarioById } from '@/lib/scenarios';

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
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO.id);
  const scenario = getScenarioById(scenarioId);

  const start = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/twilio/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, appSlug: scenario.appSlug }),
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsStarting(false);
    }
  }, [to, scenario.appSlug]);

  const endCall = useCallback(() => {
    setResult(null);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>LiveKit SIP Outbound Call</CardTitle>
              <Badge variant="secondary">Twilio Trunk</Badge>
            </div>
            <ScenarioPicker value={scenarioId} onChange={setScenarioId} />
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
            ) : (
              <Button variant="destructive" onClick={endCall}>
                End Call
              </Button>
            )}

            {result && (
              <span className="text-sm text-green-500">
                Connected to room: <code className="text-xs">{result.roomName}</code>
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
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
