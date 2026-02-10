'use client';

import { forwardRef, useEffect, useMemo, useRef, useState, useImperativeHandle } from 'react';
import { useVoiceChat, type ChatMessageType as ChatMessage } from '@genai-voice/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScenarioPicker } from '@/components/demos/ScenarioPicker';
import { DEFAULT_SCENARIO, getScenarioById, type Scenario } from '@/lib/scenarios';
import { PageHeader } from '@/components/layout/page-header';
import {
  buildMemoryPrompt,
  clearDemoMemory,
  loadDemoMemory,
  saveDemoMemory,
  type DemoMemory,
} from '@/lib/demo-memory';

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
  const sessionRef = useRef<VoiceChatSessionHandle | null>(null);
  const [chatNonce, setChatNonce] = useState(0);
  const [memory, setMemory] = useState<DemoMemory | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  useEffect(() => {
    setMemory(loadDemoMemory(scenario.appSlug));
    setMemoryError(null);
  }, [scenario.appSlug]);

  const systemPrompt = useMemo(() => {
    return scenario.systemPrompt + buildMemoryPrompt(memory);
  }, [scenario.systemPrompt, memory]);

  const extractMemory = async () => {
    const msgs = sessionRef.current?.messages ?? [];
    const usable = msgs
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    if (usable.length === 0) {
      setMemoryError('No transcript yet. Say something first.');
      return;
    }

    setMemoryLoading(true);
    setMemoryError(null);
    try {
      const res = await fetch('/api/memory/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: usable }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Memory extraction failed');
      }

      const data = (await res.json()) as {
        userName: string | null;
        facts: string[];
        conversationSummary: string;
      };

      const next: DemoMemory = {
        userName: data.userName ?? null,
        facts: Array.isArray(data.facts) ? data.facts : [],
        conversationSummary: data.conversationSummary ?? null,
        updatedAt: Date.now(),
      };

      saveDemoMemory(scenario.appSlug, next);
      setMemory(next);
    } catch (e) {
      setMemoryError(e instanceof Error ? e.message : 'Memory extraction failed');
    } finally {
      setMemoryLoading(false);
    }
  };

  const clearMemory = () => {
    clearDemoMemory(scenario.appSlug);
    setMemory(null);
    setMemoryError(null);
  };

  const startNewChat = async () => {
    setMemoryError(null);
    await sessionRef.current?.disconnect();
    setChatNonce((n) => n + 1);
  };

  const hasMemory =
    Boolean(memory?.userName) ||
    (Array.isArray(memory?.facts) && memory!.facts.length > 0) ||
    Boolean(memory?.conversationSummary);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <VoiceChatSession
        // Remounting resets transcript + forces a fresh Gemini Live session.
        key={chatNonce}
        ref={sessionRef}
        apiKey={apiKey}
        config={{
          systemPrompt,
          modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
          replyAsAudio: true,
          sessionStorageKey: `genai-voice-demo:${scenario.appSlug}:session`,
          clearSessionOnMount: true,
        }}
      />

      <Card className="h-fit">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Memory (Demo)</CardTitle>
            <Badge variant={hasMemory ? 'default' : 'secondary'}>
              {hasMemory ? 'Loaded' : 'Empty'}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Extracts long-term user facts from the transcript, stores them in localStorage, and injects them into the next chat session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasMemory ? (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              {memory?.userName && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Name:</span>{' '}
                  <span className="font-medium">{memory.userName}</span>
                </div>
              )}
              {memory?.facts?.length ? (
                <ul className="space-y-1 text-sm">
                  {memory.facts.slice(0, 5).map((f, i) => (
                    <li key={`${i}-${f}`} className="text-muted-foreground">
                      {f}
                    </li>
                  ))}
                </ul>
              ) : null}
              {memory?.conversationSummary ? (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">Last:</span>{' '}
                  {memory.conversationSummary}
                </div>
              ) : null}
              <div className="text-[11px] text-muted-foreground">
                Updated: {memory?.updatedAt ? new Date(memory.updatedAt).toLocaleString() : 'unknown'}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/10 p-3 text-xs text-muted-foreground">
              No memory stored yet. Have a short conversation, then click &quot;Update memory&quot;.
            </div>
          )}

          {memoryError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {memoryError}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={extractMemory} disabled={memoryLoading} variant="default">
              {memoryLoading ? 'Updating…' : 'Update Memory From Transcript'}
            </Button>
            <Button onClick={startNewChat} variant="outline">
              Start New Chat (Keeps Memory)
            </Button>
            <Button onClick={clearMemory} variant="ghost">
              Clear Memory
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/10 p-3 text-xs text-muted-foreground">
            Demo script: say &quot;Hi, I&apos;m Rahul. I prefer afternoon appointments.&quot; then click &quot;Update Memory&quot; and &quot;Start New Chat&quot;. Ask &quot;Do you remember me?&quot;
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type VoiceChatSessionHandle = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendText: (text: string) => void;
  messages: ChatMessage[];
  isConnected: boolean;
};

const VoiceChatSession = forwardRef<
  VoiceChatSessionHandle,
  { apiKey: string; config: { systemPrompt: string; modelId: string; replyAsAudio: boolean; sessionStorageKey: string; clearSessionOnMount: boolean } }
>(function VoiceChatSession({ apiKey, config }, ref) {
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
      ...config,
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      connect,
      disconnect,
      sendText,
      messages,
      isConnected,
    }),
    [connect, disconnect, sendText, messages, isConnected],
  );

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
});

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
