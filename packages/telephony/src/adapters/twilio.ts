/**
 * Twilio Voice & SMS Adapter
 *
 * Industry-standard telephony provider. Best SMS deliverability.
 * Slightly higher voice latency than Telnyx for AI applications
 * due to media streams routing through Twilio's cloud.
 */

import type {
  VoiceAdapter,
  SMSAdapter,
  VoiceSession,
  InboundMessage,
  AudioStreamConfig,
} from '../types';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** Phone number in E.164 format */
  fromNumber: string;
}

export class TwilioVoiceAdapter implements VoiceAdapter {
  readonly provider = 'twilio';
  private config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
  }

  private get authHeader(): string {
    const encoded = Buffer.from(
      `${this.config.accountSid}:${this.config.authToken}`
    ).toString('base64');
    return `Basic ${encoded}`;
  }

  async handleInboundCall(webhookBody: unknown): Promise<VoiceSession> {
    const body = webhookBody as {
      CallSid: string;
      From: string;
      To: string;
    };

    const audioConfig: AudioStreamConfig = {
      sampleRate: 8000, // Twilio default mulaw
      encoding: 'mulaw',
      channels: 1,
    };

    return {
      callId: body.CallSid,
      sessionId: `twilio-${body.CallSid}`,
      from: body.From,
      to: body.To,
      audioConfig,
      channel: 'voice-pstn',
    };
  }

  getAudioStream(_session: VoiceSession): ReadableStream<Uint8Array> {
    throw new Error(
      'Use generateStreamResponse() to set up WebSocket streaming, ' +
      'then pipe audio through the WebSocket connection directly.'
    );
  }

  async playAudio(session: VoiceSession, _audio: ArrayBuffer): Promise<void> {
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls/${session.callId}.json`;
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.authHeader,
      },
      body: new URLSearchParams({
        Twiml: '<Response><Play>audio_url_here</Play></Response>',
      }),
    });
  }

  async transferToAgent(session: VoiceSession, destination: string): Promise<void> {
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls/${session.callId}.json`;
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.authHeader,
      },
      body: new URLSearchParams({
        Twiml: `<Response><Dial>${destination}</Dial></Response>`,
      }),
    });
  }

  async hangup(session: VoiceSession): Promise<void> {
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls/${session.callId}.json`;
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.authHeader,
      },
      body: new URLSearchParams({ Status: 'completed' }),
    });
  }

  generateStreamResponse(_session: VoiceSession, wsUrl: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" />
  </Connect>
</Response>`;
  }
}

export class TwilioSMSAdapter implements SMSAdapter {
  readonly provider = 'twilio';
  private config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
  }

  private get authHeader(): string {
    const encoded = Buffer.from(
      `${this.config.accountSid}:${this.config.authToken}`
    ).toString('base64');
    return `Basic ${encoded}`;
  }

  async sendSMS(
    to: string,
    from: string,
    body: string
  ): Promise<{ messageId: string }> {
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.authHeader,
      },
      body: new URLSearchParams({
        To: to,
        From: from || this.config.fromNumber,
        Body: body,
      }),
    });

    const data = (await response.json()) as { sid: string };
    return { messageId: data.sid };
  }

  async handleInboundSMS(webhookBody: unknown): Promise<InboundMessage> {
    const body = webhookBody as {
      MessageSid: string;
      From: string;
      To: string;
      Body: string;
    };

    return {
      id: body.MessageSid,
      from: body.From,
      to: body.To,
      body: body.Body,
      channel: 'sms',
      receivedAt: Date.now(),
    };
  }
}
