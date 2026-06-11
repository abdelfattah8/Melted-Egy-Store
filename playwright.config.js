import { defineConfig } from '@playwright/test'

/**
 * E2E suite — runs against the LOCAL dev server but the REAL production Firebase
 * project (no emulator). Specs are numbered and run serially in one worker:
 * 01-auth creates the run's test account and saves creds to e2e/.run-state.json,
 * later specs log in with it. Order-placing specs only buy the unlimited-stock
 * product so no real stock is decremented.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
