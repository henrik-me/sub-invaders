import { expect, test } from './_fixtures.mjs';

async function pressEscape(page) {
  await page.evaluate(() => {
    window.__subInvaders.pressKey('Escape');
    setTimeout(() => window.__subInvaders.releaseKey('Escape'), 30);
  });
}

test('pause via Escape freezes player and formation; second Escape resumes', async ({ gamePage }) => {
  await gamePage.goto({ seed: 21, formationSpeed: 60 });
  await gamePage.waitForReady();

  // Move right briefly to set a known position.
  await gamePage.pressKey('ArrowRight', 100);
  const before = await gamePage.player();

  // Send a few escape edges to be tolerant of frame timing.
  // The input layer's pressedThisFrame is cleared each endFrame(), so a single
  // edge fired between handleInput() and endFrame() of the same frame can be
  // dropped before the next handleInput() observes it. Webkit's headless
  // scheduling makes this race more likely than chromium/firefox.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if ((await gamePage.state()).paused) break;
    await pressEscape(gamePage.page);
    await gamePage.page.waitForTimeout(120);
  }
  await expect.poll(async () => (await gamePage.state()).paused, { timeout: 5_000 }).toBe(true);

  // While paused, tapping right should not move the player.
  await gamePage.pressKey('ArrowRight', 250);
  const whilePaused = await gamePage.player();
  expect(whilePaused.x).toBe(before.x);

  // Resume. Send a few escape edges to be tolerant of frame timing.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!(await gamePage.state()).paused) break;
    await pressEscape(gamePage.page);
    await gamePage.page.waitForTimeout(120);
  }
  await expect.poll(async () => (await gamePage.state()).paused, { timeout: 5_000 }).toBe(false);

  await gamePage.pressKey('ArrowRight', 200);
  const afterResume = await gamePage.player();
  expect(afterResume.x).toBeGreaterThan(before.x);
});
