import { test, expect } from '@playwright/test';

test('homepage loads with hero content', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Build, deploy, and scale AI agents.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try It Live' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Docs' })).toBeVisible();
});

test('docs route renders API reference content', async ({ page }) => {
  await page.goto('/docs');

  await expect(page.getByRole('heading', { name: 'API Reference' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search endpoints...' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^All$/ }).first()).toBeVisible();
});
