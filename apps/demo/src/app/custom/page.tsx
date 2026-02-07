'use client';

import { useVoiceChat } from '@genai-voice/react';
import Link from 'next/link';

export default function CustomDemo() {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    return (
      <Page>
        <div style={{ color: '#f87171' }}>
          Missing <code>NEXT_PUBLIC_GEMINI_API_KEY</code> in <code>.env.local</code>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <VoiceChatUI apiKey={apiKey} />
    </Page>
  );
}

function VoiceChatUI({ apiKey }: { apiKey: string }) {
  const {
    messages,
    isConnected,
    isListening,
    isAISpeaking,
    connect,
    disconnect,
    sendText,
    toggleMic,
    isMicEnabled,
  } = useVoiceChat({
    apiKey,
    config: {
      systemPrompt: 'You are a helpful voice assistant. Keep responses brief and conversational.',
      modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
      replyAsAudio: true,
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>
      {/* Status bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        fontSize: 14,
      }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isConnected ? '#22c55e' : '#ef4444',
        }} />
        <span>
          {!isConnected
            ? 'Disconnected'
            : isAISpeaking
              ? 'AI speaking...'
              : isListening
                ? 'Listening...'
                : 'Connected'}
        </span>
        <div style={{ flex: 1 }} />
        {isConnected && (
          <button
            onClick={toggleMic}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: isMicEnabled ? 'var(--card)' : '#7f1d1d',
              color: 'var(--fg)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {isMicEnabled ? 'Mute' : 'Unmute'}
          </button>
        )}
      </div>

      {/* Connect/disconnect */}
      {!isConnected ? (
        <button
          onClick={connect}
          style={{
            padding: '14px 28px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent)',
            color: 'white',
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Connect
        </button>
      ) : (
        <button
          onClick={disconnect}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid #dc2626',
            background: 'transparent',
            color: '#dc2626',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Disconnect
        </button>
      )}

      {/* Messages */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxHeight: 400,
        overflow: 'auto',
        padding: 16,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}>
        {messages.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: 32 }}>
            {isConnected ? 'Start speaking or type below...' : 'Connect to start a conversation'}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '8px 14px',
                borderRadius: 12,
                background: msg.role === 'user' ? 'var(--accent)' : '#1e293b',
                fontSize: 14,
              }}
            >
              {msg.content}
            </div>
          ))
        )}
      </div>

      {/* Text input */}
      {isConnected && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem('msg') as HTMLInputElement;
            if (input.value.trim()) {
              sendText(input.value);
              input.value = '';
            }
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            name="msg"
            placeholder="Type a message..."
            autoComplete="off"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              color: 'var(--fg)',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: 'white',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Send
          </button>
        </form>
      )}

      {/* Code snippet */}
      <details style={{ marginTop: 8 }}>
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
{`import { useVoiceChat } from '@genai-voice/react';

const {
  messages, isConnected, isListening, isAISpeaking,
  connect, disconnect, sendText, toggleMic,
} = useVoiceChat({
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
  config: {
    systemPrompt: 'You are a helpful voice assistant.',
    modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
    replyAsAudio: true,
  },
});`}
        </pre>
      </details>
    </div>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
      <Link href="/" style={{ fontSize: 14, color: 'var(--muted)' }}>
        &larr; Back
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '16px 0 8px' }}>
        Custom UI with useVoiceChat
      </h1>
      {children}
    </main>
  );
}
