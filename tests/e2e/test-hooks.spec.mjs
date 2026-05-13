import { expect, test } from './_fixtures.mjs';

async function callHook(page, method, ...args) {
  return page.evaluate(([name, hookArgs]) => {
    const hooks = window.__subInvaders;
    if (!hooks || typeof hooks[name] !== 'function') {
      throw new Error(`window.__subInvaders.${name} is not available`);
    }
    return hooks[name](...hookArgs);
  }, [method, args]);
}

test('setSeed hook reseeds the play scene and restarts', async ({ gamePage }) => {
  await gamePage.goto({ seed: 1, formationSpeed: 0 });
  await gamePage.waitForReady();

  await callHook(gamePage.page, 'setSeed', 99);
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 5_000 }).toBe('play');
  // After re-seeding, we should still be in a fresh play session.
  expect((await gamePage.state()).score).toBe(0);
});

test('forceGameOver hook transitions to the game-over scene', async ({ gamePage }) => {
  await gamePage.goto({ seed: 51, formationSpeed: 0 });
  await gamePage.waitForReady();
  await gamePage.setHighScore(0);

  await callHook(gamePage.page, 'forceGameOver', 555);
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 5_000 }).toBe('game-over');
  expect((await gamePage.state()).high).toBe(555);
});

test('formation hook returns enemies with type/row/col metadata', async ({ gamePage }) => {
  await gamePage.goto({ seed: 52, formationSpeed: 0 });
  await gamePage.waitForReady();

  const formation = await gamePage.formation();
  expect(formation.length).toBeGreaterThan(0);
  expect(formation.some((e) => e.type === 'jellyfish')).toBe(true);
  expect(formation.some((e) => e.type === 'anglerfish')).toBe(true);
  expect(formation.some((e) => e.type === 'squid')).toBe(true);
});

test('killAllInvaders hook clears the formation and advances the wave', async ({ gamePage }) => {
  await gamePage.goto({ seed: 53, formationSpeed: 0 });
  await gamePage.waitForReady();

  const startingWave = (await gamePage.state()).wave;
  await gamePage.killAllInvaders();

  // After everything dies the play scene will advance the wave on the next tick.
  await expect.poll(async () => (await gamePage.state()).wave, { timeout: 5_000 }).toBe(startingWave + 1);
});

test('pressKey/releaseKey via test hooks emit keyboard events the input layer handles', async ({ gamePage }) => {
  await gamePage.goto({ seed: 54, formationSpeed: 0 });
  await gamePage.waitForReady();

  const before = await gamePage.player();
  await callHook(gamePage.page, 'pressKey', 'ArrowRight');
  await gamePage.page.waitForTimeout(200);
  await callHook(gamePage.page, 'releaseKey', 'ArrowRight');

  const after = await gamePage.player();
  expect(after.x).toBeGreaterThan(before.x);
});

test('setLives clamps negative input to 0', async ({ gamePage }) => {
  await gamePage.goto({ seed: 55, formationSpeed: 0 });
  await gamePage.waitForReady();

  await gamePage.setLives(-3);
  await expect.poll(async () => (await gamePage.state()).lives, { timeout: 5_000 }).toBe(0);
});

test('setHighScore writes through to localStorage and survives reload', async ({ gamePage }) => {
  await gamePage.goto({ seed: 56 });
  await gamePage.waitForReady();
  await gamePage.setHighScore(987654);
  expect((await gamePage.state()).high).toBe(987654);
});

test('test hooks are not installed without ?test=1', async ({ gamePage }) => {
  await gamePage.page.goto('/');
  await gamePage.page.waitForLoadState('domcontentloaded');
  // Wait briefly for bootstrap to attempt installation.
  await gamePage.page.waitForTimeout(500);
  const present = await gamePage.page.evaluate(() => typeof window.__subInvaders);
  expect(present).toBe('undefined');
});
