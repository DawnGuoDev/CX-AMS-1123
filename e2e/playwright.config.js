import { defineConfig, devices } from '@playwright/test'

/**
 * Frontend E2E for AMS.
 *
 * - A Vite preview server serves the production build of `frontend/dist` on a fixed test port.
 * - `/api/**` and `/health` are proxied to the backend started by `scripts/run-frontend-e2e.sh`
 *   (same origin as a deployment behind a reverse proxy).
 * - `reuseExistingServer` keeps local iterations fast; CI always starts fresh servers.
 */
export default defineConfig({
  testDir: './frontend',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.AMS_E2E_BASE_URL || 'http://127.0.0.1:4173',
    locale: 'zh-CN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.AMS_E2E_BASE_URL
    ? undefined
    : {
        command: 'node serve.mjs',
        url: 'http://127.0.0.1:4173/health',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
})
