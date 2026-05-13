import { expect, test } from './_fixtures.mjs';

async function loopState(page) {
  return page.evaluate(() => window.__subInvaders.loopState());
}

test('loopState reports the loop is running after bootstrap', async ({ gamePage }) => {
  await gamePage.goto({ seed: 71, formationSpeed: 0 });
  await gamePage.waitForReady();

  const state = await loopState(gamePage.page);
  expect(state.running).toBe(true);
  expect(state.paused).toBe(false);
});

test('pauseLoop/resumeLoop toggle the engine loop pause flag', async ({ gamePage }) => {
  await gamePage.goto({ seed: 72, formationSpeed: 0 });
  await gamePage.waitForReady();

  await gamePage.page.evaluate(() => window.__subInvaders.pauseLoop());
  await expect.poll(async () => (await loopState(gamePage.page)).paused, { timeout: 2_000 }).toBe(true);

  await gamePage.page.evaluate(() => window.__subInvaders.resumeLoop());
  await expect.poll(async () => (await loopState(gamePage.page)).paused, { timeout: 2_000 }).toBe(false);
});

test('stopLoop halts the loop and startLoop resumes it', async ({ gamePage }) => {
  await gamePage.goto({ seed: 73, formationSpeed: 0 });
  await gamePage.waitForReady();

  await gamePage.page.evaluate(() => window.__subInvaders.stopLoop());
  await expect.poll(async () => (await loopState(gamePage.page)).running, { timeout: 2_000 }).toBe(false);

  await gamePage.page.evaluate(() => window.__subInvaders.startLoop());
  await expect.poll(async () => (await loopState(gamePage.page)).running, { timeout: 2_000 }).toBe(true);
});
