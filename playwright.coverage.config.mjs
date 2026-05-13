// Coverage variant of playwright.config.mjs.
//
// Used by `npm run test:e2e:coverage`. Differences vs the base config:
//   - Forces the chromium project (V8 coverage is Chromium-only).
//   - Sets PLAYWRIGHT_COVERAGE=1 so the autoCoverage fixture in
//     tests/e2e/_fixtures.mjs starts/stops V8 coverage per test and forwards
//     entries via monocart-reporter's `addCoverageReport()`.
//   - Outputs an HTML report under coverage-report/ + a console summary.
//
// Wall-clock cost vs `npm run test:e2e`: ~3-8% added per test, plus ~5-10s
// reporter time at the end. Standard `test:e2e` runs are unaffected
// (PLAYWRIGHT_COVERAGE is unset; the autoCoverage fixture is a no-op).

process.env.PLAYWRIGHT_COVERAGE = '1';

import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseURL = process.env.BASE_URL ?? 'http://localhost:4173';
const useWebServer = process.env.USE_WEB_SERVER === undefined
  ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(baseURL)
  : process.env.USE_WEB_SERVER === '1';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: useWebServer
    ? {
      command: 'npm run serve',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    }
    : undefined,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: devices['Desktop Chrome'],
    },
  ],
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    [
      'monocart-reporter',
      {
        name: 'sub-invaders E2E coverage',
        outputFile: path.join(__dirname, 'coverage-report', 'index.html'),
        coverage: {
          name: 'sub-invaders E2E coverage',
          outputDir: path.join(__dirname, 'coverage-report'),
          reports: [
            ['v8'],
            ['v8-json'],
            ['console-summary'],
          ],
          entryFilter: (entry) => {
            const url = entry.url ?? '';
            // Static server (`http-server src`) serves /src/ as docroot, so app URLs
            // are http://localhost:4173/{engine,game,...}/<file>.mjs — no `/src/` in
            // the URL. Filter to local-host app modules only.
            return url.startsWith('http://localhost:4173/') && url.endsWith('.mjs');
          },
          sourceFilter: (sourcePath) => {
            // Source paths come back relative to the static server root and may include
            // /src/ if the source map mounts them that way; accept any `.mjs` under our
            // app's known module prefixes.
            return sourcePath.endsWith('.mjs')
              && (sourcePath.includes('/engine/')
                || sourcePath.includes('/game/')
                || sourcePath.startsWith('engine/')
                || sourcePath.startsWith('game/'));
          },
        },
      },
    ],
  ],
});
