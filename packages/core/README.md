# @genai-voice/core

Shared types and conversation protocol for the genai-voice platform. All other packages depend on this.

## Installation

```bash
npm install @genai-voice/core
```

## Type Modules

| Module | Key Types | Description |
|---|---|---|
| `types` | `Message`, `Conversation`, `Channel`, `Role` | Channel-agnostic conversation protocol |
| `tool` | `ToolDefinition`, `ToolResult`, `ToolExecution` | Tool/action framework for transactional AI |
| `handoff` | `Handoff`, `HandoffTrigger`, `HandoffConfig` | AI-to-human escalation protocol |
| `guardrail` | `GuardrailRule`, `GuardrailViolation`, `GuardrailConfig` | Trust, safety, and content validation |
| `knowledge` | `KnowledgeDocument`, `KnowledgeGap`, `KnowledgeConfig` | RAG knowledge management |
| `analytics` | `PeriodInsights`, `CSATRating`, `Experiment` | Analytics, CSAT, and A/B testing |
| `persona` | `PersonaConfig`, `PersonaTone` | Brand voice and persona definition |
| `livekit` | `LiveKitRoom`, `LiveKitAgentConfig`, `LiveKitTokenRequest` | LiveKit WebRTC room and agent configuration (includes Convex credentials for transcription storage) |

## Usage

```typescript
import type {
  Message,
  Channel,
  ToolDefinition,
  HandoffConfig,
  GuardrailRule,
  PersonaConfig,
  LiveKitRoom,
  LiveKitAgentConfig,
} from '@genai-voice/core';
```

## Channels

The platform supports four communication channels:

| Channel | Value | Transport |
|---|---|---|
| Web chat/voice | `web` | Browser WebSocket via Gemini Live API |
| WebRTC voice | `web` | LiveKit rooms with Gemini Live API agent |
| Phone (PSTN) | `voice-pstn` | Telnyx or Twilio media streams |
| SMS | `sms` | Twilio or Telnyx messaging |
| Email | `email` | SendGrid, Resend, or similar |

All channels share the same `Message` format and `Conversation` lifecycle, enabling cross-channel analytics and seamless handoff.
