# @genai-voice/telephony

Provider-agnostic telephony adapters for the genai-voice platform. Abstracts Telnyx, Twilio, and future providers behind a common interface.

## Why Two Providers?

| | Telnyx | Twilio |
|---|---|---|
| **Voice quality** | Better -- owns the network | Good |
| **AI voice latency** | ~30-50ms lower round-trip | Higher |
| **Media streaming** | Cleaner WebSocket API | More opinionated |
| **SMS deliverability** | Good | Industry best |
| **Pricing** | ~$0.005/min voice | ~$0.013/min voice |
| **Ecosystem** | Focused telecom | Massive (Flex, Verify, SendGrid) |

**Recommendation**: Telnyx for voice, Twilio for SMS. The adapter pattern lets you swap freely.

## Installation

```bash
npm install @genai-voice/telephony
```

## Usage

### Telnyx Voice

```typescript
import { TelnyxVoiceAdapter } from '@genai-voice/telephony/telnyx';

const voice = new TelnyxVoiceAdapter({
  apiKey: process.env.TELNYX_API_KEY!,
  connectionId: process.env.TELNYX_CONNECTION_ID!,
  fromNumber: '+15551234567',
});

// Handle inbound call webhook
const session = await voice.handleInboundCall(webhookBody);

// Generate TwiML/TeXML for media streaming
const twiml = voice.generateStreamResponse(session, 'wss://your-server/stream');

// Transfer to human agent
await voice.transferToAgent(session, '+15559876543');

// Hang up
await voice.hangup(session);
```

### Twilio SMS (Optional)

```typescript
import { TwilioSMSAdapter } from '@genai-voice/telephony/twilio';

const sms = new TwilioSMSAdapter({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  fromNumber: '+15551234567',
});

// Send SMS
await sms.sendSMS('+15559876543', '+15551234567', 'Your order has shipped!');

// Handle inbound SMS webhook
const message = await sms.handleInboundSMS(webhookBody);
```

### Twilio Voice

```typescript
import { TwilioVoiceAdapter } from '@genai-voice/telephony/twilio';

const voice = new TwilioVoiceAdapter({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  fromNumber: '+15551234567',
});

// Same interface as Telnyx
const session = await voice.handleInboundCall(webhookBody);
const twiml = voice.generateStreamResponse(session, 'wss://your-server/stream');
```

## Adapter Interface

Both voice adapters implement the same `VoiceAdapter` interface:

```typescript
interface VoiceAdapter {
  readonly provider: string;
  handleInboundCall(webhookBody: unknown): Promise<VoiceSession>;
  getAudioStream(session: VoiceSession): ReadableStream<Uint8Array>;
  playAudio(session: VoiceSession, audio: ArrayBuffer): Promise<void>;
  transferToAgent(session: VoiceSession, destination: string): Promise<void>;
  hangup(session: VoiceSession): Promise<void>;
  generateStreamResponse(session: VoiceSession, wsUrl: string): string;
}
```

SMS adapters implement `SMSAdapter`:

```typescript
interface SMSAdapter {
  readonly provider: string;
  sendSMS(to: string, from: string, body: string): Promise<{ messageId: string }>;
  handleInboundSMS(webhookBody: unknown): Promise<InboundMessage>;
}
```

## Integration with Convex Backend

The telephony adapters are designed to work with Convex HTTP webhooks:

```typescript
// In a Convex HTTP action:
import { TwilioSMSAdapter } from '@genai-voice/telephony/twilio';

export const handleInboundSMS = httpAction(async (ctx, request) => {
  const sms = new TwilioSMSAdapter({ ... });
  const message = await sms.handleInboundSMS(await request.formData());

  // Process with Gemini, save to conversations table, etc.
  // ...

  // Reply
  await sms.sendSMS(message.from, message.to, aiResponse);
});
```

## Audio Formats

| Provider | Default Encoding | Sample Rate | Notes |
|---|---|---|---|
| Telnyx | PCM16 | 16kHz | Native -- matches Gemini input format |
| Twilio | mulaw | 8kHz | Requires conversion for Gemini (upsample + re-encode) |

Telnyx's native PCM16 at 16kHz is a direct match for Gemini Live API's input format, eliminating transcoding overhead.

## LiveKit SIP (Twilio Trunk)

If you're using LiveKit's SIP service with a Twilio trunk, you'll typically originate PSTN calls via LiveKit (which then uses the trunk), attaching the call to a LiveKit room for your agent to join.

In this repo, the LiveKit package exposes a helper:

```ts
import { createSipParticipant } from '@genai-voice/livekit/server';
```

That wraps LiveKit's SIP API (`SipClient.createSipParticipant`) to dial a phone number into a room.
