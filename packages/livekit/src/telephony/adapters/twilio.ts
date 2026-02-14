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
  OutboundVoiceAdapter,
  OutboundCallOptions,
  OutboundCallResult,
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
    const body = webhookBody as Record<string, unknown>;

    if (!body?.CallSid) {
      throw new Error('Invalid Twilio webhook body: missing CallSid');
    }

    const audioConfig: AudioStreamConfig = {
      sampleRate: 8000, // Twilio default mulaw
      encoding: 'mulaw',
      channels: 1,
    };

    return {
      callId: String(body.CallSid),
      sessionId: `twilio-${body.CallSid}`,
      from: String(body.From ?? ''),
      to: String(body.To ?? ''),
      audioConfig,
      channel: 'voice-pstn',
    };
  }

  async playAudio(session: VoiceSession, audio: ArrayBuffer): Promise<void> {
    // Twilio's <Play> verb requires audio hosted at a URL — it does not support
    // inline base64 data URIs. For real-time audio streaming, use
    // generateStreamResponse() to set up a WebSocket and pipe audio directly.
    //
    // This method converts the buffer to a base64 data URI and sends it via
    // TwiML update. If Twilio rejects the data URI, callers should host the
    // audio at a URL (e.g., via Twilio Assets or a CDN) and use the REST API.
    const base64 = Buffer.from(audio).toString('base64');
    const audioUri = `data:audio/basic;base64,${base64}`;

    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls/${session.callId}.json`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.authHeader,
      },
      body: new URLSearchParams({
        Twiml: `<Response><Play>${audioUri}</Play></Response>`,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Twilio playAudio failed (${response.status}): ${text}`);
    }
  }

  async transferToAgent(session: VoiceSession, destination: string): Promise<void> {
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls/${session.callId}.json`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.authHeader,
      },
      body: new URLSearchParams({
        Twiml: `<Response><Dial>${destination}</Dial></Response>`,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Twilio transfer failed (${response.status}): ${text}`);
    }
  }

  async hangup(session: VoiceSession): Promise<void> {
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls/${session.callId}.json`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.authHeader,
      },
      body: new URLSearchParams({ Status: 'completed' }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Twilio hangup failed (${response.status}): ${text}`);
    }
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

/**
 * Twilio outbound calling helper.
 *
 * Note: Twilio's call creation API is separate from handling inbound webhooks.
 * This is intentionally a small surface area for demos and basic integrations.
 */
export class TwilioOutboundCaller implements OutboundVoiceAdapter {
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

  async createOutboundCall(options: OutboundCallOptions): Promise<OutboundCallResult> {
    const to = options.to;
    const from = options.from || this.config.fromNumber;
    const twiml = options.twiml;
    const url = options.url;

    if (!to || !to.startsWith('+')) {
      throw new Error('Twilio createOutboundCall: "to" must be E.164 (e.g. +15551234567)');
    }
    if (!from || !from.startsWith('+')) {
      throw new Error('Twilio createOutboundCall: "from" must be E.164 (e.g. +15551234567)');
    }
    if ((twiml && url) || (!twiml && !url)) {
      throw new Error('Twilio createOutboundCall: provide exactly one of "twiml" or "url"');
    }

    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls.json`;
    const params = new URLSearchParams({
      To: to,
      From: from,
    });
    if (twiml) params.set('Twiml', twiml);
    if (url) params.set('Url', url);
    if (options.statusCallbackUrl) params.set('StatusCallback', options.statusCallbackUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.authHeader,
      },
      body: params,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Twilio createOutboundCall failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as { sid?: string };
    if (!data.sid) {
      throw new Error('Twilio createOutboundCall: response missing sid');
    }

    return { callId: data.sid };
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

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Twilio sendSMS failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as { sid?: string };
    if (!data.sid) {
      throw new Error('Twilio sendSMS: response missing sid');
    }
    return { messageId: data.sid };
  }

  async handleInboundSMS(webhookBody: unknown): Promise<InboundMessage> {
    const body = webhookBody as Record<string, unknown>;

    if (!body?.MessageSid) {
      throw new Error('Invalid Twilio SMS webhook body: missing MessageSid');
    }

    return {
      id: String(body.MessageSid),
      from: String(body.From ?? ''),
      to: String(body.To ?? ''),
      body: String(body.Body ?? ''),
      channel: 'sms',
      receivedAt: Date.now(),
    };
  }
}
