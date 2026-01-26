import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Meta-Ralph UI
 *
 * This configuration sets up end-to-end testing for the Meta-Ralph Next.js application.
 * Tests run against a dev server on port 3001 using Chromium browser.
 *
 * Key decisions:
 * - Single browser (Chromium) to keep CI fast while covering essential functionality
 * - Retries on CI only to handle flaky network conditions
 * - Screenshots on failure for debugging
 * - Video recording only on retry for failed test debugging
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only - helps with flaky network conditions */
  retries: process.env.CI ? 2 : 0,
  /* Limit parallel workers on CI for resource management */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3001',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure for debugging */
    screenshot: 'only-on-failure',

    /* Video recording only on retry */
    video: 'on-first-retry',

    /* Timeout for each action */
    actionTimeout: 10000,

    /* Timeout for navigation */
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Firefox and WebKit can be added if needed for cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Global timeout for each test */
  timeout: 60000,

  /* Expect timeout */
  expect: {
    timeout: 10000,
  },

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
