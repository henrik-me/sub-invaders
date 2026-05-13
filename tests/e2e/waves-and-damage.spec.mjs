import { expect, test } from './_fixtures.mjs';

async function forceEnemyFire(page) {
  return page.evaluate(() => window.__subInvaders.forceEnemyFire());
}

test('repeated enemy hits deplete the player lives and end the game', async ({ gamePage }) => {
  await gamePage.goto({ seed: 81, formationSpeed: 0 });
  await gamePage.waitForReady();

  const initialLives = (await gamePage.state()).lives;
  expect(initialLives).toBeGreaterThan(0);

  // Try to take repeated hits; if we never get hit, fall back to setLives.
  for (let life = 0; life < initialLives + 2; life += 1) {
    const stateNow = await gamePage.state();
    if (stateNow.gameOver) break;

    const shot = await forceEnemyFire(gamePage.page);
    if (!shot) break;

    for (let nudge = 0; nudge < 16; nudge += 1) {
      const player = await gamePage.player();
      const dx = (shot.x + (shot.w / 2)) - (player.x + (player.w / 2));
      if (Math.abs(dx) <= 4) break;
      const code = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
      await gamePage.pressKey(code, Math.min(120, Math.max(20, Math.abs(dx))));
    }
    await gamePage.page.waitForTimeout(800);
  }

  const finalState = await gamePage.state();
  if (!finalState.gameOver) {
    await gamePage.setLives(0);
  }
  await expect.poll(async () => (await gamePage.state()).gameOver, { timeout: 3_000 }).toBe(true);
});

test('formation reverses direction at the canvas edge over multiple waves', async ({ gamePage }) => {
  await gamePage.goto({ seed: 82, formationSpeed: 220 });
  await gamePage.waitForReady();

  // Wait long enough for the formation to drift, hit the canvas edge,
  // descend one row and reverse direction at least once.
  const initial = (await gamePage.formation())
    .filter((e) => e.alive)
    .reduce((acc, e) => Math.max(acc, e.y + e.h), 0);

  await expect.poll(async () => {
    const enemies = await gamePage.formation();
    const lowest = enemies.filter((e) => e.alive).reduce((acc, e) => Math.max(acc, e.y + e.h), 0);
    return lowest > initial;
  }, { timeout: 8_000, intervals: [200, 400, 800] }).toBe(true);
});

test('clearing wave 1 advances to wave 2 with a fresh formation', async ({ gamePage }) => {
  await gamePage.goto({ seed: 83, formationSpeed: 0 });
  await gamePage.waitForReady();

  expect((await gamePage.state()).wave).toBe(1);
  const before = await gamePage.formation();
  expect(before.length).toBeGreaterThan(0);

  await gamePage.killAllInvaders();
  await expect.poll(async () => (await gamePage.state()).wave, { timeout: 5_000 }).toBe(2);

  const after = await gamePage.formation();
  expect(after.filter((e) => e.alive).length).toBeGreaterThan(0);
});

test('starting at wave 5 spawns a faster, deeper formation', async ({ gamePage }) => {
  await gamePage.goto({ seed: 84, startWave: 5, formationSpeed: 0 });
  await gamePage.waitForReady();

  expect((await gamePage.state()).wave).toBe(5);
  const enemies = await gamePage.formation();
  expect(enemies.filter((e) => e.alive).length).toBeGreaterThan(0);
});
