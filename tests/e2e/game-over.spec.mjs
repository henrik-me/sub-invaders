import { expect, test } from './_fixtures.mjs';

test('draining lives shows game over and reload preserves high score', async ({ gamePage }) => {
  await gamePage.goto({ seed: 11, formationSpeed: 0 });
  await gamePage.waitForReady();
  await gamePage.setHighScore(321);
  await gamePage.setLives(0);

  await expect.poll(async () => (await gamePage.state()).gameOver, { timeout: 2_000 }).toBe(true);
  expect((await gamePage.state()).scene).toBe('game-over');

  await gamePage.page.reload();
  await gamePage.waitForReady();

  expect((await gamePage.state()).high).toBe(321);
});