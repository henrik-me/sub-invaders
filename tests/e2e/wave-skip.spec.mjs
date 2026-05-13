import { test, expect } from './_fixtures.mjs';

test('?startWave=3 starts the play scene at wave 3', async ({ gamePage }) => {
  await gamePage.goto({ startWave: 3, seed: 7, formationSpeed: 0 });
  await gamePage.waitForReady();

  const state = await gamePage.state();
  expect(state.scene).toBe('play');
  expect(state.ready).toBe(true);
  expect(state.wave).toBe(3);
});

test('?startWave=5 starts the play scene at wave 5 with a fresh formation', async ({ gamePage }) => {
  await gamePage.goto({ startWave: 5, seed: 7, formationSpeed: 0 });
  await gamePage.waitForReady();

  const state = await gamePage.state();
  expect(state.wave).toBe(5);

  const formation = await gamePage.formation();
  const alive = formation.filter((enemy) => enemy.alive).length;
  expect(alive).toBeGreaterThan(0);
});