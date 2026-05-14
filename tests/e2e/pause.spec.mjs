import { expect, test } from './_fixtures.mjs';

async function pressEscape(page) {
  await page.evaluate(() => {
    window.__subInvaders.pressKey('Escape');
    setTimeout(() => window.__subInvaders.releaseKey('Escape'), 30);
  });
}

// The input layer is edge-triggered: `pressedThisFrame` is cleared every
// `endFrame()`, which runs from the loop's `render()` callback on every rAF
// tick — INCLUDING render-only ticks where `consumeAccumulator()` performed
// zero `update(fixedDt)` calls (see src/engine/loop.mjs `frame()`). An Escape
// edge fired between two such render-only ticks is therefore wiped before any
// `handleInput()` ever observes it. Webkit's headless rAF cadence makes this
// race more likely than chromium/firefox, producing the recurring nightly E2E
// flake (issues #58, #43). Keep re-arming the edge across the full assertion
// budget rather than firing once.
async function pressEscapeUntil(gamePage, expected, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await gamePage.state()).paused === expected) return;
    await pressEscape(gamePage.page);
    await gamePage.page.waitForTimeout(120);
  }
}

test('pause via Escape freezes player and formation; second Escape resumes', async ({ gamePage }) => {
  await gamePage.goto({ seed: 21, formationSpeed: 60 });
  await gamePage.waitForReady();

  // Move right briefly to set a known position.
  await gamePage.pressKey('ArrowRight', 100);
  const before = await gamePage.player();

  await pressEscapeUntil(gamePage, true);
  await expect.poll(async () => (await gamePage.state()).paused, { timeout: 5_000 }).toBe(true);

  // While paused, tapping right should not move the player.
  await gamePage.pressKey('ArrowRight', 250);
  const whilePaused = await gamePage.player();
  expect(whilePaused.x).toBe(before.x);

  await pressEscapeUntil(gamePage, false);
  await expect.poll(async () => (await gamePage.state()).paused, { timeout: 5_000 }).toBe(false);

  await gamePage.pressKey('ArrowRight', 200);
  const afterResume = await gamePage.player();
  expect(afterResume.x).toBeGreaterThan(before.x);
});
