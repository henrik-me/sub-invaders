import { expect, test as base } from '@playwright/test';

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
  gamePage: async ({ page }, use) => {
    const gamePage = {
      page,

      async goto({ seed, startWave, formationSpeed, test = 1 } = {}) {
        const params = new URLSearchParams();

        if (test !== undefined) {
          params.set('test', String(test));
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