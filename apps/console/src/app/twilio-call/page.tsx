'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';

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

  const start = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/twilio/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
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
  }, [to]);

  const endCall = useCallback(() => {
    setResult(null);
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
      <Link href="/" style={{ fontSize: 14, color: 'var(--muted)' }}>
        &larr; Back
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '16px 0 8px' }}>
        LiveKit SIP Outbound Call (Twilio Trunk)
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>
        Dials a phone number via LiveKit SIP using your configured Twilio SIP trunk,
        bridges the call into a LiveKit room, and shows live transcriptions.
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginTop: 24,
          padding: 16,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>To (E.164)</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="+15551234567"
            autoComplete="off"
            disabled={!!result}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--fg)',
              outline: 'none',
              opacity: result ? 0.5 : 1,
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {!result ? (
            <button
              onClick={start}
              disabled={isStarting}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent)',
                color: 'white',
                fontSize: 14,
                cursor: isStarting ? 'wait' : 'pointer',
                opacity: isStarting ? 0.75 : 1,
              }}
            >
              {isStarting ? 'Starting...' : 'Start Call'}
            </button>
          ) : (
            <button
              onClick={endCall}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: '1px solid #dc2626',
                background: 'transparent',
                color: '#dc2626',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              End Call
            </button>
          )}

          {result && (
            <span style={{ fontSize: 13, color: '#22c55e' }}>
              Connected to room: <code>{result.roomName}</code>
            </span>
          )}
        </div>

        {error && (
          <div style={{ fontSize: 13, color: '#f87171' }}>
            Error: <code>{error}</code>
          </div>
        )}
      </div>

      {result && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
            Live Transcription
          </h2>
          <CallRoom
            token={result.viewerToken}
            serverUrl={result.serverUrl}
          />
        </div>
      )}
    </main>
  );
}
