'use client';

import { useState } from 'react';
import { useVoiceChat } from '@genai-voice/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ScenarioPicker } from '@/components/demos/ScenarioPicker';
import { DEFAULT_SCENARIO, getScenarioById, type Scenario } from '@/lib/scenarios';
import { PageHeader } from '@/components/layout/page-header';

export default function CustomDemo() {
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
      <PageHeader title="Custom UI" description="Full control with the useVoiceChat hook">
        <ScenarioPicker value={scenarioId} onChange={setScenarioId} />
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <VoiceChatUI key={scenario.id} apiKey={apiKey} scenario={scenario} />
        </CardContent>
      </Card>
    </div>
  );
}

function VoiceChatUI({ apiKey, scenario }: { apiKey: string; scenario: Scenario }) {
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
      systemPrompt: scenario.systemPrompt,
      modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
      replyAsAudio: true,
    },
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Status bar */}
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        {/* State indicator pill */}
        <div className={cn(
          'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-wide',
          !isConnected
            ? 'bg-muted text-muted-foreground'
            : isListening
              ? 'bg-red-500/10 text-red-500 border border-red-500/20'
              : isAISpeaking
                ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                : 'bg-brand/10 text-brand border border-brand/20',
        )}>
          <span className="relative inline-flex h-2 w-2">
            {(isConnected && (isListening || isAISpeaking)) && (
              <span className={cn(
                'absolute inset-0 rounded-full animate-ping opacity-60',
                isListening ? 'bg-red-500' : 'bg-green-500',
              )} />
            )}
            <span className={cn(
              'relative h-2 w-2 rounded-full',
              !isConnected ? 'bg-muted-foreground' : isListening ? 'bg-red-500' : isAISpeaking ? 'bg-green-500' : 'bg-brand',
            )} />
          </span>
          {!isConnected ? 'Disconnected' : isListening ? 'Listening' : isAISpeaking ? 'Speaking' : 'Ready'}
        </div>
        <div className="flex-1" />
        {isConnected && (
          <Button variant="outline" size="sm" onClick={toggleMic}>
            {isMicEnabled ? 'Mute' : 'Unmute'}
          </Button>
        )}
      </div>

      {/* Connect/disconnect */}
      {!isConnected ? (
        <Button onClick={connect} size="lg">
          Connect
        </Button>
      ) : (
        <Button variant="destructive" onClick={disconnect}>
          Disconnect
        </Button>
      )}

      {/* Messages */}
      <div className="flex max-h-96 flex-col gap-3 overflow-auto rounded-lg border p-4">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {isConnected ? 'Start speaking or type below...' : 'Connect to start a conversation'}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'max-w-[90%] md:max-w-[80%] rounded-xl px-3.5 py-2 text-sm',
                msg.role === 'user'
                  ? 'self-end bg-primary text-primary-foreground'
                  : 'self-start bg-muted',
              )}
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
          className="flex gap-2"
        >
          <Input name="msg" placeholder="Type a message..." autoComplete="off" />
          <Button type="submit">Send</Button>
        </form>
      )}
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
