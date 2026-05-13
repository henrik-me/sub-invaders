import { expect, test } from './_fixtures.mjs';

async function movePlayerCenterTo(gamePage, targetCenterX) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const player = await gamePage.player();
    const playerCenterX = player.x + (player.w / 2);
    const dx = targetCenterX - playerCenterX;

    if (Math.abs(dx) <= 3) {
      return;
    }

    const code = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    const durationMs = Math.min(350, Math.max(35, Math.ceil((Math.abs(dx) / 240) * 1000)));
    await gamePage.pressKey(code, durationMs);
  }
}

test('torpedo kills a real formation invader and scores points', async ({ gamePage }) => {
  await gamePage.goto({ seed: 42, formationSpeed: 0 });
  await gamePage.waitForReady();

  const formation = await gamePage.formation();
  const target = formation
    .filter((enemy) => enemy.alive)
    .sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];
  expect(target).toBeTruthy();

  await movePlayerCenterTo(gamePage, target.x + (target.w / 2));
  await gamePage.pressKey('Space', 80);

  await expect.poll(async () => (await gamePage.state()).score, { timeout: 2_000 }).toBeGreaterThan(0);
  await expect.poll(async () => {
    const enemies = await gamePage.formation();
    return enemies.find((enemy) => enemy.index === target.index)?.alive;
  }, { timeout: 2_000 }).toBe(false);
});