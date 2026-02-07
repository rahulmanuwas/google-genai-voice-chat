'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

// Import ChatBot with SSR disabled (uses browser APIs)
const ChatBot = dynamic(
  () => import('@genai-voice/react').then((mod) => mod.ChatBot),
  { ssr: false },
);

export default function ChatBotDemo() {
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
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>
        The floating chat widget is in the bottom-right corner. Click it to start a conversation.
      </p>

      <pre style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 16,
        fontSize: 13,
        overflow: 'auto',
        marginTop: 24,
      }}>
{`import { ChatBot } from '@genai-voice/react';

<ChatBot
  apiKey={process.env.NEXT_PUBLIC_GEMINI_API_KEY!}
  config={{
    systemPrompt: 'You are a helpful assistant.',
    modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
    replyAsAudio: true,
  }}
/>`}
      </pre>

      <ChatBot
        apiKey={apiKey}
        config={{
          systemPrompt: 'You are a helpful voice assistant. Keep responses concise.',
          modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
          replyAsAudio: true,
          welcomeMessage: 'Hello! Click the mic or type a message to get started.',
          chatTitle: 'Demo Assistant',
        }}
      />
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
        Drop-in ChatBot
      </h1>
      {children}
    </main>
  );
}
