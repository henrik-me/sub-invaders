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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Single source of truth for the E2E suite-level floors (CS18): read the numeric
// metric floors from coverage-thresholds.json [e2e].suite. The authoritative gate
// is the post-Playwright checker (scripts/coverage-suite.mjs, wired into
// `npm run test:e2e:coverage`); these values only drive monocart's own report
// coloring and the informational onEnd console summary below.
const suiteFloors = (() => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'coverage-thresholds.json'), 'utf8'));
  const out = {};
  for (const [k, v] of Object.entries(raw.e2e?.suite ?? {})) {
    if (typeof v === 'number') out[k] = v;
  }
  return out;
})();

const baseURL = process.env.BASE_URL ?? 'http://localhost:4173';
const useWebServer = process.env.USE_WEB_SERVER === undefined
  ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(baseURL)
  : process.env.USE_WEB_SERVER === '1';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: useWebServer
    ? {
      command: 'npm run build && npm run serve',
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
            // Include this repo's game sources AND the bundled canvas-game-engine
            // package (CS13): the engine ships inside the production bundle, so its
            // integration coverage legitimately counts toward the e2e aggregate.
            // The external engine is NOT per-file gated here — that is the upstream
            // repo's responsibility (coverage-perfile.mjs drops node_modules paths).
            return sourcePath.includes('/game/')
              || sourcePath.startsWith('game/')
              || sourcePath.includes('canvas-game-engine');
          },
          // Suite-level floors (single source of truth: coverage-thresholds.json
          // [e2e].suite; re-baselined in CS18). These drive monocart's report
          // status coloring only -- the ENFORCED gate is scripts/coverage-suite.mjs,
          // run after `playwright test` in `npm run test:e2e:coverage`. E2E
          // plateaus below the unit targets because the remaining gaps are
          // unit-covered defensive/modifier code; see OPERATIONS.md "Coverage
          // policy".
          thresholds: suiteFloors,
          // Informational console summary only. The ENFORCED suite-level gate is
          // scripts/coverage-suite.mjs (run after `playwright test` in
          // `npm run test:e2e:coverage`) -- Playwright derives its exit code from
          // test results, not a reporter-set process.exitCode, so this hook must
          // NOT be relied on to fail CI (CS18). Floors come from suiteFloors
          // (coverage-thresholds.json [e2e].suite).
          onEnd: async (coverageResults) => {
            const s = coverageResults.summary;
            const fails = [];
            for (const [k, floor] of Object.entries(suiteFloors)) {
              const pct = s[k]?.pct;
              if (typeof pct === 'number' && pct < floor) {
                fails.push(`${k}: ${pct.toFixed(2)}% < floor ${floor}%`);
              }
            }
            if (fails.length) {
              console.error('\n\u274c E2E suite coverage below floor (enforced by scripts/coverage-suite.mjs):');
              for (const f of fails) console.error('   - ' + f);
            } else {
              console.log('\n\u2705 E2E suite coverage meets floors.');
            }
          },
        },
      },
    ],
  ],
});
