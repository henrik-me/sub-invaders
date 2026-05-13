import { expect, test } from './_fixtures.mjs';

test('high score written through the test hook survives reload', async ({ gamePage }) => {
  await gamePage.goto({ seed: 5 });
  await gamePage.waitForReady();
  await gamePage.setHighScore(777);

  await gamePage.page.reload();
  await gamePage.waitForReady();

  expect((await gamePage.state()).high).toBe(777);
});