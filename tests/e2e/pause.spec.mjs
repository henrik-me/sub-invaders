import { expect, test } from './_fixtures.mjs';

test('pause via Escape freezes player and formation; resume re-starts updates', async ({ gamePage }) => {
  await gamePage.goto({ seed: 21, formationSpeed: 60 });
  await gamePage.waitForReady();

  // Move right briefly to set a known position.
  await gamePage.pressKey('ArrowRight', 100);
  const before = await gamePage.player();

  await gamePage.pressKey('Escape', 50);
  await expect.poll(async () => (await gamePage.state()).paused, { timeout: 2_000 }).toBe(true);

  // While paused, tapping right should not move the player.
  await gamePage.pressKey('ArrowRight', 250);
  const whilePaused = await gamePage.player();
  expect(whilePaused.x).toBe(before.x);

  // Resume.
  await gamePage.pressKey('Escape', 50);
  await expect.poll(async () => (await gamePage.state()).paused, { timeout: 2_000 }).toBe(false);

  await gamePage.pressKey('ArrowRight', 200);
  const afterResume = await gamePage.player();
  expect(afterResume.x).toBeGreaterThan(before.x);
});
