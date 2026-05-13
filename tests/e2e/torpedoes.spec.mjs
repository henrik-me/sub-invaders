import { expect, test } from './_fixtures.mjs';

async function waitForNoTorpedoes(gamePage, timeoutMs = 2_000) {
  // The waitForReady fixture spams Space to skip the menu, which can leave a
  // torpedo in flight. Wait for it to clear before exercising fresh fires.
  await expect.poll(async () => (await gamePage.torpedoes()).length, { timeout: timeoutMs })
    .toBe(0);
}

test('firing Space spawns a torpedo and torpedoes() reflects it', async ({ gamePage }) => {
  await gamePage.goto({ seed: 91, formationSpeed: 0 });
  await gamePage.waitForReady();
  await waitForNoTorpedoes(gamePage);

  await gamePage.pressKey('Space', 60);

  // The torpedo briefly exists in flight (cooldown 350ms; speed sends it up).
  await expect.poll(async () => (await gamePage.torpedoes()).length, { timeout: 1_500 })
    .toBeGreaterThan(0);
});

test('the player cannot fire a second torpedo while one is in flight', async ({ gamePage }) => {
  await gamePage.goto({ seed: 92, formationSpeed: 0 });
  await gamePage.waitForReady();
  await waitForNoTorpedoes(gamePage);

  await gamePage.pressKey('Space', 60);
  await expect.poll(async () => (await gamePage.torpedoes()).length, { timeout: 1_500 })
    .toBeGreaterThan(0);

  const torpedoesBefore = await gamePage.torpedoes();
  await gamePage.pressKey('Space', 60);
  await gamePage.page.waitForTimeout(150);
  const torpedoesAfter = await gamePage.torpedoes();

  // No additional torpedo can have appeared while the first is still alive.
  expect(torpedoesAfter.length).toBeLessThanOrEqual(torpedoesBefore.length);
});

test('state.torpedoes count surfaces the in-flight torpedo through the test hook', async ({ gamePage }) => {
  await gamePage.goto({ seed: 93, formationSpeed: 0 });
  await gamePage.waitForReady();
  await waitForNoTorpedoes(gamePage);

  expect((await gamePage.state()).torpedoes).toBe(0);
  await gamePage.pressKey('Space', 60);
  await expect.poll(async () => (await gamePage.state()).torpedoes, { timeout: 1_500 })
    .toBeGreaterThan(0);
});
