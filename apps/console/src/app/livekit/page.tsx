'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Import LiveKit component with SSR disabled
const LiveKitVoiceChat = dynamic(
  () => import('@genai-voice/livekit').then((mod) => mod.LiveKitVoiceChat),
  { ssr: false },
);

export default function LiveKitDemo() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  const missing = [
    !convexUrl && 'NEXT_PUBLIC_CONVEX_URL',
    !livekitUrl && 'NEXT_PUBLIC_LIVEKIT_URL',
  ].filter(Boolean);

  /**
   * Fetch a short-lived session token from our server-side route.
   * The server exchanges APP_SECRET for a token — the browser never sees the secret.
   */
  const getSessionToken = useCallback(async () => {
    const res = await fetch('/api/session', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to get session token');
    const data = await res.json();
    return data.sessionToken as string;
  }, []);

  return (
    <Page>
      {missing.length > 0 ? (
        <div style={{ color: '#f87171' }}>
          <p>Missing environment variables in <code>.env.local</code>:</p>
          <ul style={{ marginTop: 8 }}>
            {missing.map((v) => (
              <li key={v as string}>
                <code>{v}</code>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 12, color: 'var(--muted)', fontSize: 14 }}>
            This demo requires a deployed Convex backend with LiveKit endpoints
            and a LiveKit Cloud account.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 24 }}>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            Click &quot;Start Voice Chat&quot; to create a LiveKit room and connect.
            A server-side AI agent (powered by Gemini Live API) will join the room
            and respond with speech.
          </p>

          <LiveKitVoiceChat
            convexUrl={convexUrl!}
            appSlug="demo"
            getSessionToken={getSessionToken}
            serverUrl={livekitUrl}
          />

          <details style={{ marginTop: 32 }}>
            <summary style={{ cursor: 'pointer', fontSize: 14, color: 'var(--muted)' }}>
              View code
            </summary>
            <pre style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 16,
              fontSize: 12,
              overflow: 'auto',
              marginTop: 8,
            }}>
{`import { LiveKitVoiceChat } from '@genai-voice/livekit';

// In your server route (e.g. /api/session):
// POST to convexUrl/api/auth/session with appSlug + appSecret
// Return { sessionToken, expiresAt }

// In your component:
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
/>`}
            </pre>
          </details>

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontSize: 14, color: 'var(--muted)' }}>
              Or use the hook for a custom UI
            </summary>
            <pre style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 16,
              fontSize: 12,
              overflow: 'auto',
              marginTop: 8,
            }}>
{`import { useLiveKitVoiceChat } from '@genai-voice/livekit';

const {
  token, roomName, serverUrl,
  isReady, isConnecting, error,
  connect, disconnect,
} = useLiveKitVoiceChat({
  convexUrl: '...',
  appSlug: 'demo',
  getSessionToken: async () => {
    const res = await fetch('/api/session', { method: 'POST' });
    const { sessionToken } = await res.json();
    return sessionToken;
  },
  serverUrl: 'wss://your-app.livekit.cloud',
});

// Pass token + serverUrl to <LiveKitRoom> from @livekit/components-react`}
            </pre>
          </details>
        </div>
      )}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
      <Link href="/" style={{ fontSize: 14, color: 'var(--muted)' }}>
        &larr; Back
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '16px 0 8px' }}>
        LiveKit Voice Agent
      </h1>
      {children}
    </main>
  );
}
