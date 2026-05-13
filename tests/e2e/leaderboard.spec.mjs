import { expect, test } from './_fixtures.mjs';

async function pressViaHook(page, code) {
  await page.evaluate((c) => {
    window.__subInvaders.pressKey(c);
    setTimeout(() => window.__subInvaders.releaseKey(c), 50);
  }, code);
}

const SESSION_FIXTURE = {
  sessionId: 'e2e-session-001',
  nonce: 'aabbccdd',
  startedAt: '2026-05-13T00:00:00.000Z',
};

const SCORE_FIXTURE = {
  status: 'accepted',
  score: 0,
  submissionId: 'e2e-submission-001',
};

const LEADERBOARD_FIXTURE = {
  period: 'all',
  entries: [
    { rank: 1, score: 9001, finishedAt: '2026-05-13T00:00:30.000Z' },
    { rank: 2, score: 4242, finishedAt: '2026-05-12T18:14:00.000Z' },
    { rank: 3, score: 100, finishedAt: '2026-05-12T17:00:00.000Z' },
  ],
};

async function stubApi(page, { leaderboard = LEADERBOARD_FIXTURE, leaderboardStatus = 200 } = {}) {
  const calls = { session: 0, score: 0, leaderboard: 0, scoreBodies: [] };

  await page.route('**/api/session', async (route) => {
    calls.session += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SESSION_FIXTURE),
    });
  });

  await page.route('**/api/score', async (route) => {
    calls.score += 1;
    const post = route.request().postData();
    if (post) {
      try { calls.scoreBodies.push(JSON.parse(post)); } catch { /* ignore */ }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SCORE_FIXTURE),
    });
  });

  await page.route('**/api/leaderboard*', async (route) => {
    calls.leaderboard += 1;
    if (leaderboardStatus !== 200) {
      await route.fulfill({
        status: leaderboardStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'service_unavailable' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(leaderboard),
    });
  });

  return calls;
}

test('CS03/D9: play scene calls /api/session once when the game starts', async ({ gamePage }) => {
  const calls = await stubApi(gamePage.page);
  await gamePage.goto({ seed: 21, formationSpeed: 0 });
  await gamePage.waitForReady();

  await expect.poll(() => calls.session, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
  // Idempotency: a single play scene should not retry session creation.
  await gamePage.page.waitForTimeout(200);
  expect(calls.session).toBe(1);

  const state = await gamePage.state();
  expect(state.scene).toBe('play');
});

test('CS03/D9: game over triggers /api/score with sessionId and finishedAt', async ({ gamePage }) => {
  const calls = await stubApi(gamePage.page);
  await gamePage.goto({ seed: 22, formationSpeed: 0 });
  await gamePage.waitForReady();
  await expect.poll(() => calls.session, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);

  await gamePage.setLives(0);

  await expect.poll(async () => (await gamePage.state()).gameOver, { timeout: 5_000 }).toBe(true);
  await expect.poll(() => calls.score, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);

  const body = calls.scoreBodies[0];
  expect(body.sessionId).toBe(SESSION_FIXTURE.sessionId);
  expect(typeof body.finishedAt).toBe('string');
  expect(Number.isFinite(Date.parse(body.finishedAt))).toBe(true);
  expect(Number.isInteger(body.score)).toBe(true);
});

test('CS03/D10: pressing L from game-over loads the leaderboard scene with entries', async ({ gamePage }) => {
  const calls = await stubApi(gamePage.page);
  await gamePage.goto({ seed: 23, formationSpeed: 0 });
  await gamePage.waitForReady();
  await expect.poll(() => calls.session, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);

  await gamePage.setLives(0);
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 5_000 }).toBe('game-over');

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await gamePage.state()).scene === 'leaderboard') break;
    await pressViaHook(gamePage.page, 'KeyL');
    await gamePage.page.waitForTimeout(120);
  }

  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 5_000 }).toBe('leaderboard');
  await expect.poll(async () => (await gamePage.state()).phase, { timeout: 5_000 }).toBe('ready');

  const state = await gamePage.state();
  expect(state.entriesCount).toBe(LEADERBOARD_FIXTURE.entries.length);
  expect(calls.leaderboard).toBeGreaterThanOrEqual(1);

  const entries = await gamePage.page.evaluate(() => window.__subInvaders.entries());
  expect(entries).toEqual(LEADERBOARD_FIXTURE.entries);
});

test('CS03/D10: leaderboard surfaces error phase when /api/leaderboard returns 503', async ({ gamePage }) => {
  const calls = await stubApi(gamePage.page, { leaderboardStatus: 503 });
  await gamePage.goto({ seed: 24, formationSpeed: 0 });
  await gamePage.waitForReady();
  await expect.poll(() => calls.session, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);

  await gamePage.setLives(0);
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 5_000 }).toBe('game-over');

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await gamePage.state()).scene === 'leaderboard') break;
    await pressViaHook(gamePage.page, 'KeyL');
    await gamePage.page.waitForTimeout(120);
  }

  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 5_000 }).toBe('leaderboard');
  await expect.poll(async () => (await gamePage.state()).phase, { timeout: 5_000 }).toBe('error');
});

test('CS03: pressing L from the start menu opens the leaderboard scene', async ({ gamePage }) => {
  const calls = await stubApi(gamePage.page);
  await gamePage.goto({ seed: 25, formationSpeed: 0 });

  // Do NOT call waitForReady — that advances past the menu by spamming Space.
  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 5_000 }).toBe('menu');

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if ((await gamePage.state()).scene === 'leaderboard') break;
    await pressViaHook(gamePage.page, 'KeyL');
    await gamePage.page.waitForTimeout(120);
  }

  await expect.poll(async () => (await gamePage.state()).scene, { timeout: 5_000 }).toBe('leaderboard');
  await expect.poll(async () => (await gamePage.state()).phase, { timeout: 5_000 }).toBe('ready');

  const state = await gamePage.state();
  expect(state.entriesCount).toBe(LEADERBOARD_FIXTURE.entries.length);
  expect(calls.leaderboard).toBeGreaterThanOrEqual(1);
  // Reaching leaderboard from the menu must not have started a play session.
  expect(calls.session).toBe(0);
});
