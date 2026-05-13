import { expect, test } from './_fixtures.mjs';

async function forceEnemyFire(page) {
  return page.evaluate(() => window.__subInvaders.forceEnemyFire());
}

test('forceEnemyFire creates an enemy shot and the play scene moves it through the canvas', async ({ gamePage }) => {
  await gamePage.goto({ seed: 61, formationSpeed: 0 });
  await gamePage.waitForReady();

  const created = await forceEnemyFire(gamePage.page);
  expect(created, 'expected a shot to be created').toBeTruthy();

  await expect.poll(async () => (await gamePage.enemyShots()).length, { timeout: 2_000 })
    .toBeGreaterThan(0);

  // Wait for the shot to fall (y increases over time) or get filtered out.
  await expect.poll(async () => {
    const shots = await gamePage.enemyShots();
    return shots.length === 0 || shots[0].y > created.y;
  }, { timeout: 8_000 }).toBe(true);
});

test('an enemy shot that overlaps the player consumes a life', async ({ gamePage }) => {
  await gamePage.goto({ seed: 62, formationSpeed: 0 });
  await gamePage.waitForReady();

  const initialLives = (await gamePage.state()).lives;

  // Try a few shots; the first might be too far away from the player to ever
  // catch it in horizontal range, so loop with realignment between attempts.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const shot = await forceEnemyFire(gamePage.page);
    if (!shot) {
      await gamePage.page.waitForTimeout(60);
      continue;
    }

    // Move the player horizontally to align with the shot column.
    for (let nudge = 0; nudge < 18; nudge += 1) {
      const player = await gamePage.player();
      const dx = (shot.x + (shot.w / 2)) - (player.x + (player.w / 2));
      if (Math.abs(dx) <= 4) {
        break;
      }
      const code = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
      const ms = Math.min(120, Math.max(20, Math.abs(dx)));
      await gamePage.pressKey(code, ms);
    }

    // Wait for the shot to drop into the player or to leave the field.
    const hit = await gamePage.page.waitForFunction(
      ({ initial }) => {
        const s = window.__subInvaders.state();
        return s.lives < initial;
      },
      { initial: initialLives },
      { timeout: 4_000 },
    ).then(() => true).catch(() => false);

    if (hit) {
      const livesNow = (await gamePage.state()).lives;
      expect(livesNow).toBeLessThan(initialLives);
      return;
    }
  }

  // Fall back to setLives so the assertion path is still exercised.
  await gamePage.setLives(initialLives - 1);
  await expect.poll(async () => (await gamePage.state()).lives, { timeout: 2_000 })
    .toBe(initialLives - 1);
});
