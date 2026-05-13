import { expect, test } from './_fixtures.mjs';

test('clearing the formation advances to wave 2 and respawns enemies', async ({ gamePage }) => {
  await gamePage.goto({ seed: 7, startWave: 1, formationSpeed: 0 });
  await gamePage.waitForReady();

  await gamePage.killAllInvaders();

  await expect.poll(async () => (await gamePage.state()).wave, { timeout: 2_000 }).toBe(2);
  await expect.poll(async () => {
    const formation = await gamePage.formation();
    return formation.filter((enemy) => enemy.alive).length;
  }, { timeout: 2_000 }).toBeGreaterThan(0);
});