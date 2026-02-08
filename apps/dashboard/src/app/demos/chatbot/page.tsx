'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ChatBot = dynamic(
  () => import('@genai-voice/react').then((mod) => mod.ChatBot),
  { ssr: false },
);

const CODE_SNIPPET = `import { ChatBot } from '@genai-voice/react';

<ChatBot
  apiKey={process.env.NEXT_PUBLIC_GEMINI_API_KEY!}
  config={{
    systemPrompt: 'You are a helpful assistant.',
    modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
    replyAsAudio: true,
  }}
/>`;

export default function ChatBotDemo() {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    return (
      <div className="p-6">
        <MissingEnvCard vars={['NEXT_PUBLIC_GEMINI_API_KEY']} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Drop-in ChatBot Widget</CardTitle>
            <Badge variant="secondary">@genai-voice/react</Badge>
          </div>
          <CardDescription>
            The floating chat widget is in the bottom-right corner. Click it to start a conversation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-lg border bg-muted/50 p-4 text-xs">
            {CODE_SNIPPET}
          </pre>
        </CardContent>
      </Card>

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
    </div>
  );
}

function MissingEnvCard({ vars }: { vars: string[] }) {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Missing Environment Variables</CardTitle>
        <CardDescription>
          Add the following to your <code className="text-xs">.env.local</code> file:
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {vars.map((v) => (
            <li key={v}>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{v}</code>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
