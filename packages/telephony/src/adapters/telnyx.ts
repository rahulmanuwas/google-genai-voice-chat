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
    const body = webhookBody as {
      data: {
        payload: {
          call_control_id: string;
          call_session_id: string;
          from: string;
          to: string;
        };
      };
    };

    const payload = body.data.payload;
    const audioConfig: AudioStreamConfig = {
      sampleRate: 16000,
      encoding: 'pcm16',
      channels: 1,
    };

    return {
      callId: payload.call_control_id,
      sessionId: payload.call_session_id,
      from: payload.from,
      to: payload.to,
      audioConfig,
      channel: 'voice-pstn',
    };
  }

  getAudioStream(_session: VoiceSession): ReadableStream<Uint8Array> {
    // In production, this connects to the Telnyx WebSocket media stream.
    // The caller sets up a WebSocket connection using the stream URL
    // returned by generateStreamResponse(), then pipes audio through.
    throw new Error(
      'Use generateStreamResponse() to set up WebSocket streaming, ' +
      'then pipe audio through the WebSocket connection directly.'
    );
  }

  async playAudio(session: VoiceSession, _audio: ArrayBuffer): Promise<void> {
    // Telnyx call control: play audio via API
    await fetch(
      `https://api.telnyx.com/v2/calls/${session.callId}/actions/playback_start`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          audio_url: 'data:audio/wav;base64,...', // Base64 or URL
        }),
      }
    );
  }

  async transferToAgent(session: VoiceSession, destination: string): Promise<void> {
    await fetch(
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
  }

  async hangup(session: VoiceSession): Promise<void> {
    await fetch(
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
