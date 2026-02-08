# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — Monorepo restructure
- **Monorepo**: Restructured from single package to pnpm workspaces + Turborepo
- **`@genai-voice/core`**: New shared types package (conversation protocol, tools, handoff, guardrails, knowledge, analytics, persona)
- **`@genai-voice/convex`**: Expanded Convex backend from 3 to 18 tables and 3 to 33+ HTTP endpoints (now in `apps/convex-backend`)
  - **Tool execution framework**: Register external API tools, execute with full audit logging, per-turn rate limiting
  - **Human handoff**: Real-time AI-to-human escalation with context transfer and webhook notifications
  - **Guardrails**: Pattern-based content validation (regex, keywords) with block/warn/log actions and audit trail
  - **Knowledge management (RAG)**: Vector search using Gemini text-embedding-004, knowledge gap detection
  - **Analytics & insights**: CSAT collection, resolution tracking, live overview dashboard, daily aggregation
  - **A/B testing**: Experiment variants with exposure tracking
  - **Persona extensions**: Brand voice fields on app config (name, greeting, tone, preferred/blocked terms)
- **`@genai-voice/telephony`**: New package with provider-agnostic adapter interfaces
  - Telnyx voice adapter (preferred for AI voice — lower latency)
  - Twilio voice + SMS adapters (preferred for SMS deliverability)
- **`@genai-voice/livekit`**: New LiveKit WebRTC integration package with three subpath exports
  - `@genai-voice/livekit/server`: Token generation, webhook validation, room management via `livekit-server-sdk`
  - `@genai-voice/livekit/agent`: Voice AI agent using `@livekit/agents` + Gemini Live API (speech-to-speech via `google.beta.realtime.RealtimeModel`)
  - `@genai-voice/livekit/react`: `useLiveKitVoiceChat` hook with `LiveKitRoomCallbacks` interface, `LiveKitVoiceChat` component, `AudioVisualizerWrapper` with live transcriptions
  - Convex backend: 2 new tables (`livekitRooms`, `livekitParticipants`) and 5 HTTP endpoints under `/api/livekit/*`
  - Dynamic tool loading from Convex via `createToolsFromConvex()`
  - Backend-agnostic via callback injection (`AgentCallbacks`, `LiveKitRoomCallbacks`) with `createConvexAgentCallbacks()` and `createConvexRoomCallbacks()` factories
- **Live transcriptions**: Both user and agent speech are transcribed and displayed chronologically in the LiveKit voice chat UI via `useTranscriptions()` hook
- **Input audio transcription**: Gemini Live sessions now include `inputAudioTranscription` for user speech-to-text alongside agent audio
- **Agent lifecycle events**: New `AgentEvent` type and `emitEvents` callback for tracking agent state changes, errors, metrics, and tool executions. Events are buffered and flushed every 2s alongside transcription messages
- **Conversation resolution codes**: `resolveConversation` now accepts `options?: { status, resolution }` to set meaningful resolution codes (`completed`, `error`, `shutdown`, `participant_disconnected`) instead of generic `resolved`
- **Handoff status protection**: Conversations in `handed_off` status cannot be overwritten back to `resolved` by the agent's automatic resolution
- **SIGTERM safety**: Agent registers `ctx.addShutdownCallback()` to flush pending messages/events and resolve conversations before process exit (e.g. Railway redeploy)

### Changed
- Moved `src/` to `packages/react/src/` (published as `@genai-voice/react`)
- Moved `convex-backend/` to `apps/convex-backend/`
- Renamed `apps/demo` to `apps/console` (`@genai-voice/console`)
- Removed placeholder directories (`apps/dashboard`, `apps/example`)
- Moved LiveKit types from `@genai-voice/core` to `@genai-voice/livekit` — livekit package no longer depends on core
- Removed `convexUrl`/`appSlug`/`appSecret` from `LiveKitAgentConfig` — use `AgentCallbacks` instead
- Changed `voice-livekit` channel to `voice-webrtc`
- Added `voice-webrtc` to the `Channel` union type in core
- Root `package.json` is now a private workspace root
- ESLint config updated for monorepo file patterns
- `.gitignore` updated for Turborepo and multi-package structure
- Updated `@google/genai` peer dependency to `>=1.0.0` for `inputAudioTranscription` support

### Fixed
- **Convex "use node" constraint**: Split `*Internal.ts` files into `*Internal.ts` (actions only, `"use node"`) + `*Db.ts` (mutations/queries) to comply with Convex's requirement that Node.js modules can only export actions
- **LiveKit agent default export**: Added required `export default` for `@livekit/agents` framework compatibility
- **LiveKit microphone publishing**: Added `audio={true}` to `<LiveKitRoom>` so the agent can hear user speech
- **LiveKit transcription ordering**: Replaced deprecated `useTrackTranscription` with `useTranscriptions()` for proper chronological turn-by-turn display with participant identity

## [0.3.29] - 2026-02-06

First public npm release.

### Features
- **Drop-in `<ChatBot />` component** and `useVoiceChat` hook for real-time voice + text chat with Gemini Live API
- **Granular hooks**: `useLiveSession`, `useVoiceInput`, `useVoiceOutput` for custom UIs
- **Server-side API route**: `createChatHandler` for text-only chat (Next.js, etc.)
- **Session resumption** with configurable TTL and session handle storage
- **Ephemeral token support**: `getApiKey` callback for secure production deployments (no API key in client bundle)
- **AudioWorklet mic capture** with fallback to ScriptProcessorNode
- **Server VAD** with configurable sensitivity, prefix padding, and silence duration
- **Backpressure controls**: input/output queue caps, drop policies, send throttling
- **Jittered exponential backoff** for reconnection with configurable retries/delays
- **Runtime stats API**: `getStats()` for session, input, and output diagnostics
- **Page lifecycle handling**: Graceful `pagehide`/`pageshow` for Safari/iOS BFCache
- **Device change detection**: Auto-restart mic on device change
- **Telemetry module**: `createConvexHelper()` and `useTelemetry()` hook for event logging, conversation persistence, and ephemeral token vending via Convex backend
- **sendBeacon support**: Reliable data delivery on page unload
- **Co-located Convex backend**: Token vending, event logging, and conversation persistence
- **CI/CD**: GitHub Actions for tests/lint/typecheck on PR + npm publish on release

[Unreleased]: https://github.com/rahulmanuwas/google-genai-voice-chat/compare/v0.3.29...HEAD
[0.3.29]: https://github.com/rahulmanuwas/google-genai-voice-chat/releases/tag/v0.3.29
