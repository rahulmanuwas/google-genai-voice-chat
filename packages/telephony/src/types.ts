/**
 * Provider-agnostic telephony adapter interfaces.
 *
 * Abstracts Telnyx, Twilio, and future providers behind
 * a common interface so the platform doesn't couple to any one vendor.
 */

import type { Channel, Message } from '@genai-voice/core';

/** Audio stream format for real-time voice */
export interface AudioStreamConfig {
  sampleRate: number;
  encoding: 'pcm16' | 'mulaw' | 'alaw';
  channels: 1 | 2;
}

/** An active voice call session */
export interface VoiceSession {
  /** Provider-assigned call ID */
  callId: string;
  /** Our internal session ID */
  sessionId: string;
  /** Caller phone number */
  from: string;
  /** Called phone number */
  to: string;
  /** Audio format for this call */
  audioConfig: AudioStreamConfig;
  /** Channel type */
  channel: Channel;
}

/** Inbound message from SMS/email */
export interface InboundMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  channel: Channel;
  receivedAt: number;
  metadata?: Record<string, unknown>;
}

/** Voice telephony adapter */
export interface VoiceAdapter {
  /** Provider name */
  readonly provider: string;

  /** Parse an inbound call webhook and return a session */
  handleInboundCall(webhookBody: unknown): Promise<VoiceSession>;

  /** Get a readable audio stream from the call */
  getAudioStream(session: VoiceSession): ReadableStream<Uint8Array>;

  /** Play audio back to the caller */
  playAudio(session: VoiceSession, audio: ArrayBuffer): Promise<void>;

  /** Transfer the call to a human agent */
  transferToAgent(session: VoiceSession, destination: string): Promise<void>;

  /** End the call */
  hangup(session: VoiceSession): Promise<void>;

  /** Generate webhook response markup (TwiML / TeXML) for media streaming */
  generateStreamResponse(session: VoiceSession, wsUrl: string): string;
}

/** SMS adapter */
export interface SMSAdapter {
  /** Provider name */
  readonly provider: string;

  /** Send an SMS message */
  sendSMS(to: string, from: string, body: string): Promise<{ messageId: string }>;

  /** Parse an inbound SMS webhook */
  handleInboundSMS(webhookBody: unknown): Promise<InboundMessage>;
}

/** Email adapter (future) */
export interface EmailAdapter {
  /** Provider name */
  readonly provider: string;

  /** Send an email */
  sendEmail(to: string, subject: string, body: string): Promise<{ messageId: string }>;

  /** Parse an inbound email webhook */
  handleInboundEmail(webhookBody: unknown): Promise<InboundMessage>;
}

/** Combined telephony configuration */
export interface TelephonyConfig {
  voice?: VoiceAdapter;
  sms?: SMSAdapter;
  email?: EmailAdapter;
}

/** Webhook event types emitted by telephony adapters */
export type TelephonyEvent =
  | { type: 'call.incoming'; session: VoiceSession }
  | { type: 'call.ended'; callId: string; reason: string }
  | { type: 'call.transferred'; callId: string; destination: string }
  | { type: 'sms.incoming'; message: InboundMessage }
  | { type: 'sms.sent'; messageId: string; to: string };

/** Conversation context passed to AI from telephony channels */
export interface TelephonyContext {
  session: VoiceSession | null;
  callerNumber: string;
  channel: Channel;
  messages: Message[];
}
