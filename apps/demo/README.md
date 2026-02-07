# @genai-voice/demo

Next.js demo app for the `@genai-voice/*` packages.

## Run

```bash
pnpm install
pnpm dev
```

Copy `apps/demo/.env.example` to `apps/demo/.env.local` and fill values.

If you're running the monorepo from the repo root, the demo API routes also fall back to reading Twilio/Convex secrets from the repo root `.env` during development.

## Routes

- `/chatbot` — Drop-in `<ChatBot />` widget (`@genai-voice/react`)
- `/custom` — Custom UI built on `useVoiceChat` (`@genai-voice/react`)
- `/livekit` — LiveKit WebRTC voice agent (`@genai-voice/livekit`)
- `/twilio-call` — Outbound PSTN call via LiveKit SIP trunk (often backed by Twilio) (`@genai-voice/livekit`)
