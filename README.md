# google-genai-voice-chat

Real-time voice and text chat UI + hooks for Google Gemini Live API.

[![npm version](https://badge.fury.io/js/google-genai-voice-chat.svg)](https://www.npmjs.com/package/google-genai-voice-chat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Real-time voice + text chat with Gemini Live API
- Drop-in `ChatBot` UI and low-level hooks
- Session resumption (handle storage)
- Configurable server VAD (sensitivity + silence window)
- Playback buffering and mic resume delays
- AudioWorklet mic capture + input/output backpressure controls
- Optional welcome audio prompt
- Theme + placement customization

## Installation

```bash
npm install google-genai-voice-chat @google/genai
```

Bleeding edge (GitHub main):

```bash
npm install github:rahulmanuwas/google-genai-voice-chat#main
```

## Quick Start

```tsx
import { ChatBot } from 'google-genai-voice-chat';

function App() {
  return (
    <ChatBot
      apiKey={process.env.NEXT_PUBLIC_GEMINI_API_KEY!}
      config={{
        systemPrompt: 'You are a helpful assistant...',
        modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
        replyAsAudio: true,
        autoStartMicOnConnect: false,
        chatTitle: 'AI Assistant',
      }}
    />
  );
}
```

Note: Browsers require a user gesture to start audio. Wire `connect()` to a button click or set `autoStartMicOnConnect: false` and prompt the user to enable mic.
You can also pass `getApiKey` to `ChatBot`/`useVoiceChat` to fetch ephemeral tokens at connect time.

## Using Individual Hooks

```tsx
import { useVoiceChat } from 'google-genai-voice-chat';

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

Tip: call `getStats()` for a lightweight snapshot of queue and reconnect metrics.

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

Note: Live API supports only one response modality per session. Use `replyAsAudio: true` for audio responses or `false` for text-only.

### Audio format

- Input audio is 16-bit PCM at 16kHz (the hook downsamples automatically).
- Output audio is 16-bit PCM at 24kHz (the hook plays it at 24kHz).

### Audio + VAD

| Option | Type | Default | Notes |
|---|---|---|---|
| `useClientVAD` | `boolean` | `false` | Server VAD by default. Client VAD requires custom activity start/end handling. |
| `serverVADPrefixPaddingMs` | `number` | `500` | VAD pre-roll padding |
| `serverVADSilenceDurationMs` | `number` | `1000` | Silence window before end-of-speech |
| `serverVADStartSensitivity` | `StartSensitivity` | `LOW` | Lower = less sensitive |
| `serverVADEndSensitivity` | `EndSensitivity` | `HIGH` | Lower = longer tail |
| `playbackSampleRate` | `number` | `24000` | Output sample rate |
| `playbackStartDelayMs` | `number` | `0` | Buffer before playback starts |
| `micResumeDelayMs` | `number` | `200` | Delay before mic resumes after playback |
| `autoPauseMicOnSendText` | `boolean` | `true` | Prevents echo when sending text |
| `autoStartMicOnConnect` | `boolean` | `true` | Start mic immediately after connect |
| `autoWelcomeAudio` | `boolean` | `false` | Speak a welcome prompt on connect |
| `welcomeAudioPrompt` | `string` | `""` | Prompt used to generate welcome audio |
| `clearSessionOnMount` | `boolean` | `true` | Clear stored session handle on mount |

### Reliability & Backpressure

| Option | Type | Default | Notes |
|---|---|---|---|
| `connectTimeoutMs` | `number` | `12000` | Timeout for initial Live API connection |
| `reconnectMaxRetries` | `number` | `3` | Max reconnection attempts |
| `reconnectBaseDelayMs` | `number` | `1500` | Base delay for reconnection backoff |
| `reconnectBackoffFactor` | `number` | `1.5` | Backoff multiplier |
| `reconnectMaxDelayMs` | `number` | `15000` | Max backoff delay |
| `reconnectJitterPct` | `number` | `0.2` | Jitter percentage (0–1) |
| `outputDropPolicy` | `"drop-oldest" \| "drop-newest" \| "drop-all"` | `drop-oldest` | Behavior when output queue overflows |
| `inputMinSendIntervalMs` | `number` | `0` | Throttle input send rate (0 disables) |
| `inputMaxQueueMs` | `number` | `0` | Cap input queue duration (0 disables) |
| `inputMaxQueueChunks` | `number` | `0` | Cap input queue chunks (0 disables) |
| `inputDropPolicy` | `"drop-oldest" \| "drop-newest" \| "drop-all"` | `drop-oldest` | Behavior when input queue overflows |
| `preferAudioWorklet` | `boolean` | `true` | Use AudioWorklet for mic capture when available |
| `audioWorkletBufferSize` | `number` | `2048` | Worklet/ScriptProcessor chunk size |
| `restartMicOnDeviceChange` | `boolean` | `true` | Auto-restart mic when device changes |

To use VAD sensitivities:

```ts
import { StartSensitivity, EndSensitivity } from '@google/genai';

const config = {
  serverVADStartSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
  serverVADEndSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
};
```

### Native audio options

| Option | Type | Default | Notes |
|---|---|---|---|
| `speechConfig` | `object` | `{}` | Voice selection / native audio config |
| `thinkingConfig` | `{ thinkingBudget?: number; includeThoughts?: boolean }` | `{}` | Thinking controls |
| `enableAffectiveDialog` | `boolean` | `false` | v1alpha-only feature |
| `proactivity` | `object` | `{}` | v1alpha-only feature |

## Telemetry Module

Built-in helpers for logging events and conversations to a [Convex](https://convex.dev) backend. Replaces per-app boilerplate with two imports.

### Setup

```tsx
import { createConvexHelper, useTelemetry } from 'google-genai-voice-chat';

// Module-level (outside component):
const convex = createConvexHelper({
  url: process.env.NEXT_PUBLIC_CONVEX_URL!,   // Convex HTTP Actions URL
  appSlug: 'my-app',                           // Identifies this app
  appSecret: process.env.NEXT_PUBLIC_APP_SECRET!,
});
```

### Inside your component

```tsx
function Chat() {
  const { onEvent, flushEvents, saveTranscript, resetSession } = useTelemetry({ convex });

  const config = useMemo(() => ({
    ...VOICE_CHAT_CONFIG,
    httpOptions: { apiVersion: 'v1alpha' },
    onEvent, // wired to telemetry buffer
  }), [onEvent]);

  const getApiKey = useCallback(() => convex.fetchToken(), []);

  const { messages, disconnect, /* ... */ } = useVoiceChat({ config, getApiKey });

  const handleClose = useCallback(async () => {
    flushEvents();
    saveTranscript(messages);
    await disconnect();
    resetSession();
  }, [disconnect, flushEvents, saveTranscript, messages, resetSession]);
}
```

### What `useTelemetry` handles

- **Session ID** — generated on mount (`ses_<timestamp>_<random>`), reset via `resetSession()`
- **Event buffering** — batches events (flush at 20 events or every 5 seconds)
- **Noise filtering** — skips `audio_output_queue_overflow` and `playback_context_state`
- **Page unload** — flushes remaining events via `sendBeacon` on `pagehide`

### `createConvexHelper` API

| Method | Description |
|---|---|
| `fetchToken()` | Fetch an ephemeral Gemini API key via the Convex token endpoint |
| `postEvents(sessionId, events)` | POST event batch (fire-and-forget) |
| `saveConversation(sessionId, messages, startedAt)` | POST conversation transcript (fire-and-forget) |
| `beaconEvents(sessionId, events)` | Flush events via `navigator.sendBeacon` (for page unload) |
| `beaconConversation(sessionId, messages, startedAt)` | Flush transcript via `navigator.sendBeacon` |

## Convex Backend

The `convex-backend/` directory contains the Convex functions that power token vending, event logging, and conversation persistence. It deploys independently and is **not** part of the npm package.

```
convex-backend/
├── convex/
│   ├── schema.ts              # apps, conversations, events tables
│   ├── tokens.ts / http.ts    # Ephemeral token vending (HTTP action)
│   ├── events.ts              # Event ingestion (HTTP action → batch mutation)
│   ├── conversations.ts       # Conversation upsert (HTTP action)
│   ├── admin.ts               # Stats/transcripts (internal queries only)
│   └── seed.ts                # App config seeding (internal mutation only)
└── package.json               # Separate deps (convex, @google/genai)
```

### Deploy

```bash
cd convex-backend
npm install
CONVEX_DEPLOYMENT=prod:<your-deployment> npx convex deploy
```

### Seed an app

```bash
npx convex run seed:seedApp '{"slug":"my-app","name":"My App","secret":"...","modelId":"gemini-2.5-flash-native-audio-preview-12-2025","replyAsAudio":true,"systemPrompt":"You are..."}'
```

## Text-only API Route

For server-side text chat (Next.js):

```ts
// app/api/chat/route.ts
import { createChatHandler } from 'google-genai-voice-chat/api';

export const POST = createChatHandler({
  systemPrompt: 'You are a helpful assistant...',
  model: 'gemini-2.0-flash',
});
```

## Environment Variables

```bash
# For client-side (Next.js)
NEXT_PUBLIC_GEMINI_API_KEY=your-api-key

# For server-side API routes
GEMINI_API_KEY=your-api-key
```

## Troubleshooting

- No audio output: ensure a user gesture created the AudioContext. Call `connect()` on a click and set `autoStartMicOnConnect: false` if needed. Also confirm `replyAsAudio: true`.
- Audio response skips words: increase `playbackStartDelayMs` (100-200ms) and `micResumeDelayMs` (400-800ms), and raise `serverVADSilenceDurationMs` (1200-2000ms).
- 1008 referer blocked: check Google Cloud referrer restrictions or use ephemeral tokens for production.
- Mic blocked: grant microphone permissions in the browser address bar/site settings.

## Requirements

- React 18+
- `@google/genai`
- Gemini API key with Live API access

## License

MIT © Rahul Manuwas
