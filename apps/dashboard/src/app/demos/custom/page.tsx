'use client';

import { useVoiceChat } from '@genai-voice/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const CODE_SNIPPET = `import { useVoiceChat } from '@genai-voice/react';

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
});`;

export default function CustomDemo() {
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
            <CardTitle>Custom UI with useVoiceChat</CardTitle>
            <Badge variant="secondary">@genai-voice/react</Badge>
          </div>
          <CardDescription>
            Full control over UI/UX by building custom components around the useVoiceChat hook.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VoiceChatUI apiKey={apiKey} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Code</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-lg border bg-muted/50 p-4 text-xs">
            {CODE_SNIPPET}
          </pre>
        </CardContent>
      </Card>
    </div>
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
    <div className="flex flex-col gap-4">
      {/* Status bar */}
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            isConnected ? 'bg-green-500' : 'bg-red-500',
          )}
        />
        <span className="text-sm">
          {!isConnected
            ? 'Disconnected'
            : isAISpeaking
              ? 'AI speaking...'
              : isListening
                ? 'Listening...'
                : 'Connected'}
        </span>
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
                'max-w-[80%] rounded-xl px-3.5 py-2 text-sm',
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
