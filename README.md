# genai-voice

AI voice agent platform powered by Google Gemini. From a drop-in React chat widget to a full enterprise agent backend with tools, handoff, guardrails, knowledge base, and multi-channel telephony.

[![npm version](https://badge.fury.io/js/google-genai-voice-chat.svg)](https://www.npmjs.com/package/google-genai-voice-chat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Packages

| Package | Description | Status |
|---|---|---|
| [`@genai-voice/react`](./packages/react) | Drop-in voice/text chat React components + hooks | Stable |
| [`@genai-voice/convex`](./packages/convex) | Convex backend: tools, handoff, guardrails, RAG, analytics | New |
| [`@genai-voice/core`](./packages/core) | Shared types and conversation protocol | New |
| [`@genai-voice/telephony`](./packages/telephony) | Telnyx (voice) + Twilio (SMS) adapters | New |

## Architecture

```
packages/
├── core/           Shared types (conversation, tools, handoff, guardrails, knowledge, analytics, persona)
├── react/          React voice/text chat UI + hooks (published as google-genai-voice-chat on npm)
├── convex/         Convex backend platform (14 tables, 20+ HTTP endpoints)
└── telephony/      Provider-agnostic telephony adapters (Telnyx, Twilio)
```

## Quick Start

### Tier 1 — Just a voice widget

```bash
npm install @genai-voice/react @google/genai
```

```tsx
import { ChatBot } from '@genai-voice/react';

function App() {
  return (
    <ChatBot
      apiKey={process.env.NEXT_PUBLIC_GEMINI_API_KEY!}
      config={{
        systemPrompt: 'You are a helpful assistant...',
        modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
        replyAsAudio: true,
      }}
    />
  );
}
```

### Tier 2 — Agent platform with tools, handoff, and analytics

```bash
npm install @genai-voice/react @genai-voice/convex @google/genai
```

Deploy the Convex backend, register tools the AI can call, configure guardrails, and get a real-time analytics dashboard. See the [Convex backend docs](./packages/convex/README.md).

### Tier 3 — Multi-channel (phone + SMS)

```bash
npm install @genai-voice/react @genai-voice/convex @genai-voice/telephony
```

Add Telnyx for voice calls and Twilio for SMS, all feeding into the same Convex conversation engine. See the [Telephony docs](./packages/telephony/README.md).

## Monorepo Setup

This project uses [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/).

```bash
# Install all dependencies
pnpm install

# Build all packages (respects dependency order)
pnpm build

# Development mode (watches all packages)
pnpm dev

# Run all tests
pnpm test

# Type check everything
pnpm typecheck

# Lint everything
pnpm lint
```

## Using Individual Hooks

For custom UIs, use the hooks directly:

```tsx
import { useVoiceChat } from '@genai-voice/react';

function CustomChat() {
  const {
    messages,
    isConnected,
    isListening,
    isAISpeaking,
    getStats,
    connect,
    disconnect,
    sendText,
    toggleMute,
    toggleMic,
  } = useVoiceChat({
    apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY!,
    // or fetch ephemeral tokens:
    // getApiKey: async () => (await fetch('/api/genai-token')).text(),
    config: {
      systemPrompt: 'You are a helpful assistant...',
      modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
    },
  });

  // Build your own UI...
}
```

## Configuration

### Core

| Option | Type | Default | Notes |
|---|---|---|---|
| `systemPrompt` | `string` | required | System instruction for the AI |
| `modelId` | `string` | required | Live API model ID |
| `welcomeMessage` | `string` | `"Hello! How can I help you today?"` | UI-only system message |
| `suggestedQuestions` | `string[]` | `[]` | Suggested question buttons |
| `sessionStorageKey` | `string` | `"genai-voice-chat-session"` | localStorage key for session handle |
| `replyAsAudio` | `boolean` | `true` | AUDIO vs TEXT response modality |
| `chatTitle` | `string` | `"AI Assistant"` | Header title |
| `theme.primaryColor` | `string` | `"#2563eb"` | Accent color |
| `theme.position` | `"bottom-right" \| "bottom-left"` | `"bottom-right"` | Launcher position |

### Audio + VAD

| Option | Type | Default | Notes |
|---|---|---|---|
| `useClientVAD` | `boolean` | `false` | Server VAD by default |
| `serverVADPrefixPaddingMs` | `number` | `500` | VAD pre-roll padding |
| `serverVADSilenceDurationMs` | `number` | `1000` | Silence window before end-of-speech |
| `serverVADStartSensitivity` | `StartSensitivity` | `LOW` | Lower = less sensitive |
| `serverVADEndSensitivity` | `EndSensitivity` | `HIGH` | Lower = longer tail |
| `playbackSampleRate` | `number` | `24000` | Output sample rate |
| `playbackStartDelayMs` | `number` | `0` | Buffer before playback starts |
| `micResumeDelayMs` | `number` | `200` | Delay before mic resumes after playback |
| `autoStartMicOnConnect` | `boolean` | `true` | Start mic immediately after connect |
| `autoWelcomeAudio` | `boolean` | `false` | Speak a welcome prompt on connect |

### Reliability & Backpressure

| Option | Type | Default | Notes |
|---|---|---|---|
| `connectTimeoutMs` | `number` | `12000` | Timeout for initial connection |
| `reconnectMaxRetries` | `number` | `3` | Max reconnection attempts |
| `reconnectBaseDelayMs` | `number` | `1500` | Base delay for reconnection backoff |
| `reconnectBackoffFactor` | `number` | `1.5` | Backoff multiplier |
| `reconnectMaxDelayMs` | `number` | `15000` | Max backoff delay |
| `outputDropPolicy` | `AudioDropPolicy` | `drop-oldest` | Behavior when output queue overflows |
| `inputDropPolicy` | `AudioDropPolicy` | `drop-oldest` | Behavior when input queue overflows |
| `preferAudioWorklet` | `boolean` | `true` | Use AudioWorklet for mic capture |

## Telemetry Module

Built-in helpers for logging events and conversations to a [Convex](https://convex.dev) backend.

```tsx
import { createConvexHelper, useTelemetry } from '@genai-voice/react';

const convex = createConvexHelper({
  url: process.env.NEXT_PUBLIC_CONVEX_URL!,
  appSlug: 'my-app',
  appSecret: process.env.NEXT_PUBLIC_APP_SECRET!,
});

function Chat() {
  const { onEvent, flushEvents, saveTranscript, resetSession } = useTelemetry({ convex });

  const config = useMemo(() => ({
    ...VOICE_CHAT_CONFIG,
    httpOptions: { apiVersion: 'v1alpha' },
    onEvent,
  }), [onEvent]);

  const getApiKey = useCallback(() => convex.fetchToken(), []);
  const { messages, disconnect } = useVoiceChat({ config, getApiKey });

  const handleClose = useCallback(async () => {
    flushEvents();
    saveTranscript(messages);
    await disconnect();
    resetSession();
  }, [disconnect, flushEvents, saveTranscript, messages, resetSession]);
}
```

### What `useTelemetry` handles

- **Session ID** -- generated on mount, reset via `resetSession()`
- **Event buffering** -- batches events (flush at 20 events or every 5 seconds)
- **Noise filtering** -- skips `audio_output_queue_overflow` and `playback_context_state`
- **Page unload** -- flushes remaining events via `sendBeacon` on `pagehide`

## Text-only API Route

For server-side text chat (Next.js):

```ts
// app/api/chat/route.ts
import { createChatHandler } from '@genai-voice/react/api';

export const POST = createChatHandler({
  systemPrompt: 'You are a helpful assistant...',
  model: 'gemini-2.0-flash',
});
```

## Environment Variables

```bash
# Client-side (Next.js)
NEXT_PUBLIC_GEMINI_API_KEY=your-api-key

# Server-side API routes
GEMINI_API_KEY=your-api-key

# Convex backend (for telemetry)
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_APP_SECRET=your-app-secret
```

## Troubleshooting

- **No audio output**: ensure a user gesture created the AudioContext. Call `connect()` on a click. Confirm `replyAsAudio: true`.
- **Audio skips words**: increase `playbackStartDelayMs` (100-200ms) and `micResumeDelayMs` (400-800ms).
- **1008 referer blocked**: check Google Cloud referrer restrictions or use ephemeral tokens.
- **Mic blocked**: grant microphone permissions in browser settings.

## Requirements

- Node.js 18+
- React 18+
- `@google/genai`
- Gemini API key with Live API access

## License

MIT
