import { expect, test } from '@playwright/test';

const integrationEnabled = process.env.E2E_INTEGRATION === '1';
const allowPstnCalls = process.env.E2E_TWILIO_ALLOW_CALLS === '1';
const toNumber = process.env.E2E_TWILIO_TO;

test.describe('Twilio PSTN call integration (real network)', () => {
  test.skip(!integrationEnabled, 'Set E2E_INTEGRATION=1 to enable real-network tests');
  test.skip(!allowPstnCalls, 'Set E2E_TWILIO_ALLOW_CALLS=1 to allow placing a real call');
  test.skip(!toNumber, 'Set E2E_TWILIO_TO to a test phone number in E.164 format');

  test.describe.configure({ mode: 'serial' });

  test('POST /api/twilio/call starts a call and returns a viewer token', async ({ request }) => {
    test.setTimeout(180_000);

    const res = await request.post('/api/twilio/call', {
      data: {
        to: toNumber,
        appSlug: process.env.NEXT_PUBLIC_APP_SLUG || 'demo-dentist',
      },
    });

    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as unknown;

    const roomName = (json as { roomName?: unknown }).roomName;
    const viewerToken = (json as { viewerToken?: unknown }).viewerToken;
    const serverUrl = (json as { serverUrl?: unknown }).serverUrl;

    expect(typeof roomName).toBe('string');
    expect(typeof viewerToken).toBe('string');
    expect(typeof serverUrl).toBe('string');
  });
});

