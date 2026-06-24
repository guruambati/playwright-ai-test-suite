import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the AI Test Suite.
 *
 * Key decisions:
 *  - Single Chromium project: keeps CI fast and focused
 *  - webServer: spins up the mock LLM server before tests run
 *  - trace: on-first-retry so failures are always debuggable
 *  - globalTimeout: prevents runaway tests from blocking CI
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,       // Sequential — mock server has shared state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:3131',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  // Spin up mock LLM server before any test runs
  webServer: {
    command: 'node src/mocks/mock-llm-server.js',
    url: 'http://localhost:3131/health',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  outputDir: 'test-results/',
});
