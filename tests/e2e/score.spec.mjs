import { expect, test } from './_fixtures.mjs';

async function movePlayerCenterTo(gamePage, targetCenterX) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const player = await gamePage.player();
    const playerCenterX = player.x + (player.w / 2);
    const dx = targetCenterX - playerCenterX;

    if (Math.abs(dx) <= 3) {
      return;
    }

    const code = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    const durationMs = Math.min(350, Math.max(35, Math.ceil((Math.abs(dx) / 240) * 1000)));
    await gamePage.pressKey(code, durationMs);
  }
}

async function killByType(gamePage, type, expectedPoints) {
  const formation = await gamePage.formation();
  const target = formation
    .filter((enemy) => enemy.alive && enemy.type === type)
    .sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];
  expect(target, `expected at least one alive ${type}`).toBeTruthy();

  const before = (await gamePage.state()).score;

  await movePlayerCenterTo(gamePage, target.x + (target.w / 2));
  await gamePage.pressKey('Space', 80);

  await expect.poll(async () => {
    const enemies = await gamePage.formation();
    return enemies.find((enemy) => enemy.index === target.index)?.alive;
  }, { timeout: 3_000 }).toBe(false);

  const after = (await gamePage.state()).score;
  expect(after - before).toBe(expectedPoints);
}

test('killing a jellyfish (row 3-4) awards 10 points', async ({ gamePage }) => {
  await gamePage.goto({ seed: 31, formationSpeed: 0 });
  await gamePage.waitForReady();

  await killByType(gamePage, 'jellyfish', 10);
});

test('killing an anglerfish (row 1-2) awards 20 points', async ({ gamePage }) => {
  await gamePage.goto({ seed: 32, formationSpeed: 0 });
  await gamePage.waitForReady();

  // Kill all jellyfish in front first by clearing rows 3-4 (the closest rows).
  // The simplest path: kill the lowest enemy in the column repeatedly, then the
  // next-lowest will be exposed. We do that by repeatedly firing on whichever
  // alive enemy is the nearest.
  for (let attempts = 0; attempts < 30; attempts += 1) {
    const enemies = await gamePage.formation();
    const angler = enemies.find((e) => e.alive && e.type === 'anglerfish');
    if (!angler) {
      break;
    }
    // If there's a jellyfish below in the same column, kill it first.
    const blocker = enemies
      .filter((e) => e.alive && e.col === angler.col && (e.y + e.h) > (angler.y + angler.h))
      .sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];

    const target = blocker ?? angler;
    const before = (await gamePage.state()).score;
    await movePlayerCenterTo(gamePage, target.x + (target.w / 2));
    await gamePage.pressKey('Space', 80);

    await expect.poll(async () => {
      const e = await gamePage.formation();
      return e.find((x) => x.index === target.index)?.alive;
    }, { timeout: 3_000 }).toBe(false);

    const after = (await gamePage.state()).score;
    if (target.type === 'anglerfish') {
      expect(after - before).toBe(20);
      return;
    }
    // Cooldown to avoid back-to-back fire suppression.
    await gamePage.page.waitForTimeout(80);
  }
});

test('killing a squid (row 0) awards 40 points', async ({ gamePage }) => {
  await gamePage.goto({ seed: 33, formationSpeed: 0 });
  await gamePage.waitForReady();

  // Squid is row 0 (top). Clear its column from the bottom up.
  for (let attempts = 0; attempts < 60; attempts += 1) {
    const enemies = await gamePage.formation();
    const squid = enemies.find((e) => e.alive && e.type === 'squid');
    if (!squid) {
      break;
    }
    const blocker = enemies
      .filter((e) => e.alive && e.col === squid.col && (e.y + e.h) > (squid.y + squid.h))
      .sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];

    const target = blocker ?? squid;
    const before = (await gamePage.state()).score;
    await movePlayerCenterTo(gamePage, target.x + (target.w / 2));
    await gamePage.pressKey('Space', 80);

    await expect.poll(async () => {
      const e = await gamePage.formation();
      return e.find((x) => x.index === target.index)?.alive;
    }, { timeout: 3_000 }).toBe(false);

    const after = (await gamePage.state()).score;
    if (target.type === 'squid') {
      expect(after - before).toBe(40);
      return;
    }
    await gamePage.page.waitForTimeout(80);
  }
});

test('high score is updated when score exceeds existing high', async ({ gamePage }) => {
  await gamePage.goto({ seed: 34, formationSpeed: 0 });
  await gamePage.waitForReady();
  await gamePage.setHighScore(0);

  // Force a game-over with a known final score; showGameOver writes the high.
  await gamePage.page.evaluate(() => window.__subInvaders.forceGameOver(123));
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('game-over');
  expect((await gamePage.state()).high).toBe(123);
});
