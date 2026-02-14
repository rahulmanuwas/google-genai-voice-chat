import assert from 'node:assert/strict';
import { describe, test, mock } from 'node:test';

import { TwilioOutboundCaller, TwilioSMSAdapter, TwilioVoiceAdapter } from '../src/telephony/adapters/twilio';

describe('TwilioVoiceAdapter', () => {
  test('handleInboundCall throws on missing CallSid', async () => {
    const adapter = new TwilioVoiceAdapter({
      accountSid: 'AC_x',
      authToken: 't',
      fromNumber: '+15550001111',
    });
    await assert.rejects(() => adapter.handleInboundCall({}), /missing CallSid/);
  });

  test('handleInboundCall returns expected VoiceSession', async () => {
    const adapter = new TwilioVoiceAdapter({
      accountSid: 'AC_x',
      authToken: 't',
      fromNumber: '+15550001111',
    });
    const session = await adapter.handleInboundCall({
      CallSid: 'CA_1',
      From: '+15551234567',
      To: '+15550001111',
    });
    assert.deepEqual(session, {
      callId: 'CA_1',
      sessionId: 'twilio-CA_1',
      from: '+15551234567',
      to: '+15550001111',
      audioConfig: { sampleRate: 8000, encoding: 'mulaw', channels: 1 },
      channel: 'voice-pstn',
    });
  });

  test('playAudio uses TwiML update endpoint and Authorization header', async () => {
    const adapter = new TwilioVoiceAdapter({
      accountSid: 'AC_123',
      authToken: 'auth_456',
      fromNumber: '+15550001111',
    });

    const originalFetch = globalThis.fetch;
    const mockFetch = mock.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
    }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      await adapter.playAudio(
        {
          callId: 'CA_1',
          sessionId: 'twilio-CA_1',
          from: '',
          to: '',
          audioConfig: { sampleRate: 8000, encoding: 'mulaw', channels: 1 },
          channel: 'voice-pstn',
        },
        new Uint8Array([1, 2, 3]).buffer,
      );

      const [url, opts] = mockFetch.mock.calls[0].arguments as [string, RequestInit];
      assert.equal(
        url,
        'https://api.twilio.com/2010-04-01/Accounts/AC_123/Calls/CA_1.json',
      );
      assert.equal((opts.headers as Record<string, string>).Authorization, `Basic ${Buffer.from('AC_123:auth_456').toString('base64')}`);
      assert.ok(opts.body instanceof URLSearchParams);
      assert.ok(String((opts.body as URLSearchParams).get('Twiml')).includes('<Play>data:audio/basic;base64,'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('generateStreamResponse includes provided wsUrl', () => {
    const adapter = new TwilioVoiceAdapter({
      accountSid: 'AC_x',
      authToken: 't',
      fromNumber: '+15550001111',
    });
    const xml = adapter.generateStreamResponse({} as never, 'wss://example.com/stream');
    assert.ok(xml.includes('<Stream url="wss://example.com/stream"'));
  });
});

describe('TwilioOutboundCaller', () => {
  test('createOutboundCall validates inputs', async () => {
    const caller = new TwilioOutboundCaller({
      accountSid: 'AC_x',
      authToken: 't',
      fromNumber: '+15550001111',
    });

    await assert.rejects(
      () => caller.createOutboundCall({ to: '1555', twiml: '<Response />' }),
      /"to" must be E\.164/,
    );
    await assert.rejects(
      () => caller.createOutboundCall({ to: '+15551234567', from: '1555', twiml: '<Response />' }),
      /"from" must be E\.164/,
    );
    await assert.rejects(
      () => caller.createOutboundCall({ to: '+15551234567', twiml: '<Response />', url: 'https://x' }),
      /exactly one of "twiml" or "url"/,
    );
    await assert.rejects(
      () => caller.createOutboundCall({ to: '+15551234567' } as never),
      /exactly one of "twiml" or "url"/,
    );
  });

  test('createOutboundCall posts expected params and returns callId', async () => {
    const caller = new TwilioOutboundCaller({
      accountSid: 'AC_123',
      authToken: 'auth_456',
      fromNumber: '+15550001111',
    });

    const originalFetch = globalThis.fetch;
    const mockFetch = mock.fn(async () => ({
      ok: true,
      status: 201,
      text: async () => '',
      json: async () => ({ sid: 'CA_new' }),
    }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const res = await caller.createOutboundCall({
        to: '+15551234567',
        twiml: '<Response><Say>hi</Say></Response>',
        statusCallbackUrl: 'https://example.com/status',
      });
      assert.deepEqual(res, { callId: 'CA_new' });

      const [url, opts] = mockFetch.mock.calls[0].arguments as [string, RequestInit];
      assert.equal(
        url,
        'https://api.twilio.com/2010-04-01/Accounts/AC_123/Calls.json',
      );
      assert.ok(opts.body instanceof URLSearchParams);
      const params = opts.body as URLSearchParams;
      assert.equal(params.get('To'), '+15551234567');
      assert.equal(params.get('From'), '+15550001111');
      assert.ok(String(params.get('Twiml')).includes('<Response>'));
      assert.equal(params.get('StatusCallback'), 'https://example.com/status');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('createOutboundCall throws when response missing sid', async () => {
    const caller = new TwilioOutboundCaller({
      accountSid: 'AC_123',
      authToken: 'auth_456',
      fromNumber: '+15550001111',
    });

    const originalFetch = globalThis.fetch;
    const mockFetch = mock.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({}),
    }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      await assert.rejects(
        () =>
          caller.createOutboundCall({
            to: '+15551234567',
            url: 'https://example.com/twiml',
          }),
        /response missing sid/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('TwilioSMSAdapter', () => {
  test('sendSMS posts to Messages endpoint and returns messageId', async () => {
    const sms = new TwilioSMSAdapter({
      accountSid: 'AC_123',
      authToken: 'auth_456',
      fromNumber: '+15550001111',
    });

    const originalFetch = globalThis.fetch;
    const mockFetch = mock.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ sid: 'SM_1' }),
    }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const res = await sms.sendSMS('+15551234567', '', 'hello');
      assert.deepEqual(res, { messageId: 'SM_1' });

      const [url, opts] = mockFetch.mock.calls[0].arguments as [string, RequestInit];
      assert.equal(
        url,
        'https://api.twilio.com/2010-04-01/Accounts/AC_123/Messages.json',
      );
      assert.ok(opts.body instanceof URLSearchParams);
      const params = opts.body as URLSearchParams;
      assert.equal(params.get('To'), '+15551234567');
      assert.equal(params.get('From'), '+15550001111'); // fallback to config
      assert.equal(params.get('Body'), 'hello');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('handleInboundSMS throws on missing MessageSid and sets receivedAt', async () => {
    const sms = new TwilioSMSAdapter({
      accountSid: 'AC_x',
      authToken: 't',
      fromNumber: '+15550001111',
    });

    await assert.rejects(() => sms.handleInboundSMS({}), /missing MessageSid/);

    const before = Date.now();
    const msg = await sms.handleInboundSMS({
      MessageSid: 'SM_1',
      From: '+15551234567',
      To: '+15550001111',
      Body: 'hi',
    });
    const after = Date.now();

    assert.equal(msg.id, 'SM_1');
    assert.equal(msg.channel, 'sms');
    assert.equal(msg.body, 'hi');
    assert.ok(msg.receivedAt >= before && msg.receivedAt <= after);
  });
});
