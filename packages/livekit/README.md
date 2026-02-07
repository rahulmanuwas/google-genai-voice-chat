# @genai-voice/livekit

LiveKit WebRTC integration for genai-voice. Provides server utilities, a voice AI agent powered by Gemini Live API, and React components for real-time voice chat via LiveKit rooms.

## Installation

```bash
npm install @genai-voice/livekit
```

## Subpath Exports

| Export | Purpose | Key Dependencies |
|---|---|---|
| `@genai-voice/livekit/server` | Token generation, webhook validation, room management | `livekit-server-sdk` |
| `@genai-voice/livekit/agent` | Runnable voice AI agent with Gemini Live API | `@livekit/agents`, `@livekit/agents-plugin-google` |
| `@genai-voice/livekit/react` | React hook + components for LiveKit voice chat | `@livekit/components-react`, `livekit-client` |

## Server Utilities

### Token Generation

```typescript
import { createLiveKitToken } from '@genai-voice/livekit/server';

const token = await createLiveKitToken({
  identity: 'user-123',
  roomName: 'room-abc',
  name: 'Jane Doe',
  apiKey: process.env.LIVEKIT_API_KEY!,
  apiSecret: process.env.LIVEKIT_API_SECRET!,
});
```

### Room Management

```typescript
import { createRoom, deleteRoom } from '@genai-voice/livekit/server';

const room = await createRoom({
  roomName: 'room-abc',
  emptyTimeout: 300,
  maxParticipants: 2,
  serverUrl: process.env.LIVEKIT_URL!,
  apiKey: process.env.LIVEKIT_API_KEY!,
  apiSecret: process.env.LIVEKIT_API_SECRET!,
});

await deleteRoom('room-abc');
```

### Webhook Handling

```typescript
import { handleLiveKitWebhook } from '@genai-voice/livekit/server';

const result = await handleLiveKitWebhook(requestBody, authorizationHeader, {
  apiKey: process.env.LIVEKIT_API_KEY!,
  apiSecret: process.env.LIVEKIT_API_SECRET!,
});
// result: { valid: true, event: { type: 'room_started', room: {...} } }
```

## Voice Agent

The agent uses Gemini Live API (speech-to-speech) via `@livekit/agents-plugin-google` for low-latency voice conversations. It uses `google.beta.realtime.RealtimeModel` which supports:

- Native speech-to-speech with Gemini's built-in voices
- Input audio transcription (user speech-to-text) for live transcription display
- Built-in turn detection (no separate VAD needed)
- Tool calling via `llm.tool()` with JSON schema parameters

### Quick Start

```bash
# Run the default agent in development mode
pnpm --filter @genai-voice/livekit run agent:dev
```

### Custom Agent

```typescript
import { createAgentDefinition } from '@genai-voice/livekit/agent';

createAgentDefinition({
  model: 'gemini-2.5-flash-native-audio-preview-12-2025',
  voice: 'Puck',
  instructions: 'You are a helpful customer support agent.',
  temperature: 0.8,
});
```

### With Convex Integration (Transcription Storage + Persona)

When Convex credentials are provided (via options or env vars), the agent automatically:
1. Loads the app's **persona** from `GET /api/persona` and injects it into agent instructions
2. **Streams transcriptions** to `POST /api/messages` every 2 seconds during the conversation
3. Updates the **conversation status** to `resolved` when the session ends

```typescript
import { createAgentDefinition, createToolsFromConvex } from '@genai-voice/livekit/agent';

const tools = await createToolsFromConvex({
  convexUrl: 'https://your-deployment.convex.cloud',
  appSlug: 'my-app',
  appSecret: '...',
});

createAgentDefinition({
  instructions: 'You are a helpful assistant with access to tools.',
  tools,
  // Convex integration for transcription storage + persona
  convexUrl: 'https://your-deployment.convex.cloud',
  appSlug: 'my-app',
  appSecret: '...',
});
```

Or set via environment variables (no code changes needed):

```bash
CONVEX_URL=https://your-deployment.convex.cloud
APP_SLUG=my-app
APP_SECRET=your-app-secret
```

## React Components

### LiveKitVoiceChat

Drop-in component that handles room creation, token fetching, audio visualization, and live transcriptions.

```tsx
import { LiveKitVoiceChat } from '@genai-voice/livekit/react';

function App() {
  return (
    <LiveKitVoiceChat
      convexUrl="https://your-deployment.convex.cloud"
      appSlug="my-app"
      appSecret="..."
      serverUrl="wss://your-app.livekit.cloud"
    />
  );
}
```

Features:
- Audio visualization with `BarVisualizer` showing agent state (listening, thinking, speaking)
- Live transcriptions for both user and agent speech, displayed chronologically as chat bubbles
- Automatic room lifecycle management (create, connect, disconnect)

### AudioVisualizerWrapper

The `AudioVisualizerWrapper` component displays the agent's audio visualizer and live transcriptions. It uses:

- `useVoiceAssistant()` for agent state and audio track
- `useTranscriptions()` for all transcriptions (user + agent), sorted chronologically by timestamp

Transcriptions require the agent's Gemini RealtimeModel to have `inputAudioTranscription` enabled (default behavior).

### useLiveKitVoiceChat Hook

For custom UIs, use the hook directly:

```tsx
import { useLiveKitVoiceChat } from '@genai-voice/livekit/react';

function CustomVoiceChat() {
  const {
    token,
    roomName,
    serverUrl,
    isReady,
    isConnecting,
    error,
    connect,
    disconnect,
  } = useLiveKitVoiceChat({
    convexUrl: 'https://your-deployment.convex.cloud',
    appSlug: 'my-app',
    appSecret: '...',
    serverUrl: 'wss://your-app.livekit.cloud',
  });

  // Build your own UI...
}
```

## Environment Variables

| Variable | Required For | Description |
|---|---|---|
| `LIVEKIT_API_KEY` | Server, Agent, Convex | LiveKit Cloud API key |
| `LIVEKIT_API_SECRET` | Server, Agent, Convex | LiveKit Cloud API secret |
| `LIVEKIT_URL` | Server, Agent, Convex | LiveKit server API URL (e.g. `https://my-app.livekit.cloud`) |
| `GOOGLE_API_KEY` | Agent | Gemini API key for the RealtimeModel |
| `LIVEKIT_SIP_TRUNK_ID` | Server | SIP trunk ID (e.g. `ST_xxx`) used for dialing PSTN into a room |
| `CONVEX_URL` | Agent (optional) | Convex HTTP URL for transcription storage and persona loading |
| `APP_SLUG` | Agent (optional) | App slug for Convex auth |
| `APP_SECRET` | Agent (optional) | App secret for Convex auth |

For browser clients (React), you typically connect to `wss://<project>.livekit.cloud` (often exposed as `NEXT_PUBLIC_LIVEKIT_URL` in apps).

## SIP (PSTN Calling)

If you have LiveKit SIP enabled (often backed by a Twilio SIP trunk), you can dial a phone number and bridge it into a LiveKit room:

```ts
import { createRoom, createSipParticipant } from '@genai-voice/livekit/server';

await createRoom({ roomName: 'pstn-demo' });

await createSipParticipant({
  trunkId: process.env.LIVEKIT_SIP_TRUNK_ID!,
  to: '+15551234567',
  roomName: 'pstn-demo',
});
```

## Convex Backend Integration

The Convex backend (`@genai-voice/convex`) includes LiveKit-specific tables and endpoints:

**Tables**: `livekitRooms`, `livekitParticipants`, `messages`

**Endpoints**:
- `POST /api/livekit/token` — Generate access token
- `POST /api/livekit/rooms` — Create a room
- `GET /api/livekit/rooms` — List active rooms
- `DELETE /api/livekit/rooms` — End a room
- `POST /api/livekit/webhook` — Handle LiveKit webhook events
- `POST /api/messages` — Store transcription messages (used by agent automatically)
- `GET /api/messages?sessionId=...` — Retrieve stored transcriptions
- `GET /api/persona` — Load persona config (used by agent at session start)

## Transcription Persistence

When the agent has Convex credentials configured (`CONVEX_URL`, `APP_SLUG`, `APP_SECRET`), it automatically persists all voice transcriptions:

1. **User speech** — captured via `user_input_transcribed` events (final transcriptions only)
2. **Agent responses** — captured via `conversation_item_added` events (assistant role only)
3. **Buffered writes** — messages are batched and sent to `POST /api/messages` every 2 seconds
4. **Session cleanup** — on close, remaining messages are flushed and conversation status is set to `resolved`

Stored messages can be retrieved via `GET /api/messages?sessionId=...` for review, analytics, or quality assurance.

## Architecture

```
@genai-voice/livekit
├── server/          Token, webhook, room management (livekit-server-sdk)
├── agent/           Voice AI agent (Gemini Live API via @livekit/agents)
└── react/           React hook + components (@livekit/components-react)
```

The agent runs as a separate server-side process that joins LiveKit rooms as a participant. React components connect to the same room from the browser, enabling real-time voice interaction between the user and the AI agent.

## Key Implementation Notes

- **Agent entry file** must have `export default` with the agent definition — `@livekit/agents` framework requires it
- **`<LiveKitRoom>`** needs `audio={true}` to publish the user's microphone — without it the agent can't hear the user
- **Transcriptions** use `useTranscriptions()` from `@livekit/components-react` (not the deprecated `useTrackTranscription`), which returns all transcriptions with participant identity and timestamps
- **Gemini RealtimeModel** enables `inputAudioTranscription` by default, providing user speech-to-text alongside agent audio output
