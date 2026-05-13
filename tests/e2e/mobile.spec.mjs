import { devices } from '@playwright/test';
import { expect, test } from './_fixtures.mjs';

const iphone = { ...devices['iPhone 14'] };
delete iphone.defaultBrowserType;
test.use(iphone);

test('game loads on an iPhone viewport and the canvas scales down', async ({ gamePage }) => {
  await gamePage.goto({ seed: 3 });
  await gamePage.waitForReady();

  const canvas = gamePage.page.locator('canvas');
  const box = await canvas.boundingBox();
  const viewport = gamePage.page.viewportSize();

  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);
  expect(box.width).toBeLessThanOrEqual(viewport.width);

  await canvas.tap({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  expect((await gamePage.state()).scene).toBe('play');
});