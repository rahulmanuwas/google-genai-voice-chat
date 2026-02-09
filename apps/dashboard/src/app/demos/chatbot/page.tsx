'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScenarioPicker } from '@/components/demos/ScenarioPicker';
import { DEFAULT_SCENARIO, getScenarioById } from '@/lib/scenarios';
import { PageHeader } from '@/components/layout/page-header';

const ChatBot = dynamic(
  () => import('@genai-voice/react').then((mod) => mod.ChatBot),
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

      <ChatBot
        key={scenario.id}
        apiKey={apiKey}
        config={{
          systemPrompt: scenario.systemPrompt,
          modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
          replyAsAudio: true,
          welcomeMessage: scenario.welcomeMessage,
          chatTitle: scenario.chatTitle,
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
