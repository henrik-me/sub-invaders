import { expect, test } from './_fixtures.mjs';

async function pressViaHook(page, code) {
  await page.evaluate((c) => {
    window.__subInvaders.pressKey(c);
    setTimeout(() => window.__subInvaders.releaseKey(c), 50);
  }, code);
}

test('Space on game-over restarts the play scene with a fresh score', async ({ gamePage }) => {
  await gamePage.goto({ seed: 41, formationSpeed: 0 });
  await gamePage.waitForReady();
  await gamePage.setHighScore(50);
  await gamePage.setLives(0);

  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('game-over');

  await pressViaHook(gamePage.page, 'Space');
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

  await pressViaHook(gamePage.page, 'KeyM');
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('menu');
});

test('Space on the menu starts a new play session', async ({ gamePage }) => {
  await gamePage.goto({ seed: 43, formationSpeed: 0 });
  await gamePage.waitForReady();
  await gamePage.setLives(0);

  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('game-over');
  await pressViaHook(gamePage.page, 'KeyM');
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('menu');

  // Edge-triggered input may race with the scene-just-replaced frame; nudge a
  // few times to be tolerant of that timing.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await gamePage.state()).scene === 'play') break;
    await pressViaHook(gamePage.page, 'Space');
    await gamePage.page.waitForTimeout(120);
  }
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('play');
});
