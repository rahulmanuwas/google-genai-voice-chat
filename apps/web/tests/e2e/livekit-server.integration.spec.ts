import { expect, test } from '@playwright/test';
import { createLiveKitToken, createRoom, deleteRoom } from '@genai-voice/livekit/server';

const integrationEnabled = process.env.E2E_INTEGRATION === '1';
const livekitUrl = process.env.LIVEKIT_URL;
const livekitApiKey = process.env.LIVEKIT_API_KEY;
const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

test.describe('LiveKit server API integration (real network)', () => {
  test.skip(!integrationEnabled, 'Set E2E_INTEGRATION=1 to enable real-network tests');
  test.skip(
    !livekitUrl || !livekitApiKey || !livekitApiSecret,
    'Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET',
  );

  test.describe.configure({ mode: 'serial' });

  test('can create a room, mint a token, and delete the room', async () => {
    test.setTimeout(120_000);

    const roomName = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await createRoom({
      serverUrl: livekitUrl!,
      apiKey: livekitApiKey!,
      apiSecret: livekitApiSecret!,
      roomName,
      maxParticipants: 2,
      emptyTimeout: 60,
      metadata: JSON.stringify({ source: 'playwright-e2e' }),
    });

    try {
      const jwt = await createLiveKitToken({
        apiKey: livekitApiKey!,
        apiSecret: livekitApiSecret!,
        roomName,
        identity: `e2e-${Math.random().toString(36).slice(2, 8)}`,
        name: 'E2E Tester',
        ttl: 300,
      });

      expect(typeof jwt).toBe('string');
      expect(jwt.split('.')).toHaveLength(3);
    } finally {
      await deleteRoom(roomName, {
        serverUrl: livekitUrl!,
        apiKey: livekitApiKey!,
        apiSecret: livekitApiSecret!,
      });
    }
  });
});

