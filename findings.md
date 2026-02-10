# Sierra.ai Case Study Analysis & Recommendations for `genai-voice`

## Overview

Analysis of all 32 Sierra.ai customer case studies to identify capability gaps and recommend upgrades for the `genai-voice` project.

---

## What Sierra Actually Is

Sierra is a **full-stack enterprise AI agent platform** — not just a voice/chat widget. Across 32 customers spanning fintech, e-commerce, insurance, real estate, media, logistics, and health/wellness, Sierra consistently delivers:

| Capability | Our Project Today | Sierra |
|---|---|---|
| Voice chat | Yes (Gemini Live) | Yes (multi-channel) |
| Text chat | Yes (basic) | Yes (rich, transactional) |
| Session management | Yes (resume, TTL) | Yes + cross-channel |
| Telemetry | Yes (Convex backend) | Full analytics + insights engine |
| Reconnection/reliability | Yes (exponential backoff) | Yes |
| **Everything below** | **Missing** | **Core platform** |

---

## Case Studies Summary

### Financial Services
| Company | Key Capability | Top Metric |
|---|---|---|
| **Rocket Mortgage** | Credit pulling, rate presentation, loan customization, voice+chat, banker handoff | 3x higher closing rates, 400K+ conversations |
| **SoFi** | Multi-product support (banking, cards, investing, lending), compliance guardrails, API integration | 61% containment, +33 NPS, 50K+ weekly conversations |
| **Chime** | 24/7 AI agents, hallucination resistance, seamless escalation | Resolution rate 50% → 70% |
| **Ramp** | Agent SDK (journeys-as-code), trust/safety infra, testing suite, voice agent | 90% case resolution |
| **Brex** | No-code + SDK, multimodal chat+voice, live handoff with context | 90% faster responses, 15K+ hours/year saved |
| **Marshmallow** | Agent SDK, policy management (cancellations, renewals), regulated compliance | 82% CSAT, exceeds human IQS |

### E-Commerce & Retail
| Company | Key Capability | Top Metric |
|---|---|---|
| **Wilson** | No-code Agent Studio, order tracking, sizing recommendations, knowledge management | 77% resolution, deployed in weeks |
| **Casper** | Personalized recommendations, multilingual, 24/7, knowledge management | 74% resolution, 20%+ CSAT increase |
| **Sun & Ski Sports** | Expert product recommendations, seasonal demand handling, conversion optimization | 90% CSAT (vs 68% human), 3x conversion |
| **Chubbies** | Brand voice persona, Loop/Gladly integration, returns optimization | High CSAT maintained |
| **ThirdLove** | Empathetic fit guidance, daily refinement, AR-powered fittings planned | 92% CSAT maintained at peak |
| **melin** | Rapid deployment (<2 weeks), email redirect, warranty/returns | 47% email volume redirected |
| **OluKai** | Policy interpretation with nuance, CDP integration, proactive engagement planned | 70% resolution, 4.5/5 CSAT |
| **Minted** | Real-time issue detection, dynamic messaging, proactive shipping upgrades | 65%+ resolution, 95%+ CSAT |
| **CDW** | B2B workflows, Agent Studio, account insights, contract visibility | 250K+ organizations served |
| **ScottsMiracle-Gro** | Expert knowledge curation, e-commerce integration, visual agent planned | Containment 40% → 65% |

### Health & Wellness
| Company | Key Capability | Top Metric |
|---|---|---|
| **WeightWatchers** | Brand-specific vocabulary, rapid policy deployment, mobile-first | 70% containment in week 1, 4.6/5 CSAT |
| **AG1** | QA scoring system, Experience Manager, subscription management | 99% quality scores at 5/5, 4.9 CSAT |
| **Pendulum** | True resolution vs deflection, flexible auth, escalation pathways | Resolution 50% → 75%+, 4.3/5 CSAT |
| **Madison Reed** | Branded persona "Madi", appointment booking, subscription retention | 50% fewer cancellations, 30x chat increase |
| **Thrive Market** | A/B testing, multi-channel expansion, guided grocery experience planned | ~90% CSAT, 50%+ resolution improvement |

### Media & Streaming
| Company | Key Capability | Top Metric |
|---|---|---|
| **SiriusXM** | Vehicle integration, radio refresh, colloquial language understanding | 34M listeners served |
| **Tubi** | Content recommendations via API, peak demand handling, team upskilling | 80% containment, +7 CSAT points |

### Real Estate & Home Services
| Company | Key Capability | Top Metric |
|---|---|---|
| **Redfin** | Conversational search replacing filters, fuzzy concept recognition | 2x listings viewed, 47% more tour requests |
| **Safelite** | Claims agent + white-label "Agent-Maker" for insurance partners | High resolution + CSAT |
| **ADT** | Troubleshooting, billing, planned payment processing | 2M inquiries/month |

### Other Industries
| Company | Industry | Key Capability | Top Metric |
|---|---|---|---|
| **RunBuggy** | Logistics | Outbound voice calls, ETA collection, automated task closure | ~1000 hours/month saved |
| **Guild** | Workforce Dev | 20+ languages, proactive suggestions, specialist escalation | 4.8/5 CSAT (matched humans) |
| **CLEAR** | Identity | Brand voice alignment, Live Assist handoff, multi-channel | 4.7/5 CSAT |
| **AOL** | Media/Tech | Billing negotiation, payment processing, identity verification | 64% resolution |
| **Sonos** | Consumer Electronics | Diagnostic data collection, Salesforce integration, setup guidance | 15M homes served |
| **Funnel Leasing** | Real Estate | 20+ languages, CRM automation, tour booking | 94% first-conversation resolution |

---

## The 12 Capability Gaps (Ranked by Impact)

### Gap 1: Tool/Action Execution Framework (Critical)

**What Sierra does**: In *every* case study, the AI agent doesn't just answer questions — it *does things*. Rocket Mortgage pulls credit. SoFi accesses balances. Casper processes returns. Marshmallow cancels policies. Ramp locks cards and ships replacements.

**Our gap**: The library passes messages to Gemini and plays back audio. There's no framework for the AI to call external APIs, mutate databases, or execute transactional workflows.

**Recommendation**: Build a **Tool Registry** system:
```typescript
interface AgentTool {
  name: string;
  description: string;           // Sent to Gemini as function declaration
  parameters: JSONSchema;
  requiresAuth?: boolean;
  confirmBeforeExecution?: boolean; // "Are you sure you want to cancel?"
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}
```
Leverages Gemini's native function calling.

---

### Gap 2: Human Handoff / Live Assist (Critical)

**What Sierra does**: Every case study mentions seamless AI-to-human escalation with full context. Sonos passes diagnostic summaries to Salesforce agents. Brex routes with conversation history. Guild matches 4.8/5 CSAT by knowing *when* to escalate.

**Recommendation**: Add a handoff protocol:
```typescript
interface HandoffConfig {
  enabled: boolean;
  triggers: HandoffTrigger[];         // sentiment, keyword, tool failure, explicit request
  destination: 'zendesk' | 'salesforce' | 'intercom' | 'custom';
  contextTransfer: boolean;
  onHandoff: (context: HandoffContext) => void;
}
```

---

### Gap 3: Trust, Safety & Guardrails (Critical for Enterprise)

**What Sierra does**: SoFi has "strict data protection guardrails." Ramp has "jailbreak detection, abuse monitoring, supervisory models." WeightWatchers stress-tested for misuse.

**Recommendation**: Add layered safety:
```typescript
interface GuardrailConfig {
  inputFilters: InputFilter[];
  topicBoundaries: string[];
  blockedTopics: string[];
  responseValidation: ResponseValidator[];
  maxActionsPerTurn: number;
  requireConfirmation: string[];
  onViolation: (violation: GuardrailViolation) => void;
  auditLog: boolean;
}
```

---

### Gap 4: Multi-Channel Support (High Impact)

**What Sierra does**: Rocket Mortgage runs chat + voice. Brex deployed both on the same platform. Thrive Market plans chat, voice, email, SMS, and proactive outreach.

**Recommendation**: Decouple conversation engine from transport:
```
src/
├── core/           # Channel-agnostic conversation engine
├── channels/
│   ├── web/        # Current: browser voice+text
│   ├── telephony/  # New: Twilio/PSTN voice
│   ├── email/      # New: inbound email → AI → response
│   └── sms/        # New: SMS via Twilio/MessageBird
├── server/         # New: server-side agent runtime
```

---

### Gap 5: Knowledge Management System (High Impact)

**What Sierra does**: Wilson uses dynamic "content snippets." ScottsMiracle-Gro uses curated expert content. AG1 uses QA evaluation on knowledge accuracy.

**Recommendation**: Structured knowledge beyond flat systemPrompt:
```typescript
interface KnowledgeConfig {
  systemPrompt: string;
  knowledgeSources: KnowledgeSource[];
  ragConfig?: {
    vectorStore: 'pinecone' | 'weaviate' | 'custom';
    embeddingModel: string;
    topK: number;
    similarityThreshold: number;
  };
}
```

---

### Gap 6: Analytics & Insights Engine (High Impact)

**What Sierra does**: AG1 uses "Experience Manager" for pattern identification. CDW has performance analytics. Minted uses real-time issue detection and trend flagging.

**Recommendation**: Extend existing telemetry:
```typescript
interface InsightsConfig {
  trackResolution: boolean;
  trackCSAT: boolean;
  trackTopics: boolean;
  trackEscalations: boolean;
  knowledgeGapDetection: boolean;
  dashboardEndpoint?: string;
}
```

---

### Gap 7: Conversation Testing & QA Framework (High Impact)

**What Sierra does**: Ramp has "AI-driven conversation simulation before launch with regression checks." AG1 achieves "99% of 5/5 quality scores" through systematic QA.

**Recommendation**: Add test scenario runner:
```typescript
interface TestScenario {
  name: string;
  turns: { role: 'user'; content: string }[];
  expectations: {
    shouldContain?: string[];
    shouldNotContain?: string[];
    shouldCallTool?: string;
    shouldHandoff?: boolean;
  };
}
```

---

### Gap 8: Brand Voice & Persona System (Medium Impact)

**What Sierra does**: Every customer has a named, branded AI persona — Casper's "Luna", Chubbies' "Duncan Smuthers", Madison Reed's "Madi". Defined personalities, tones, greeting styles.

**Recommendation**: Structured persona config:
```typescript
interface PersonaConfig {
  name: string;
  greeting: string;
  personality: string[];
  tone: 'formal' | 'casual' | 'empathetic' | 'professional';
  languageGuidelines: {
    preferredTerms: Record<string, string>;
    avoidTerms: string[];
  };
  escalationPhrase: string;
}
```

---

### Gap 9: Multi-language Support (Medium Impact)

**What Sierra does**: Guild added 20+ languages instantly. Funnel Leasing supports 20+ languages. Marshmallow serves 200+ countries.

**Recommendation**: Add locale config and UI string externalization. Gemini handles multilingual natively; UI chrome needs i18n.

---

### Gap 10: Proactive/Outbound Capabilities (Medium Impact)

**What Sierra does**: RunBuggy makes outbound calls. Rocket Mortgage makes 1M+ outbound dials monthly. OluKai plans proactive engagement.

**Recommendation**: Server-side agent triggers:
```typescript
interface OutboundConfig {
  triggers: OutboundTrigger[];
  channels: ('sms' | 'email' | 'push')[];
  throttle: { maxPerUser: number; windowMs: number };
}
```

---

### Gap 11: A/B Testing for Conversations (Medium Impact)

**What Sierra does**: Thrive Market runs "experiments with messaging strategies and offers in real time."

**Recommendation**: Variant configs with exposure tracking.

---

### Gap 12: No-Code Agent Builder (Long-term)

**What Sierra does**: Wilson uses "Agent Studio" for non-technical staff. Brex operations team uses no-code interface. CDW uses Agent Studio.

**Recommendation**: Start with JSON/YAML config format that could later back a visual builder.

---

## Prioritized Roadmap

| Phase | Capabilities | Unlocks |
|---|---|---|
| **Phase 1: Agent Foundation** | Tool/Action Framework, Guardrails, Human Handoff | Enterprise readiness |
| **Phase 2: Intelligence** | Knowledge Management, Analytics/Insights, Conversation QA | Production-grade continuous improvement |
| **Phase 3: Scale** | Multi-channel, Multi-language, Brand Persona system | Cross-channel deployment |
| **Phase 4: Growth** | A/B testing, Outbound/proactive, No-code config | Self-service platform |

---

## Key Metrics Sierra Customers Achieve (Our Benchmarks)

| Metric | Range Across 32 Case Studies |
|---|---|
| Resolution/Containment Rate | 50% - 94% |
| CSAT Score | 4.3 - 4.9 / 5 (or 82% - 95%) |
| Conversion Lift | 2x - 4x |
| Response Time Improvement | Hours/days → seconds |
| Seasonal Staffing Reduction | Often eliminated entirely |
| Agent Time Saved | 15,000+ hours/year (Brex) |

---
---

# LiveKit Telephony Survey & Integration Analysis

## Date: February 2026

## Context

This survey evaluates whether LiveKit should replace our current direct Telnyx/Twilio telephony adapters in `packages/telephony`. The project currently has provider-specific adapters (Telnyx for voice, Twilio for voice + SMS) that handle SIP signaling, audio streaming, and call control directly. LiveKit offers an abstraction layer that sits between our application and these telephony providers.

---

## What LiveKit Is

LiveKit is an **open-source (Apache 2.0) real-time communication platform** that provides:
- WebRTC-based rooms for audio/video/data
- SIP telephony bridging (PSTN calls ↔ LiveKit rooms)
- An **Agents SDK** for building AI voice pipelines
- Official plugins for Google Gemini, OpenAI, Deepgram, ElevenLabs, etc.
- Self-hostable server + managed LiveKit Cloud

**Key insight**: LiveKit doesn't replace Telnyx/Twilio — it **sits on top of them**. You still need a SIP trunk provider (Telnyx, Twilio, etc.) for actual PSTN connectivity. LiveKit handles the room abstraction, media routing, and agent framework.

---

## Architecture Comparison

### Current: Direct Provider Adapters
```
Phone (PSTN) → Telnyx/Twilio SIP → Our Adapter → WebSocket → Gemini Live API
                                         ↓
                                   Call Control (transfer, hangup, DTMF)
```
- **Pros**: Minimal dependencies, full control, lower per-minute cost
- **Cons**: Must implement WebSocket streaming, audio encoding, call control per provider; no built-in room/conference model

### With LiveKit
```
Phone (PSTN) → Telnyx/Twilio SIP Trunk → LiveKit SIP Bridge → LiveKit Room
                                                                    ↓
                                                            LiveKit Agent (Gemini)
                                                                    ↓
                                                            Audio Pipeline (STT→LLM→TTS or Gemini Live)
```
- **Pros**: Unified room model, built-in agent framework, multi-participant support, official Gemini plugin
- **Cons**: Extra infrastructure layer, additional latency (~10-20ms), LiveKit Cloud costs on top of SIP trunk costs

---

## LiveKit SIP Telephony Features

### SIP Trunks
- **Inbound**: Register SIP trunk with credentials/IP allowlist, LiveKit receives calls
- **Outbound**: LiveKit originates calls via configured trunk to any PSTN number
- Configure via `livekit-server-sdk` `SipClient`:
  ```typescript
  const sipClient = new SipClient(host, apiKey, apiSecret);
  await sipClient.createSipInboundTrunk({ name: 'main', numbers: ['+1...'], ... });
  await sipClient.createSipOutboundTrunk({ name: 'outbound', address: 'sip.telnyx.com', ... });
  ```

### Dispatch Rules
- Route inbound calls to rooms based on: called number, caller ID, PIN codes
- Can auto-create rooms or route to existing rooms
- Supports regex matching on trunk/number patterns

### Call Transfer
- **Blind transfer**: `sipClient.transferSipParticipant(roomName, participantId, transferTo)`
- **Attended transfer**: Place original call on hold, establish new call, bridge
- Transfers to SIP URIs or PSTN numbers via `sip:+1234567890@provider`

### DTMF Support
- Send/receive DTMF tones programmatically
- Handle IVR navigation, PIN entry, etc.
- Via data channel messages in LiveKit rooms

### Multi-Participant
- Multiple callers in same LiveKit room (conference calls)
- Mix AI agent + human agents + PSTN callers in one room
- Ideal for warm transfers where AI briefs human agent before connecting

---

## LiveKit Agents SDK (TypeScript v1.0)

### Voice Pipeline Architecture
```typescript
import { pipeline, AudioStream } from '@livekit/agents';
import { STT } from '@livekit/agents-plugin-deepgram';
import { LLM } from '@livekit/agents-plugin-openai';
import { TTS } from '@livekit/agents-plugin-elevenlabs';

const agent = new pipeline.VoicePipelineAgent({
  stt: new STT(),
  llm: new LLM({ model: 'gpt-4o' }),
  tts: new TTS(),
  turnDetection: new pipeline.turn_detector.EOUModel(),
});
```

### Gemini Integration Modes

1. **Full Gemini Live (Audio-to-Audio)**
   - Uses `@livekit/agents-plugin-google` with `RealtimeModel`
   - Direct audio in → Gemini Live API → audio out
   - Lowest latency, best for natural conversation
   - Uses Gemini's native voice (no separate TTS needed)
   ```typescript
   import { multimodal } from '@livekit/agents';
   import { RealtimeModel } from '@livekit/agents-plugin-google';

   const model = new RealtimeModel({ model: 'gemini-2.0-flash-exp' });
   const agent = new multimodal.MultimodalAgent({ model });
   ```

2. **Half-Cascade**
   - Gemini Live for STT + LLM, separate TTS (ElevenLabs, etc.)
   - Better voice quality/customization while keeping Gemini's understanding

3. **Full Pipeline**
   - Separate STT (Deepgram) → Gemini LLM (text) → separate TTS
   - Maximum flexibility, highest latency
   - Best when you need specific STT/TTS providers

### Agent Features
- **Function Tools**: Register tools that the LLM can call (like Gemini function calling)
- **Agent Handoff**: Transfer between specialized agents within a session
- **Turn Detection**: Built-in end-of-utterance model (Silero VAD plugin) or Gemini's native
- **Interruption Handling**: Automatic barge-in support
- **Session Context**: Maintains conversation state across turns

---

## SDK Packages

| Package | Purpose | Version |
|---|---|---|
| `livekit-server-sdk` | Server-side room/SIP/token management | Stable |
| `@livekit/agents` | Agent framework (voice pipeline, multimodal) | 1.0 (TS) |
| `@livekit/agents-plugin-google` | Gemini Live + Gemini LLM integration | 1.0 |
| `@livekit/agents-plugin-silero` | VAD (Voice Activity Detection) | 1.0 |
| `@livekit/rtc-node` | Low-level Node.js WebRTC client | Stable |
| `livekit-client` | Browser-side WebRTC client | Stable |

---

## Pricing

### LiveKit Cloud
| Tier | Monthly | Included Minutes | Overage |
|---|---|---|---|
| **Free** | $0 | 1,000 | N/A |
| **Ship** | $50 | 5,000 | ~$0.01/min |
| **Scale** | $500 | 50,000 | ~$0.01/min |
| **Enterprise** | Custom | Custom | Custom |

### Self-Hosted
- LiveKit server is **Apache 2.0** — fully self-hostable at zero license cost
- Only pay for compute (a single server handles ~1,000 concurrent participants)
- Agents framework also open-source
- **Still need SIP trunk provider** (Telnyx/Twilio) for PSTN connectivity

### Cost Comparison
| Scenario | Direct Telnyx/Twilio | LiveKit Cloud + Trunk | LiveKit Self-Hosted + Trunk |
|---|---|---|---|
| 1,000 min/mo | ~$15-30 (trunk only) | $0 (free tier) + $15-30 trunk | $5-10 server + $15-30 trunk |
| 10,000 min/mo | ~$150-300 | $50 + $150-300 trunk | $20-40 server + $150-300 trunk |
| 100,000 min/mo | ~$1,500-3,000 | $500+ + $1,500-3,000 trunk | $100-200 server + $1,500-3,000 trunk |

**Bottom line**: LiveKit adds $0-500/mo on top of existing trunk costs. For self-hosted, the overhead is minimal. The value proposition is developer productivity, not cost savings.

---

## Feature Comparison: Direct Adapters vs LiveKit

| Feature | Our Current Adapters | LiveKit |
|---|---|---|
| **Inbound calls** | Yes (webhook-based) | Yes (SIP trunk + dispatch rules) |
| **Outbound calls** | Manual via provider API | Yes (programmatic via SipClient) |
| **Audio streaming** | WebSocket per provider | Unified room-based |
| **Call transfer** | Basic (Twilio TwiML, Telnyx API) | Blind + attended transfer |
| **Conference/multi-party** | Not supported | Native (rooms model) |
| **AI agent framework** | Custom (direct Gemini API) | Built-in pipeline + multimodal |
| **Gemini Live integration** | Direct (our core value) | Official plugin |
| **Voice Activity Detection** | Gemini-native only | Silero VAD + Gemini-native |
| **Recording** | Not implemented | Built-in room recording |
| **DTMF** | Not implemented | Supported |
| **Provider lock-in** | Telnyx or Twilio specific | Provider-agnostic SIP |
| **Warm transfer (AI→human)** | Not implemented | Native (multi-participant rooms) |
| **SMS** | Twilio adapter | Not included (still need Twilio) |
| **Latency** | Lower (direct to provider) | +10-20ms (room routing) |
| **Self-hostable** | N/A (SaaS providers) | Yes (Apache 2.0) |

---

## Limitations & Considerations

1. **SMS not included**: LiveKit is audio/video/data only. SMS still requires direct Twilio/Telnyx integration.

2. **Extra infrastructure**: LiveKit server (cloud or self-hosted) is another moving part to manage.

3. **Latency trade-off**: The room abstraction adds ~10-20ms. For most voice AI, this is negligible, but worth measuring.

4. **Learning curve**: New SDK, room model, SIP trunk configuration. Team needs to learn LiveKit concepts.

5. **Gemini Live plugin maturity**: The `@livekit/agents-plugin-google` is v1.0 but relatively new. The Python SDK is more battle-tested.

6. **Lock-in risk**: While open-source, deep integration with LiveKit's room model creates coupling. Mitigated by self-hosting option.

7. **Overkill for simple use cases**: If you only need basic inbound call → AI response → hangup, direct adapters are simpler. LiveKit shines when you need rooms, transfers, recording, multi-participant.

---

## Recommendation

### Replace telephony adapters with LiveKit: **Yes, for voice. Keep Twilio for SMS.**

**Rationale**:
- Our Sierra analysis identified **Human Handoff (Gap 2)** and **Multi-Channel (Gap 4)** as critical gaps. LiveKit's room model solves warm transfer natively — AI agent and human agent can coexist in the same room, with the AI briefing the human before connecting the caller.
- The **Agents SDK** with official Gemini plugin gives us a production-grade voice pipeline instead of maintaining custom WebSocket streaming code.
- **Outbound calling** (Gap 10: Proactive/Outbound) becomes trivial with LiveKit's `SipClient`.
- **Recording** and **conference calling** come free with the room model.
- The self-hosting option aligns with enterprise deployment requirements.

### Proposed Monorepo Changes

```
packages/
├── core/           # Unchanged — shared types
├── react/          # Unchanged — React components
├── convex/         # Unchanged — Convex backend
├── telephony/      # Refactored
│   ├── src/
│   │   ├── livekit/
│   │   │   ├── agent.ts        # LiveKit agent with Gemini pipeline
│   │   │   ├── sip.ts          # SIP trunk + dispatch rule management
│   │   │   ├── rooms.ts        # Room lifecycle (create, join, transfer)
│   │   │   └── recording.ts    # Call recording via LiveKit Egress
│   │   ├── sms/
│   │   │   └── twilio.ts       # Keep Twilio for SMS (LiveKit doesn't do SMS)
│   │   ├── types.ts            # Updated interfaces
│   │   └── index.ts
│   └── package.json            # Add livekit-server-sdk, @livekit/agents, plugins
```

### Migration Path
1. **Phase 1**: Add LiveKit agent alongside existing adapters (feature flag)
2. **Phase 2**: Migrate inbound voice to LiveKit SIP bridge
3. **Phase 3**: Add outbound calling, recording, warm transfer
4. **Phase 4**: Deprecate direct Telnyx/Twilio voice adapters (keep Twilio SMS)

---

## Conversation Summary (Feb 7, 2026)

### Session 1: Monorepo + LiveKit Package

1. **Monorepo restructure completed**: Moved from single-package to pnpm workspaces with `packages/core`, `packages/react`, `packages/telephony`, and `apps/backend`. Fixed Turborepo config, TypeScript base config, CI/CD workflows.

2. **Code audit & fixes**: Found and fixed 57+ issues across all packages:
   - Convex backend (31 fixes): error handling, type safety, silent catches, incomplete implementations, unused variables, hardcoded values
   - Telephony adapters (13 fixes): removed stubs, added validation, proper error handling
   - CI/CD (2 fixes): pnpm migration, correct dist paths for monorepo
   - All checks passing: typecheck 5/5, tests 63/63, lint clean, build 3/3

3. **LiveKit survey completed**: Four parallel research agents investigated telephony features, Agents SDK, Node.js SDK, and pricing/competitive positioning.

4. **LiveKit integration implemented**: New `@genai-voice/livekit` package with three subpath exports:
   - `@genai-voice/livekit/server`: Token generation, webhook validation, room management via `livekit-server-sdk`
   - `@genai-voice/livekit/agent`: Voice AI agent using `@livekit/agents` + Gemini Live API (`google.beta.realtime.RealtimeModel` with `gemini-2.5-flash-native-audio-preview-12-2025`)
   - `@genai-voice/livekit/react`: `useLiveKitVoiceChat` hook, `LiveKitVoiceChat` component, `AudioVisualizerWrapper`
   - Convex backend: 2 new tables (`livekitRooms`, `livekitParticipants`) and 5 HTTP endpoints under `/api/livekit/*`
   - Dynamic tool loading from Convex via `createToolsFromConvex()`
   - All checks passing: typecheck, tests (63/63), lint, build (4/4 packages)

### Session 2: Deployment, Fixes & Live Demo

5. **Convex "use node" fix**: Files with `"use node"` directive can only export `internalAction` in Convex. Split 4 `*Internal.ts` files into `*Internal.ts` (actions only) + `*Db.ts` (mutations/queries). Updated all cross-references in HTTP handler files.

6. **Convex deployed**: Successfully deployed to Convex Cloud with all 32 indexes. Set environment variables (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`). Seeded "demo" app via `seed:seedApp`.

7. **LiveKit agent running**: Installed `@livekit/agents` and `@livekit/agents-plugin-google`. Fixed agent entry file to include required `export default`. Agent connects to LiveKit Cloud and joins rooms as a participant.

8. **Microphone fix**: Added `audio={true}` to `<LiveKitRoom>` so the user's microphone is published and the agent can hear user speech. Without this, the agent triggered "User away timeout."

9. **SDK update**: Updated `@google/genai` from v0.10.0 to v1.40.0 to support `inputAudioTranscription` parameter. Updated peer dependency to `>=1.0.0`.

10. **Live transcription display**: Rewrote `AudioVisualizerWrapper.tsx` to use `useTranscriptions()` hook (replacing deprecated `useTrackTranscription`). Displays both user and agent transcriptions chronologically as chat bubbles, sorted by `streamInfo.timestamp` with participant identity from `participantInfo.identity`.

### Session 3: Modularization & Cleanup

11. **Channel taxonomy**: Added `voice-webrtc` to `Channel` union type. Changed agent from `voice-livekit` → `voice-webrtc`.

12. **LiveKit type isolation**: Moved all LiveKit types from `@genai-voice/core` to `@genai-voice/livekit`. Removed `convexUrl`/`appSlug`/`appSecret` from `LiveKitAgentConfig`. Livekit package no longer depends on core.

13. **Convex moved to apps**: `packages/convex` → `apps/backend` (it's a deployable app, not a publishable package).

14. **Agent decoupled from Convex**: Introduced `AgentCallbacks` interface (`loadPersona`, `persistMessages`, `resolveConversation`) with `createConvexAgentCallbacks()` factory. Agent auto-creates Convex callbacks from env vars for backwards compat.

15. **React hook decoupled from Convex**: Introduced `LiveKitRoomCallbacks` interface (`createRoom`, `fetchToken`, `deleteRoom`) with `createConvexRoomCallbacks()` factory. Legacy props still work via auto-creation.

16. **Cleanup**: Deleted empty placeholder directories (`apps/dashboard`, `apps/example`). Renamed `apps/demo` → `apps/console`.

### Current Status:
- All packages build successfully (core, react, convex-backend, telephony, livekit)
- Convex backend deployed with 18 tables and 33+ HTTP endpoints
- LiveKit voice agent running end-to-end with live transcriptions
- `@genai-voice/livekit` is fully backend-agnostic (zero workspace dependencies)
- Console app at http://localhost:3100 (Google voice chat + LiveKit voice chat)
- Commits created but **not pushed**
