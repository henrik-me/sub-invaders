import { expect, test } from './_fixtures.mjs';

test('game loads, HUD state is initialised, and arrow keys move the player', async ({ gamePage }) => {
  const consoleErrors = [];
  gamePage.page.on('console', (entry) => {
    if (entry.type() === 'error') {
      consoleErrors.push(entry.text());
    }
  });

  await gamePage.goto({ seed: 1 });
  await gamePage.waitForReady();

  await expect(gamePage.page.locator('canvas')).toBeVisible();
  const state = await gamePage.state();
  expect(state.score).toBe(0);
  expect(state.lives).toBe(3);
  expect(state.wave).toBe(1);

  const before = await gamePage.player();
  await gamePage.pressKey('ArrowRight', 250);
  const afterRight = await gamePage.player();
  expect(afterRight.x).toBeGreaterThan(before.x);

  await gamePage.pressKey('ArrowLeft', 250);
  const afterLeft = await gamePage.player();
  expect(afterLeft.x).toBeLessThan(afterRight.x);
  expect(consoleErrors).toEqual([]);
});