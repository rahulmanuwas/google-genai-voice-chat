/**
 * Telnyx Voice Adapter
 *
 * Preferred for AI voice — Telnyx owns their network,
 * resulting in ~30-50ms lower round-trip latency vs Twilio.
 * TeXML is compatible with TwiML for easy migration.
 */

import type {
  VoiceAdapter,
  VoiceSession,
  AudioStreamConfig,
} from '../types';

export interface TelnyxConfig {
  apiKey: string;
  connectionId: string;
  /** Phone number in E.164 format */
  fromNumber: string;
}

export class TelnyxVoiceAdapter implements VoiceAdapter {
  readonly provider = 'telnyx';
  private config: TelnyxConfig;

  constructor(config: TelnyxConfig) {
    this.config = config;
  }

  async handleInboundCall(webhookBody: unknown): Promise<VoiceSession> {
    const body = webhookBody as Record<string, unknown>;
    const data = body?.data as Record<string, unknown> | undefined;
    const payload = data?.payload as Record<string, unknown> | undefined;

    if (!payload?.call_control_id || !payload?.call_session_id) {
      throw new Error(
        'Invalid Telnyx webhook body: missing call_control_id or call_session_id'
      );
    }

    const audioConfig: AudioStreamConfig = {
      sampleRate: 16000,
      encoding: 'pcm16',
      channels: 1,
    };

    return {
      callId: String(payload.call_control_id),
      sessionId: String(payload.call_session_id),
      from: String(payload.from ?? ''),
      to: String(payload.to ?? ''),
      audioConfig,
      channel: 'voice-pstn',
    };
  }

  async playAudio(session: VoiceSession, audio: ArrayBuffer): Promise<void> {
    // Telnyx call control: play audio via API using base64-encoded data URI
    const base64 = Buffer.from(audio).toString('base64');
    const response = await fetch(
      `https://api.telnyx.com/v2/calls/${session.callId}/actions/playback_start`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          audio_url: `data:audio/raw;encoding=linear16;sample_rate=${session.audioConfig.sampleRate};base64,${base64}`,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Telnyx playAudio failed (${response.status}): ${text}`);
    }
  }

  async transferToAgent(session: VoiceSession, destination: string): Promise<void> {
    const response = await fetch(
      `https://api.telnyx.com/v2/calls/${session.callId}/actions/transfer`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ to: destination }),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Telnyx transfer failed (${response.status}): ${text}`);
    }
  }

  async hangup(session: VoiceSession): Promise<void> {
    const response = await fetch(
      `https://api.telnyx.com/v2/calls/${session.callId}/actions/hangup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Telnyx hangup failed (${response.status}): ${text}`);
    }
  }

  generateStreamResponse(_session: VoiceSession, wsUrl: string): string {
    // TeXML (Telnyx's TwiML-compatible markup)
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" />
  </Connect>
</Response>`;
  }
}
