import { defineConfig, devices } from '@playwright/test';

const browserProjects = (process.env.PLAYWRIGHT_BROWSERS ?? 'chromium')
  .split(',')
  .map((browser) => browser.trim())
  .filter(Boolean);

const deviceByProject = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
};

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: browserProjects.map((name) => ({
    name,
    use: deviceByProject[name] ?? devices['Desktop Chrome'],
  })),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['github']] : [['list']],
  workers: 1,
});