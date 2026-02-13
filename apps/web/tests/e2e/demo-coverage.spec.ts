import { expect, test } from '@playwright/test';

const AGENTS = [
  { route: '/demos/chatbot', heading: 'Voice Chat', linkName: 'Voice Chat' },
  { route: '/demos/custom', heading: 'Custom UI', linkName: 'Embedded Widget' },
  { route: '/demos/livekit', heading: 'LiveKit Agent', linkName: 'Voice Agent' },
  { route: '/demos/twilio-call', heading: 'PSTN Call', linkName: 'Phone Call' },
] as const;

const SCENARIOS = ['Dentist Appointment', 'Earnings Call Explainer', 'E-commerce Support'] as const;

async function selectScenario(page, scenarioName: (typeof SCENARIOS)[number]) {
  const picker = page.getByRole('combobox');
  await picker.click();
  await page.getByRole('option', { name: scenarioName }).click();
  await expect(picker).toContainText(scenarioName);
}

test('all agent demos are reachable from sidebar and expose scenario picker', async ({ page }) => {
  await page.goto('/demos/chatbot');

  for (const agent of AGENTS) {
    const nav = page.getByRole('link', { name: agent.linkName });
    await expect(nav).toBeVisible();
    await nav.click();
    await expect(page).toHaveURL(agent.route);
    await expect(page.getByRole('heading', { name: agent.heading })).toBeVisible();
    await expect(page.getByRole('combobox')).toBeVisible();

    await page.getByRole('combobox').click();
    for (const scenario of SCENARIOS) {
      await expect(page.getByRole('option', { name: scenario })).toBeVisible();
    }
    await page.keyboard.press('Escape');
  }
});

test('livekit demo shows scenario state panel for dentist and e-commerce scenarios', async ({ page }) => {
  const scenarioStateCalls: string[] = [];

  await page.route('**/api/scenario-state*', (route) => {
    const reqUrl = new URL(route.request().url());
    const appSlug = reqUrl.searchParams.get('appSlug');
    if (appSlug) scenarioStateCalls.push(appSlug);
    let state = null;

    if (appSlug === 'demo-dentist') {
      state = {
        appointments: [
          {
            id: 'APT-1001',
            patient: 'Jordan Lee',
            date: '2026-02-18',
            time: '10:30 AM',
            provider: 'Dr. Emily Chen',
            type: 'cleaning',
            status: 'confirmed',
          },
        ],
      };
    } else if (appSlug === 'demo-ecommerce') {
      state = {
        orders: [
          {
            orderNumber: 'ORD-2002',
            customer: 'Alex Kim',
            status: 'shipped',
            total: '$128.00',
            items: [
              { name: 'Ceramic mug', sku: 'CB-MUG-03', quantity: 1, price: '$24.00' },
            ],
            returnId: 'R-9901',
          },
        ],
      };
    }

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        appSlug,
        state,
        updatedAt: 1739424000000,
      }),
    });
  });

  await page.goto('/demos/livekit');
  await expect(page.getByRole('heading', { name: 'LiveKit Agent' })).toBeVisible();
  await expect
    .poll(() => scenarioStateCalls.includes('demo-dentist'))
    .toBeTruthy();

  await selectScenario(page, 'E-commerce Support');
  await expect
    .poll(() => scenarioStateCalls.includes('demo-ecommerce'))
    .toBeTruthy();

  await selectScenario(page, 'Earnings Call Explainer');
  await expect(page.getByRole('heading', { name: 'LiveKit Agent' })).toBeVisible();
});

test('twilio call page handles call initiation failures with clear error message', async ({ page }) => {
  await page.route('**/api/twilio/call', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'mock twilio backend unavailable' }),
    }),
  );

  await page.goto('/demos/twilio-call');
  await expect(page.getByRole('heading', { name: 'PSTN Call' })).toBeVisible();
  await page.getByLabel('To (E.164)').fill('+15550001111');
  await page.getByRole('button', { name: 'Start Call' }).click();

  await expect(page.getByText('Error:')).toBeVisible();
  await expect(page.getByText('mock twilio backend unavailable')).toBeVisible();
});
