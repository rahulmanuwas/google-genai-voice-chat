import { expect, test } from '@playwright/test';

const DEMO_PAGES = [
  { route: '/demos/chatbot', heading: 'Voice Chat' },
  { route: '/demos/custom', heading: 'Custom UI' },
  { route: '/demos/livekit', heading: 'LiveKit Agent' },
  { route: '/demos/twilio-call', heading: 'PSTN Call' },
] as const;

const SCENARIOS = [
  'Dentist Appointment',
  'Earnings Call Explainer',
  'E-commerce Support',
] as const;

async function selectScenario(page, scenarioName: (typeof SCENARIOS)[number]) {
  const picker = page.getByRole('combobox');
  await expect(picker).toBeVisible();
  await picker.click();
  await page.getByRole('option', { name: scenarioName }).click();
  await expect(picker).toContainText(scenarioName);
}

test.describe('Agent demos support scenario selection', () => {
  for (const { route, heading } of DEMO_PAGES) {
    test(`can switch all scenarios in ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await expect(page.getByRole('combobox')).toBeVisible();

      for (const scenarioName of SCENARIOS) {
        await selectScenario(page, scenarioName);
      }
    });
  }
});
