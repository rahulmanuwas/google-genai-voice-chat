// @genai-voice/sdk/telephony — provider-agnostic telephony adapters

// Core types
export type {
  AudioStreamConfig,
  VoiceSession,
  InboundMessage,
  VoiceAdapter,
  OutboundVoiceAdapter,
  OutboundCallOptions,
  OutboundCallResult,
  SMSAdapter,
  EmailAdapter,
  TelephonyConfig,
  TelephonyEvent,
  TelephonyContext,
} from './types';

// Adapters
export { TelnyxVoiceAdapter } from './adapters/telnyx';
export type { TelnyxConfig } from './adapters/telnyx';

export { TwilioVoiceAdapter, TwilioOutboundCaller, TwilioSMSAdapter } from './adapters/twilio';
export type { TwilioConfig } from './adapters/twilio';
