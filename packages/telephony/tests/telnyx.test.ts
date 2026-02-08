import assert from 'node:assert/strict';
import { describe, test, mock } from 'node:test';

import { TelnyxVoiceAdapter } from '../src/adapters/telnyx';

describe('TelnyxVoiceAdapter', () => {
  test('handleInboundCall throws on invalid payload', async () => {
    const adapter = new TelnyxVoiceAdapter({
      apiKey: 'k',
      connectionId: 'c',
      fromNumber: '+15550001111',
    });

    await assert.rejects(
      () => adapter.handleInboundCall({}),
      /missing call_control_id or call_session_id/,
    );
  });

  test('handleInboundCall returns expected VoiceSession', async () => {
    const adapter = new TelnyxVoiceAdapter({
      apiKey: 'k',
      connectionId: 'c',
      fromNumber: '+15550001111',
    });

    const session = await adapter.handleInboundCall({
      data: {
        payload: {
          call_control_id: 'cc_1',
          call_session_id: 'cs_1',
          from: '+15551234567',
          to: '+15550001111',
        },
      },
    });

    assert.deepEqual(session, {
      callId: 'cc_1',
      sessionId: 'cs_1',
      from: '+15551234567',
      to: '+15550001111',
      audioConfig: { sampleRate: 16000, encoding: 'pcm16', channels: 1 },
      channel: 'voice-pstn',
    });
  });

  test('generateStreamResponse includes provided wsUrl', () => {
    const adapter = new TelnyxVoiceAdapter({
      apiKey: 'k',
      connectionId: 'c',
      fromNumber: '+15550001111',
    });
    const xml = adapter.generateStreamResponse(
      // session is unused
      {} as never,
      'wss://example.com/stream?x=1',
    );
    assert.ok(xml.includes('<Stream url="wss://example.com/stream?x=1"'));
  });

  test('playAudio sends expected Telnyx request and throws on non-ok', async () => {
    const adapter = new TelnyxVoiceAdapter({
      apiKey: 'telnyx-key',
      connectionId: 'c',
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
          callId: 'cc_1',
          sessionId: 'cs_1',
          from: '',
          to: '',
          audioConfig: { sampleRate: 16000, encoding: 'pcm16', channels: 1 },
          channel: 'voice-pstn',
        },
        new Uint8Array([1, 2, 3]).buffer,
      );

      assert.equal(mockFetch.mock.callCount(), 1);
      const [url, opts] = mockFetch.mock.calls[0].arguments as [string, RequestInit];
      assert.equal(
        url,
        'https://api.telnyx.com/v2/calls/cc_1/actions/playback_start',
      );
      assert.equal(opts.method, 'POST');
      assert.equal(
        (opts.headers as Record<string, string>).Authorization,
        'Bearer telnyx-key',
      );
      const body = JSON.parse(String(opts.body));
      assert.ok(String(body.audio_url).includes('sample_rate=16000'));
      assert.ok(String(body.audio_url).includes(';base64,'));
    } finally {
      globalThis.fetch = originalFetch;
    }

    const originalFetch2 = globalThis.fetch;
    const mockFetch2 = mock.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'nope',
    }));
    globalThis.fetch = mockFetch2 as unknown as typeof fetch;
    try {
      await assert.rejects(
        () =>
          adapter.playAudio(
            {
              callId: 'cc_1',
              sessionId: 'cs_1',
              from: '',
              to: '',
              audioConfig: { sampleRate: 16000, encoding: 'pcm16', channels: 1 },
              channel: 'voice-pstn',
            },
            new Uint8Array([1]).buffer,
          ),
        /Telnyx playAudio failed \(401\): nope/,
      );
    } finally {
      globalThis.fetch = originalFetch2;
    }
  });
});

