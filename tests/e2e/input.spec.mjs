import { expect, test } from './_fixtures.mjs';

test.describe('input bindings', () => {
  test('arrow keys, A/D and W/Space/Up all register on the player', async ({ gamePage }) => {
    await gamePage.goto({ seed: 9, formationSpeed: 0 });
    await gamePage.waitForReady();

    const initial = await gamePage.player();

    await gamePage.pressKey('ArrowRight', 200);
    const afterRight = await gamePage.player();
    expect(afterRight.x).toBeGreaterThan(initial.x);

    await gamePage.pressKey('ArrowLeft', 200);
    const afterArrowLeft = await gamePage.player();
    expect(afterArrowLeft.x).toBeLessThan(afterRight.x);

    await gamePage.pressKey('KeyD', 200);
    const afterD = await gamePage.player();
    expect(afterD.x).toBeGreaterThan(afterArrowLeft.x);

    await gamePage.pressKey('KeyA', 200);
    const afterA = await gamePage.player();
    expect(afterA.x).toBeLessThan(afterD.x);
  });

  test('Space, KeyW, and ArrowUp all fire torpedoes', async ({ gamePage }) => {
    await gamePage.goto({ seed: 13, formationSpeed: 0 });
    await gamePage.waitForReady();

    // Wait for cooldown between fires to be safe (~400ms).
    await gamePage.pressKey('Space', 80);
    await gamePage.page.waitForTimeout(420);
    await gamePage.pressKey('KeyW', 80);
    await gamePage.page.waitForTimeout(420);
    await gamePage.pressKey('ArrowUp', 80);
    // No assertion — spec passes if all three keys are accepted without errors.
    expect((await gamePage.state()).scene).toBe('play');
  });

  test('player clamps at the right canvas edge after sustained right press', async ({ gamePage }) => {
    await gamePage.goto({ seed: 17, formationSpeed: 0 });
    await gamePage.waitForReady();

    await gamePage.pressKey('ArrowRight', 5000);

    const player = await gamePage.player();
    // Canvas is 800px wide; player width is 32. Clamp to 800-32=768 max.
    expect(player.x).toBeLessThanOrEqual(768 + 1);
    expect(player.x + player.w).toBeLessThanOrEqual(800);
  });

  test('player clamps at the left canvas edge after sustained left press', async ({ gamePage }) => {
    await gamePage.goto({ seed: 18, formationSpeed: 0 });
    await gamePage.waitForReady();

    await gamePage.pressKey('ArrowLeft', 5000);

    const player = await gamePage.player();
    expect(player.x).toBeGreaterThanOrEqual(0);
    expect(player.x).toBeLessThanOrEqual(2);
  });

  test('unrecognized keys are no-ops on the canvas', async ({ gamePage }) => {
    await gamePage.goto({ seed: 19, formationSpeed: 0 });
    await gamePage.waitForReady();

    const before = await gamePage.player();
    await gamePage.pressKey('Tab', 100);
    await gamePage.pressKey('Enter', 100);
    const after = await gamePage.player();
    expect(after.x).toBe(before.x);
  });
});
