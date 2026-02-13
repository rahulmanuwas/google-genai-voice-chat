import { defineConfig, devices } from '@playwright/test';

const NEXT_PUBLIC_GEMINI_API_KEY =
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'dummy-playwright-key';
const NEXT_PUBLIC_CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL || 'http://localhost:4000';
const NEXT_PUBLIC_LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://localhost:4000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3200',
    headless: true,
    trace: 'on-first-retry',
    viewport: { width: 1365, height: 900 },
    permissions: ['microphone'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3200',
    env: {
      NEXT_PUBLIC_GEMINI_API_KEY,
      NEXT_PUBLIC_CONVEX_URL,
      NEXT_PUBLIC_LIVEKIT_URL,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
