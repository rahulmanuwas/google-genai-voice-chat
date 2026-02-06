# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.29] - 2026-02-06

### Added
- **Telemetry module**: `createConvexHelper()` and `useTelemetry()` hook — replaces per-app boilerplate for event logging, conversation persistence, and ephemeral token fetching
- **sendBeacon support**: `beaconEvents()` and `beaconConversation()` for reliable data delivery on page unload
- **Co-located Convex backend**: `convex-backend/` directory with all Convex functions (token vending, event logging, conversation persistence)

### Changed
- **Security hardening**: `admin.ts` stats/transcripts are now `internalQuery` (no longer publicly accessible); `seed.ts` seedApp is now `internalMutation`
- **Multi-tenant scoping**: Added `by_app_session` compound indexes on conversations and events tables; `upsertConversation` now queries by both `appSlug` and `sessionId` (prevents cross-app collision)
- **Batch event writes**: New `insertEventBatch` mutation replaces N individual `insertEvent` calls with a single mutation

### Fixed
- **Duplicate page lifecycle events**: Removed `page_hide`/`page_show` event emissions from `useVoiceChat` (already emitted by `useLiveSession`)

## [0.3.27] - 2026-02-01

### Added
- **Ephemeral token support**: New `getApiKey` async callback for secure production deployments
- **Connection timeout**: `connectTimeoutMs` config (default: 12s) with proper cleanup
- **Jittered exponential backoff**: `reconnectMaxRetries`, `reconnectBaseDelayMs`, `reconnectBackoffFactor`, `reconnectMaxDelayMs`, `reconnectJitterPct` options
- **AudioWorklet support**: `preferAudioWorklet` (default: true) with fallback to ScriptProcessorNode
- **Input backpressure**: `inputMinSendIntervalMs`, `inputMaxQueueMs`, `inputMaxQueueChunks`, `inputDropPolicy` options
- **Output backpressure**: `outputDropPolicy` option
- **Runtime stats API**: `getStats()` returns session, input, and output diagnostics
- **Page lifecycle handling**: Graceful `pagehide`/`pageshow` handling for Safari/iOS BFCache
- **Device change detection**: `restartMicOnDeviceChange` (default: true) auto-restarts mic
- **Unit tests**: First test suite for `audio-utils` functions

### Changed
- `apiKey` prop is now optional when `getApiKey` is provided
- Improved reconnection logic with stale connection detection
- Versioning now uses `major.minor.commitCount` (auto-generated on publish)

## [0.3.0-beta.1] - 2026-01-15

### Added
- Session resumption with configurable TTL (`sessionHandleTtlMs`)
- `clearSessionOnMount` option to control session handle clearing
- `autoWelcomeAudio` and `welcomeAudioPrompt` for spoken greetings
- `autoPauseMicOnSendText` option (default: true)
- Advanced config: `speechConfig`, `thinkingConfig`, `enableAffectiveDialog`, `proactivity`

### Changed
- Improved audio playback timing with `playbackStartDelayMs`
- Better mic/speaker coordination with `micResumeDelayMs`

## [0.2.3] - 2026-01-10

### Fixed
- Session handling and audio bugs
- Mic restart effect after AI playback completes

## [0.2.2] - 2026-01-08

### Fixed
- Rewrote audio handling with tested PCM implementation
- Prevent mic start/stop loop by only auto-starting once per connection

## [0.2.1] - 2026-01-06

### Fixed
- Prevent mic start/stop loop by only auto-starting once per connection

## [0.2.0] - 2026-01-05

### Changed
- **Breaking**: `modelId` is now required - users must provide from [Google AI docs](https://ai.google.dev/gemini-api/docs/live)

## [0.1.1] - 2026-01-03

### Fixed
- Updated model ID to `gemini-2.0-flash-exp`

## [0.1.0] - 2026-01-02

### Added
- Initial release
- `<ChatBot />` component for drop-in voice chat
- `useVoiceChat` hook for custom UIs
- `useLiveSession`, `useVoiceInput`, `useVoiceOutput` hooks for granular control
- `createChatHandler` for server-side API routes
- Real-time voice input with VAD support
- Audio playback with configurable sample rates
- Text chat fallback
- Theme customization

[Unreleased]: https://github.com/rahulmanuwas/google-genai-voice-chat/compare/v0.3.29...HEAD
[0.3.29]: https://github.com/rahulmanuwas/google-genai-voice-chat/compare/v0.3.27...v0.3.29
[0.3.27]: https://github.com/rahulmanuwas/google-genai-voice-chat/compare/v0.3.0-beta.1...v0.3.27
[0.3.0-beta.1]: https://github.com/rahulmanuwas/google-genai-voice-chat/compare/v0.2.3...v0.3.0-beta.1
[0.2.3]: https://github.com/rahulmanuwas/google-genai-voice-chat/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/rahulmanuwas/google-genai-voice-chat/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/rahulmanuwas/google-genai-voice-chat/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/rahulmanuwas/google-genai-voice-chat/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/rahulmanuwas/google-genai-voice-chat/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/rahulmanuwas/google-genai-voice-chat/releases/tag/v0.1.0
