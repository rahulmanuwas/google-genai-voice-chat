# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- **Co-located Convex backend**: `convex-backend/` directory with token vending, event logging, and conversation persistence functions
- **CI/CD**: GitHub Actions for tests/lint/typecheck on PR + npm publish on release

[Unreleased]: https://github.com/rahulmanuwas/google-genai-voice-chat/compare/v0.3.29...HEAD
[0.3.29]: https://github.com/rahulmanuwas/google-genai-voice-chat/releases/tag/v0.3.29
