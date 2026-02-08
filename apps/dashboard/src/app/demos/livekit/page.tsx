'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const LiveKitVoiceChat = dynamic(
  () => import('@genai-voice/livekit').then((mod) => mod.LiveKitVoiceChat),
  { ssr: false },
);

const COMPONENT_SNIPPET = `import { LiveKitVoiceChat } from '@genai-voice/livekit';

const getSessionToken = async () => {
  const res = await fetch('/api/session', { method: 'POST' });
  const { sessionToken } = await res.json();
  return sessionToken;
};

<LiveKitVoiceChat
  convexUrl="https://your-deployment.convex.cloud"
  appSlug="demo"
  getSessionToken={getSessionToken}
  serverUrl="wss://your-app.livekit.cloud"
/>`;

const HOOK_SNIPPET = `import { useLiveKitVoiceChat } from '@genai-voice/livekit';

const {
  token, roomName, serverUrl,
  isReady, isConnecting, error,
  connect, disconnect,
} = useLiveKitVoiceChat({
  convexUrl: '...',
  appSlug: 'demo',
  getSessionToken: async () => { ... },
  serverUrl: 'wss://your-app.livekit.cloud',
});

// Pass token + serverUrl to <LiveKitRoom>`;

export default function LiveKitDemo() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  const missing = [
    !convexUrl && 'NEXT_PUBLIC_CONVEX_URL',
    !livekitUrl && 'NEXT_PUBLIC_LIVEKIT_URL',
  ].filter(Boolean) as string[];

  const getSessionToken = useCallback(async () => {
    const res = await fetch('/api/session', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to get session token');
    const data = await res.json();
    return data.sessionToken as string;
  }, []);

  if (missing.length > 0) {
    return (
      <div className="p-6">
        <MissingEnvCard vars={missing} hint="This demo requires a deployed Convex backend with LiveKit endpoints and a LiveKit Cloud account." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>LiveKit Voice Agent</CardTitle>
            <Badge variant="secondary">@genai-voice/livekit</Badge>
          </div>
          <CardDescription>
            Click &quot;Start Voice Chat&quot; to create a LiveKit room and connect.
            A server-side AI agent (powered by Gemini Live API) will join the room
            and respond with speech.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LiveKitVoiceChat
            convexUrl={convexUrl!}
            appSlug="demo"
            getSessionToken={getSessionToken}
            serverUrl={livekitUrl}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Component Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-lg border bg-muted/50 p-4 text-xs">
            {COMPONENT_SNIPPET}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hook Usage (Custom UI)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-lg border bg-muted/50 p-4 text-xs">
            {HOOK_SNIPPET}
          </pre>
        </CardContent>
      </Card>
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
