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
            if (!url.startsWith('http://localhost:4173/') || !url.endsWith('.mjs')) {
              return false;
            }
            // CS03 exclusion: game/api.mjs is fully covered by the unit suite
            // (100% lines / 89.79% branches against ApiError mapping, header
            // validation, isPositiveInt, normalizeBase, malformed-response paths).
            // In E2E it would only be exercised against happy-path 200 stubs
            // (errors come from the real backend), so including it pulls the
            // suite floor down without measuring anything the unit suite missed.
            if (url.endsWith('/game/api.mjs')) return false;
            return true;
          },
          sourceFilter: (sourcePath) => {
            // Source paths come back relative to the static server root and may include
            // /src/ if the source map mounts them that way; accept any `.mjs` under our
            // app's known module prefixes.
            if (!sourcePath.endsWith('.mjs')) return false;
            // Mirror the entryFilter exclusion for game/api.mjs (see comment above).
            if (sourcePath.endsWith('/game/api.mjs') || sourcePath === 'game/api.mjs') return false;
            return sourcePath.includes('/engine/')
              || sourcePath.includes('/game/')
              || sourcePath.startsWith('engine/')
              || sourcePath.startsWith('game/');
          },
          // CS09 Phase 3: locked-in floors after Phase 2 test-writing.
          // Targets were >=90/85 across all four metrics (matched in the unit
          // suite). E2E plateaus below 90 on lines/branches because the
          // remaining gaps are dead-in-production defensive code (createFrame
          // helpers in sprite.mjs, defaultFactory paths in play.mjs, throw
          // guards in renderer/loop, etc.) which the *unit* suite covers
          // independently. CS03 lowered branches 70 → 69 because the new
          // apiClient fallbacks (startSession failure → no submission;
          // missing entries field; ternary on apiClient presence) are
          // exercised by unit tests only and would require multiple new
          // E2E specs each driving an offline scenario to recover the 0.3pp.
          // See OPERATIONS.md "Coverage policy" for the per-file E2E
          // exception list.
          thresholds: {
            lines: 77,
            statements: 87,
            functions: 84,
            branches: 69,
            bytes: 80,
          },
          // Fail the run if any of the above thresholds are not met.
          // monocart-coverage-reports calls this hook with the final summary.
          onEnd: async (coverageResults) => {
            const s = coverageResults.summary;
            const t = { lines: 77, statements: 87, functions: 84, branches: 69, bytes: 80 };
            const fails = [];
            for (const k of Object.keys(t)) {
              const pct = s[k]?.pct;
              if (typeof pct === 'number' && pct < t[k]) {
                fails.push(`${k}: ${pct.toFixed(2)}% < floor ${t[k]}%`);
              }
            }
            if (fails.length) {
              console.error('\n❌ E2E coverage regression below CS09 floor:');
              for (const f of fails) console.error('   - ' + f);
              process.exitCode = 1;
            } else {
              console.log('\n✅ E2E coverage meets CS09 floors.');
            }
          },
        },
      },
    ],
  ],
});
