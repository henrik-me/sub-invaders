import { devices } from '@playwright/test';
import { expect, test } from './_fixtures.mjs';

const iphone = { ...devices['iPhone 14'] };
delete iphone.defaultBrowserType;

test.use(iphone);

test.skip(
  ({ browserName }) => browserName === 'firefox',
  'Firefox in Playwright does not support options.isMobile (mobile emulation).',
);

async function dispatchTouch(page, type, touches) {
  await page.evaluate(({ type, touches }) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'changedTouches', { value: touches, writable: false });
    Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : touches, writable: false });
    Object.defineProperty(event, 'targetTouches', { value: type === 'touchend' ? [] : touches, writable: false });
    window.dispatchEvent(event);
  }, { type, touches });
}

test('synthesised touchstart/touchmove/touchend run through the input handlers without throwing', async ({ gamePage }) => {
  await gamePage.goto({ seed: 81, formationSpeed: 0 });
  await gamePage.waitForReady();

  // Issue a full touch gesture against the window (where input attaches).
  // input.touchDx() is not consumed by the production play scene, so we cannot
  // observe player motion from it; the goal is to exercise the touch branches
  // (onTouchStart/onTouchMove/onTouchEnd) in engine/input.mjs.
  await dispatchTouch(gamePage.page, 'touchstart', [{ identifier: 7, clientX: 100, clientY: 200 }]);
  await dispatchTouch(gamePage.page, 'touchmove', [{ identifier: 7, clientX: 140, clientY: 200 }]);
  await dispatchTouch(gamePage.page, 'touchmove', [{ identifier: 7, clientX: 175, clientY: 200 }]);
  await dispatchTouch(gamePage.page, 'touchend', [{ identifier: 7, clientX: 175, clientY: 200 }]);

  // touchmove with a different identifier (not the active one) is ignored.
  await dispatchTouch(gamePage.page, 'touchstart', [{ identifier: 9, clientX: 50, clientY: 60 }]);
  await dispatchTouch(gamePage.page, 'touchmove', [{ identifier: 1234, clientX: 70, clientY: 60 }]);
  await dispatchTouch(gamePage.page, 'touchend', [{ identifier: 9, clientX: 80, clientY: 60 }]);

  // touchend with no active identifier is a no-op (covers the early-return guard).
  await dispatchTouch(gamePage.page, 'touchend', [{ identifier: 9, clientX: 80, clientY: 60 }]);

  // Empty touchstart (no touches) is a no-op.
  await dispatchTouch(gamePage.page, 'touchstart', []);

  // The game loop must still be running and responsive.
  expect((await gamePage.state()).scene).toBe('play');
});
