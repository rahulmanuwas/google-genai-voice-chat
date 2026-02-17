'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScenarioPicker } from '@/components/demos/ScenarioPicker';
import { DEFAULT_SCENARIO, getScenarioById } from '@/lib/scenarios';
import { PageHeader } from '@/components/layout/page-header';

const ChatBot = dynamic(
  () => import('@genai-voice/sdk/chatbot').then((mod) => mod.ChatBot),
  { ssr: false },
);

export default function ChatBotDemo() {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO.id);
  const scenario = getScenarioById(scenarioId);

  if (!apiKey) {
    return (
      <div>
        <MissingEnvCard vars={['NEXT_PUBLIC_GEMINI_API_KEY']} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Voice Chat" description="The floating chat widget appears in the bottom-right corner.">
        <ScenarioPicker value={scenarioId} onChange={setScenarioId} />
      </PageHeader>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 rounded-full bg-brand/10 p-4">
            <svg className="h-8 w-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Click the chat bubble</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            The voice chat widget is in the bottom-right corner. Click it to start a conversation with the <strong>{scenario.chatTitle || 'AI assistant'}</strong>.
          </p>
        </CardContent>
      </Card>

      <ChatBot
        key={scenario.id}
        apiKey={apiKey}
        config={{
          systemPrompt: scenario.systemPrompt,
          modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
          replyAsAudio: true,
          welcomeMessage: scenario.welcomeMessage,
          chatTitle: scenario.chatTitle,
          theme: { primaryColor: 'hsl(38 92% 50%)' },
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
