import { expect, test } from './_fixtures.mjs';

test('Space on game-over restarts the play scene with a fresh score', async ({ gamePage }) => {
  await gamePage.goto({ seed: 41, formationSpeed: 0 });
  await gamePage.waitForReady();
  await gamePage.setHighScore(50);
  await gamePage.setLives(0);

  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('game-over');

  await gamePage.pressKey('Space', 80);
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('play');

  const state = await gamePage.state();
  expect(state.score).toBe(0);
  expect(state.high).toBe(50);
});

test('KeyM on game-over returns to the main menu', async ({ gamePage }) => {
  await gamePage.goto({ seed: 42, formationSpeed: 0 });
  await gamePage.waitForReady();
  await gamePage.setLives(0);

  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('game-over');

  await gamePage.pressKey('KeyM', 80);
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('menu');
});

test('Space on the menu starts a new play session', async ({ gamePage }) => {
  await gamePage.goto({ seed: 43, formationSpeed: 0 });
  await gamePage.waitForReady();
  await gamePage.setLives(0);

  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('game-over');
  await gamePage.pressKey('KeyM', 80);
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('menu');

  // Use the keyboard fallback used by waitForReady — fires a Space keypress.
  await gamePage.pressKey('Space', 80);
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('play');
});
