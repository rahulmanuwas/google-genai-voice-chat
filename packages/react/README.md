# @genai-voice/react

Real-time voice and text chat React components and hooks for Google Gemini Live API. Drop-in `<ChatBot />` UI or build custom interfaces with low-level hooks.

Published on npm as [`google-genai-voice-chat`](https://www.npmjs.com/package/google-genai-voice-chat).

## Installation

```bash
npm install @genai-voice/react @google/genai
```

## Quick Start

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
        autoStartMicOnConnect: false,
        chatTitle: 'AI Assistant',
      }}
    />
  );
}
```

## Hooks

| Hook | Purpose |
|---|---|
| `useVoiceChat` | Main orchestration hook (combines session, input, output) |
| `useLiveSession` | Session lifecycle with reconnection |
| `useVoiceInput` | Microphone capture and audio streaming |
| `useVoiceOutput` | Audio playback with queue management |

## Telemetry

Built-in integration with the Convex backend for event logging and conversation persistence:

```tsx
import { createConvexHelper, useTelemetry } from '@genai-voice/react';

const convex = createConvexHelper({
  url: process.env.NEXT_PUBLIC_CONVEX_URL!,
  appSlug: 'my-app',
  appSecret: process.env.NEXT_PUBLIC_APP_SECRET!,
});

function Chat() {
  const { onEvent, flushEvents, saveTranscript } = useTelemetry({ convex });
  // Wire onEvent into useVoiceChat config...
}
```

## Text-only API Route

```ts
import { createChatHandler } from '@genai-voice/react/api';

export const POST = createChatHandler({
  systemPrompt: 'You are a helpful assistant...',
  model: 'gemini-2.0-flash',
});
```

## Exports

### Components
- `ChatBot` -- drop-in chat widget
- `ChatMessage` -- individual message display

### Hooks
- `useVoiceChat`, `useLiveSession`, `useVoiceInput`, `useVoiceOutput`

### Telemetry
- `createConvexHelper`, `useTelemetry`

### Types
- `ChatMessage`, `ChatRole`, `VoiceChatConfig`, `VoiceChatEvent`, `AudioDropPolicy`, `VoiceChatStats`, `ChatTheme`, `ChatHandlerConfig`

### Utilities
- `mergeConfig`, `DEFAULT_CONFIG`, `AUDIO_CONFIG`, `STABLE_PRESET`

For full configuration reference, see the [root README](../../README.md).
