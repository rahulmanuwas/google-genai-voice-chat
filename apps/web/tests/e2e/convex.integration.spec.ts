import { expect, test } from '@playwright/test';

const integrationEnabled = process.env.E2E_INTEGRATION === '1';
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const appSecret = process.env.APP_SECRET;

test.describe('Convex integration (real network)', () => {
  test.skip(!integrationEnabled, 'Set E2E_INTEGRATION=1 to enable real-network tests');
  test.skip(!convexUrl || !appSecret, 'Set NEXT_PUBLIC_CONVEX_URL and APP_SECRET');

  test.describe.configure({ mode: 'serial' });

  test('POST /api/session returns a sessionToken', async ({ request }) => {
    test.setTimeout(120_000);

    const res = await request.post('/api/session', {
      data: { appSlug: process.env.NEXT_PUBLIC_APP_SLUG || 'demo-dentist' },
    });

    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as unknown;

    const sessionToken = (json as { sessionToken?: unknown }).sessionToken;
    expect(typeof sessionToken).toBe('string');
    expect(sessionToken.length).toBeGreaterThan(10);
  });

  test('GET /api/scenario-state returns state payload', async ({ request }) => {
    test.setTimeout(120_000);

    const res = await request.get('/api/scenario-state?appSlug=demo-dentist');
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as unknown;

    expect(typeof (json as { appSlug?: unknown }).appSlug).toBe('string');
    expect('state' in (json as Record<string, unknown>)).toBeTruthy();
  });
});

