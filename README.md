# genai-voice

AI voice agent platform powered by Google Gemini. From a drop-in React chat widget to a full enterprise agent backend with tools, handoff, guardrails, knowledge base, and multi-channel telephony.

[![npm version](https://badge.fury.io/js/%40genai-voice%2Flivekit.svg)](https://www.npmjs.com/package/@genai-voice/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Packages

| Package | Description | Status |
|---|---|---|
| [`@genai-voice/backend`](./apps/backend) | Convex backend: tools, handoff, guardrails, RAG, analytics, QA framework, outbound triggers, persona, A/B testing, transcription storage | Repo-only |
| [`@genai-voice/sdk`](./packages/sdk) | Unified SDK: chatbot React UI, LiveKit WebRTC agent/server, telephony adapters, shared platform types | Stable |

## Architecture

```
apps/
├── web/                Next.js admin dashboard + demo pages with scenario picker
└── backend/            Convex backend platform (25 tables, 50+ HTTP endpoints)

packages/
└── livekit/            Unified SDK (chatbot, server, agent, react, telephony, core subpaths) — backend-agnostic
```

## Quick Start

### Tier 1 — Just a voice widget

```bash
npm install @genai-voice/sdk @google/genai
```

```tsx
import { ChatBot } from '@genai-voice/sdk/chatbot';

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

Deploy the Convex backend from this repo, register tools the AI can call, configure guardrails, set up persona/brand voice, run A/B experiments, and get a real-time analytics dashboard. See the [Convex backend docs](./apps/backend/README.md).

### Tier 3 — LiveKit WebRTC voice agent

```bash
npm install @genai-voice/sdk
```

Add a production-grade voice AI agent using LiveKit rooms and Gemini Live API (speech-to-speech). Includes server-side token generation, webhook handling, React components with live transcriptions, an agent runner, and automatic transcription persistence to Convex. See the [LiveKit docs](./packages/sdk/README.md).

### Tier 4 — Multi-channel (phone + SMS)

```bash
npm install @genai-voice/sdk
```

Add Telnyx for voice calls and Twilio for SMS, all feeding into the same Convex conversation engine. See the [LiveKit telephony docs](./packages/sdk/README.md#telephony-adapters).

## Monorepo Setup

This project uses [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/).

```bash
# Install all dependencies
pnpm install

# Build all packages (respects dependency order)
pnpm build

# Development mode (watches packages + runs the demo app; excludes Convex dev server)
pnpm dev

# Convex dev server (optional; requires Convex project/auth)
pnpm dev:convex

# Run all tests
pnpm test

# Type check everything
pnpm typecheck

# Lint everything
pnpm lint
```

## Dashboard

The admin dashboard (`apps/web`) provides an analytics overview, platform management, and four interactive demo pages. Each demo page includes a **scenario picker** that switches between three realistic enterprise scenarios:

| Scenario | App Slug | Persona | Description |
|---|---|---|---|
| Dentist Appointment | `demo-dentist` | Sarah | Patient rescheduling a dental cleaning |
| Earnings Call Explainer | `demo-earnings` | Alex | Investor asking about Q4 2025 financials |
| E-commerce Support | `demo-ecommerce` | Luna | Order tracking, returns, product questions |

Switching scenarios changes the system prompt (ChatBot/Custom demos) or the Convex app slug (LiveKit/Twilio demos), loading the matching persona, tools, guardrails, and knowledge base from the backend.

The dashboard also includes an **API Reference** page at `/docs` with interactive documentation for all HTTP endpoints.

```bash
pnpm install
pnpm dev
# Dashboard runs at http://localhost:3200
```

### Seeding Scenario Data

Each scenario is backed by full Convex data (app config, tools, guardrail rules, and knowledge documents with vector embeddings). Seed all three with:

```bash
cd apps/backend
CONVEX_DEPLOY_KEY=... npx convex run seedScenarios:seedAllAction '{"secret":"your-app-secret"}'
```

This creates per-scenario:
- **App record** with persona (name, greeting, tone) and guardrails enabled
- **Tools**: 3 (dentist), 2 (earnings), 4 (e-commerce)
- **Guardrail rules**: 2 (dentist), 3 (earnings), 3 (e-commerce)
- **Knowledge docs**: 5 per scenario (15 total), with auto-generated embeddings

All three scenario apps share the same `APP_SECRET` as the base `demo` app.

## Using Individual Hooks

For custom UIs, use the hooks directly:

```tsx
import { useVoiceChat } from '@genai-voice/sdk/chatbot';

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
import { createConvexHelper, useTelemetry } from '@genai-voice/sdk/chatbot';

// Server route example (Next.js): POST /api/session
// Exchanges APP_SECRET (server env) for a short-lived session token.
// The browser never sees APP_SECRET.
//
// export async function POST() {
//   const res = await fetch(`${process.env.NEXT_PUBLIC_CONVEX_URL}/api/auth/session`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ appSlug: 'my-app', appSecret: process.env.APP_SECRET }),
//   });
//   return Response.json(await res.json());
// }

const convex = createConvexHelper({
  url: process.env.NEXT_PUBLIC_CONVEX_URL!,
  appSlug: 'my-app',
  getSessionToken: async () => {
    const res = await fetch('/api/session', { method: 'POST' });
    const data = await res.json();
    return data.sessionToken as string;
  },
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
import { createChatHandler } from '@genai-voice/sdk/chatbot/api';

export const POST = createChatHandler({
  systemPrompt: 'You are a helpful assistant...',
  model: 'gemini-2.0-flash',
});
```

## Environment Variables

Key variables for local development (`apps/web/.env.local`):

| Variable | Where | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_GEMINI_API_KEY` | Browser | Gemini API key for voice/chat |
| `NEXT_PUBLIC_CONVEX_URL` | Browser | Convex deployment URL |
| `NEXT_PUBLIC_APP_SLUG` | Browser | App identifier (default: `demo`) |
| `NEXT_PUBLIC_LIVEKIT_URL` | Browser | LiveKit WebSocket URL |
| `APP_SECRET` | Server | Server-only Convex auth secret |
| `GEMINI_API_KEY` | Server | Gemini API key for server routes (`/api/summarize`, `/api/memory/extract`) |
| `LIVEKIT_URL` | Server | LiveKit API URL (HTTPS) |
| `LIVEKIT_API_KEY` | Server | LiveKit API key |
| `LIVEKIT_API_SECRET` | Server | LiveKit API secret |
| `GOOGLE_API_KEY` | Agent | Gemini key for LiveKit agent (same as `NEXT_PUBLIC_GEMINI_API_KEY`) |

For the full reference including Railway, Convex Cloud, and telephony variables, see **[docs/env-vars.md](./docs/env-vars.md)**.

## Deployment

### Railway

The dashboard and agent are deployed as separate Railway services:

```bash
# Dashboard (Next.js standalone)
railway up --detach --service dashboard

# Agent (LiveKit agent process)
railway up --detach --service agent
```

Both use Docker (`Dockerfile.dashboard` and `Dockerfile.agent`). `NEXT_PUBLIC_*` variables must be set as Railway env vars before building (they're inlined at build time).

The Convex backend stays on Convex Cloud:

```bash
cd apps/backend
CONVEX_DEPLOY_KEY=... npx convex deploy --typecheck disable -y
```

See **[docs/env-vars.md](./docs/env-vars.md)** for per-service variable requirements.

## Troubleshooting

- **No audio output**: ensure a user gesture created the AudioContext. Call `connect()` on a click. Confirm `replyAsAudio: true`.
- **Audio skips words**: increase `playbackStartDelayMs` (100-200ms) and `micResumeDelayMs` (400-800ms).
- **1008 referer blocked**: check Google Cloud referrer restrictions or use ephemeral tokens.
- **Mic blocked**: grant microphone permissions in browser settings.
- **LiveKit agent can't hear user**: ensure `<LiveKitRoom audio={true}>` is set to publish the microphone.
- **LiveKit "Missing or invalid default export"**: the agent entry file must have `export default` with the agent definition.
- **LiveKit no transcriptions**: ensure `@google/genai` >= 1.0.0 is installed and `inputAudioTranscription` is enabled on the RealtimeModel (enabled by default).

## Requirements

- Node.js 18+
- React 18+
- `@google/genai` >= 1.0.0
- Gemini API key with Live API access

## License

MIT
