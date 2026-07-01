import { expect, test as base } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';

const COVERAGE_ENABLED = process.env.PLAYWRIGHT_COVERAGE === '1';

const DEFAULT_SESSION_BODY = {
  sessionId: 'fixture-default-session',
  nonce: 'fixturenonce',
  startedAt: '2026-05-13T00:00:00.000Z',
};
const DEFAULT_SCORE_BODY = {
  status: 'accepted',
  score: 0,
  submissionId: 'fixture-default-submission',
};
const DEFAULT_LEADERBOARD_BODY = { period: 'all', entries: [] };
const DEFAULT_HEALTH_BODY = { status: 'ok', version: '0.0.0', commit: 'fixture', flags: { dailyChallenge: 'off' } };

async function installDefaultApiStubs(page) {
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_HEALTH_BODY),
    });
  });

  await page.route('**/api/session', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_SESSION_BODY),
    });
  });

  await page.route('**/api/score', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_SCORE_BODY),
    });
  });

  await page.route('**/api/leaderboard*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_LEADERBOARD_BODY),
    });
  });
}

async function requireHook(page) {
  return page.waitForFunction(() => Boolean(window.__subInvaders), undefined, { timeout: 5_000 });
}

async function callHook(page, method, ...args) {
  return page.evaluate(([name, hookArgs]) => {
    const hooks = window.__subInvaders;

    if (!hooks || typeof hooks[name] !== 'function') {
      throw new Error(`window.__subInvaders.${name} is not available`);
    }

    return hooks[name](...hookArgs);
  }, [method, args]);
}

export const test = base.extend({
  // Default `/api/**` stubs so the dev server (which returns 405 for POST) doesn't
  // produce spurious console errors when play.mjs fires fire-and-forget startSession/
  // submitScore. Specific tests register their own page.route('**/api/...') later,
  // and Playwright uses the most recently registered handler for matching requests
  // so this baseline does not interfere with leaderboard.spec.mjs overrides.
  defaultApiStubs: [
    async ({ page }, use) => {
      await installDefaultApiStubs(page);
      await use();
    },
    { auto: true },
  ],

  // Automatic V8 coverage capture, opt-in via PLAYWRIGHT_COVERAGE=1.
  // Zero overhead when disabled. Chromium-only (V8 coverage API).
  // Set up before `gamePage` so coverage starts before the first navigation.
  autoCoverage: [
    async ({ page, browserName }, use) => {
      const enabled = COVERAGE_ENABLED && browserName === 'chromium';
      if (enabled) {
        await page.coverage.startJSCoverage({ resetOnNavigation: false });
      }
      await use();
      if (enabled) {
        const entries = await page.coverage.stopJSCoverage();
        // Filter to our app sources only (drop chrome-extension://, data:, vendor noise).
        // Static server (`http-server src`) serves /src/ as docroot, so app URLs are
        // http://localhost:4173/{engine,game,...}/<file>.mjs — no `/src/` in the URL.
        const ours = entries.filter((e) => {
          const u = e.url ?? '';
          return u.startsWith('http://localhost:4173/') && u.endsWith('.mjs');
        });
        await addCoverageReport(ours, test.info());
      }
    },
    { auto: true },
  ],

  gamePage: async ({ page }, use) => {
    const gamePage = {
      page,

      async goto({ seed, startWave, formationSpeed, fireIntervalMs, mode, test = 1 } = {}) {
        const params = new URLSearchParams();

        if (test !== undefined) {
          params.set('test', String(test));
        }
        if (mode !== undefined) {
          params.set('mode', String(mode));
        }
        if (seed !== undefined) {
          params.set('seed', String(seed));
        }
        if (startWave !== undefined) {
          params.set('startWave', String(startWave));
        }
        if (formationSpeed !== undefined) {
          params.set('formationSpeed', String(formationSpeed));
        }
        if (fireIntervalMs !== undefined) {
          params.set('fireIntervalMs', String(fireIntervalMs));
        }

        const suffix = params.toString() ? `?${params}` : '';
        await page.goto(`/${suffix}`);
        await requireHook(page);
      },

      async waitForReady() {
        await requireHook(page);
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();
        await canvas.focus();

        for (let attempt = 0; attempt < 5; attempt += 1) {
          const state = await this.state();
          if (state.scene === 'play' && state.ready === true) {
            return;
          }

          await page.keyboard.press('Space');
          await callHook(page, 'pressKey', 'Space');
          await page.waitForTimeout(50);
          await callHook(page, 'releaseKey', 'Space');
          await page.waitForTimeout(100);
        }

        await page.waitForFunction(() => {
          const stateNow = window.__subInvaders?.state?.();
          return stateNow?.scene === 'play' && stateNow.ready === true;
        }, undefined, { timeout: 5_000 });
      },

      state() {
        return callHook(page, 'state');
      },

      formation() {
        return callHook(page, 'formation');
      },

      enemyShots() {
        return callHook(page, 'enemyShots');
      },

      torpedoes() {
        return callHook(page, 'torpedoes');
      },

      player() {
        return callHook(page, 'player');
      },

      async pressKey(code, ms = 50) {
        await page.keyboard.down(code);
        await page.waitForTimeout(ms);
        await page.keyboard.up(code);
      },

      killAllInvaders() {
        return callHook(page, 'killAllInvaders');
      },

      setLives(lives) {
        return callHook(page, 'setLives', lives);
      },

      setHighScore(score) {
        return callHook(page, 'setHighScore', score);
      },
    };

    await use(gamePage);
  },
});

export { expect };