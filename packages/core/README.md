# @genai-voice/core

Shared types and conversation protocol for the genai-voice platform.

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

## Usage

```typescript
import type {
  Message,
  Channel,
  ToolDefinition,
  HandoffConfig,
  GuardrailRule,
  PersonaConfig,
} from '@genai-voice/core';

// LiveKit types are in @genai-voice/livekit
import type { LiveKitRoom, LiveKitAgentConfig } from '@genai-voice/livekit/server';
```

## Channels

The platform supports five communication channels:

| Channel | Value | Transport |
|---|---|---|
| Web chat/voice | `web` | Browser WebSocket via Gemini Live API |
| WebRTC voice | `voice-webrtc` | LiveKit rooms with Gemini Live API agent |
| Phone (PSTN) | `voice-pstn` | Telnyx or Twilio media streams |
| SMS | `sms` | Twilio or Telnyx messaging |
| Email | `email` | SendGrid, Resend, or similar |

All channels share the same `Message` format and `Conversation` lifecycle, enabling cross-channel analytics and seamless handoff.
