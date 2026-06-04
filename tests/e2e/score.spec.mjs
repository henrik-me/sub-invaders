import { expect, test } from './_fixtures.mjs';

const POINTS_BY_TYPE = { jellyfish: 10, anglerfish: 20, squid: 40 };

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

async function settleTorpedoes(gamePage, timeoutMs = 2_500) {
  // The waitForReady fixture spams Space which can leave residual torpedoes in
  // flight; let them resolve so they don't pollute the score delta.
  await expect.poll(async () => (await gamePage.torpedoes()).length, { timeout: timeoutMs })
    .toBe(0);
}

async function pressViaHook(page, code) {
  await page.evaluate((c) => {
    window.__subInvaders.pressKey(c);
    setTimeout(() => window.__subInvaders.releaseKey(c), 50);
  }, code);
}

// Like pause.spec.mjs, re-arm edge-triggered input across the full assertion
// budget: render-only rAF ticks can call input.endFrame() before any update()
// observes a single key edge.
async function pressKeyUntil(gamePage, code, conditionFn, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await conditionFn()) return true;
    await pressViaHook(gamePage.page, code);
    await gamePage.page.waitForTimeout(120);
  }

  return conditionFn();
}

async function expectKilledByFire(gamePage, target, timeoutMs = 3_000) {
  const killed = await pressKeyUntil(gamePage, 'Space', async () => {
    const enemies = await gamePage.formation();
    return enemies.find((enemy) => enemy.index === target.index)?.alive === false;
  }, timeoutMs);

  expect(killed).toBe(true);
}

function aliveByIndex(formation) {
  return new Map(formation.filter((enemy) => enemy.alive).map((enemy) => [enemy.index, enemy]));
}

function expectedDeltaFromDeaths(aliveBefore, aliveAfter) {
  let delta = 0;
  for (const [index, enemy] of aliveBefore) {
    if (!aliveAfter.has(index)) {
      delta += POINTS_BY_TYPE[enemy.type] ?? 0;
    }
  }
  return delta;
}

async function killByType(gamePage, type, expectedPoints) {
  await settleTorpedoes(gamePage);

  const formation = await gamePage.formation();
  const target = formation
    .filter((enemy) => enemy.alive && enemy.type === type)
    .sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];
  expect(target, `expected at least one alive ${type}`).toBeTruthy();

  const before = (await gamePage.state()).score;
  const aliveBefore = aliveByIndex(await gamePage.formation());

  await movePlayerCenterTo(gamePage, target.x + (target.w / 2));
  await settleTorpedoes(gamePage);
  await expectKilledByFire(gamePage, target);

  await settleTorpedoes(gamePage);

  const after = (await gamePage.state()).score;
  const aliveAfter = aliveByIndex(await gamePage.formation());
  const observedDelta = expectedDeltaFromDeaths(aliveBefore, aliveAfter);

  // Sanity: our target died and the per-type points value matches the request.
  expect(aliveAfter.has(target.index)).toBe(false);
  expect(POINTS_BY_TYPE[type]).toBe(expectedPoints);

  // Score delta equals the sum of per-type points for every enemy that died,
  // regardless of whether other enemies happened to die in the same window.
  expect(after - before).toBe(observedDelta);
  // And the delta must include at least our target's points.
  expect(observedDelta).toBeGreaterThanOrEqual(expectedPoints);
}

test('killing a jellyfish (row 3-4) awards 10 points', async ({ gamePage }) => {
  await gamePage.goto({ seed: 31, formationSpeed: 0, fireIntervalMs: 999_999 });
  await gamePage.waitForReady();

  await killByType(gamePage, 'jellyfish', 10);
});

test('killing an anglerfish (row 1-2) awards 20 points', async ({ gamePage }) => {
  await gamePage.goto({ seed: 32, formationSpeed: 0, fireIntervalMs: 999_999 });
  await gamePage.waitForReady();
  await settleTorpedoes(gamePage);

  // Clear blockers in the column from the bottom up, then kill the anglerfish.
  for (let attempts = 0; attempts < 30; attempts += 1) {
    const enemies = await gamePage.formation();
    const angler = enemies.find((e) => e.alive && e.type === 'anglerfish');
    if (!angler) {
      break;
    }
    const blocker = enemies
      .filter((e) => e.alive && e.col === angler.col && (e.y + e.h) > (angler.y + angler.h))
      .sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];

    const target = blocker ?? angler;
    const before = (await gamePage.state()).score;
    const aliveBefore = aliveByIndex(await gamePage.formation());

    await movePlayerCenterTo(gamePage, target.x + (target.w / 2));
    await settleTorpedoes(gamePage);
    await expectKilledByFire(gamePage, target);

    await settleTorpedoes(gamePage);

    const after = (await gamePage.state()).score;
    const aliveAfter = aliveByIndex(await gamePage.formation());
    const observedDelta = expectedDeltaFromDeaths(aliveBefore, aliveAfter);
    expect(after - before).toBe(observedDelta);

    if (target.type === 'anglerfish') {
      expect(observedDelta).toBeGreaterThanOrEqual(20);
      return;
    }
    // Cooldown to avoid back-to-back fire suppression.
    await gamePage.page.waitForTimeout(80);
  }
});

test('killing a squid (row 0) awards 40 points', async ({ gamePage }) => {
  await gamePage.goto({ seed: 33, formationSpeed: 0, fireIntervalMs: 999_999 });
  await gamePage.waitForReady();
  await settleTorpedoes(gamePage);

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
    const aliveBefore = aliveByIndex(await gamePage.formation());

    await movePlayerCenterTo(gamePage, target.x + (target.w / 2));
    await settleTorpedoes(gamePage);
    await expectKilledByFire(gamePage, target);

    await settleTorpedoes(gamePage);

    const after = (await gamePage.state()).score;
    const aliveAfter = aliveByIndex(await gamePage.formation());
    const observedDelta = expectedDeltaFromDeaths(aliveBefore, aliveAfter);
    expect(after - before).toBe(observedDelta);

    if (target.type === 'squid') {
      expect(observedDelta).toBeGreaterThanOrEqual(40);
      return;
    }
    await gamePage.page.waitForTimeout(80);
  }
});

test('high score is updated when score exceeds existing high', async ({ gamePage }) => {
  await gamePage.goto({ seed: 34, formationSpeed: 0, fireIntervalMs: 999_999 });
  await gamePage.waitForReady();
  await gamePage.setHighScore(0);

  // Force a game-over with a known final score; showGameOver writes the high.
  await gamePage.page.evaluate(() => window.__subInvaders.forceGameOver(123));
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 3_000 }).toBe('game-over');
  expect((await gamePage.state()).high).toBe(123);
});
