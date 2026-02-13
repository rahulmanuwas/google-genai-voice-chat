import { expect, test } from '@playwright/test';

const integrationEnabled = process.env.E2E_INTEGRATION === '1';
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const hasRealApiKey = Boolean(apiKey) && apiKey !== 'dummy-playwright-key';

test.describe('Gemini Live integration via Custom UI (real network)', () => {
  test.skip(!integrationEnabled, 'Set E2E_INTEGRATION=1 to enable real-network tests');
  test.skip(!hasRealApiKey, 'Set NEXT_PUBLIC_GEMINI_API_KEY to a real key');

  test.describe.configure({ mode: 'serial' });

  test('connects and returns an assistant reply to a text message', async ({ page }) => {
    test.setTimeout(240_000);

    await page.goto('/demos/custom');
    await expect(page.getByRole('heading', { name: 'Custom UI' })).toBeVisible();

    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible();

    const assistantMessages = page.locator(
      '[data-testid="custom-chat-message"]:not([data-role="user"])',
    );
    const initialAssistantCount = await assistantMessages.count();

    const prompt = `Hi! This is a Playwright integration test. Reply with one short sentence. (${Date.now()})`;
    await page.getByPlaceholder('Type a message...').fill(prompt);
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(
      page
        .locator('[data-testid="custom-chat-message"][data-role="user"]')
        .filter({ hasText: prompt }),
    ).toBeVisible();

    await expect
      .poll(async () => assistantMessages.count(), { timeout: 90_000 })
      .toBeGreaterThan(initialAssistantCount);

    await page.getByRole('button', { name: 'Disconnect' }).click();
    await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
  });
});

