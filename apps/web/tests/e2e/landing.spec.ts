import { test, expect } from '@playwright/test';

test('homepage loads with hero content', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Build, deploy, and scale');
  await expect(page.locator('#hero').getByRole('link', { name: 'Try Live Demo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Dashboard' }).first()).toBeVisible();
});

test('homepage has navigation with key links', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: '.Riyaan' }).first()).toBeVisible();
  await expect(page.locator('#hero')).toBeVisible();
});
