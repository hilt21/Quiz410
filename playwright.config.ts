import { defineConfig } from '@playwright/test';
const baseURL = `http://127.0.0.1:4173${process.env.TEST_BASE_PATH ?? '/'}`;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
