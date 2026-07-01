import { expect, test } from './_fixtures.mjs';

// CS08: ranked (default) submits to the backend; practice (?mode=practice) never
// touches /api/session|score and persists its high score under a separate key.

test('ranked mode starts a backend session', async ({ gamePage, page }) => {
  const sessionPosts = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/api\/session(\?|$)/.test(req.url())) {
      sessionPosts.push(req.url());
    }
  });

  await gamePage.goto({ seed: 11, formationSpeed: 0 });
  await gamePage.waitForReady();

  await expect.poll(() => sessionPosts.length, { timeout: 5_000 }).toBeGreaterThan(0);
});

test('practice mode never contacts the backend and keeps a separate high score', async ({ gamePage, page }) => {
  const apiPosts = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/api\/(session|score)(\?|$)/.test(req.url())) {
      apiPosts.push(req.url());
    }
  });

  await gamePage.goto({ mode: 'practice', seed: 11, formationSpeed: 0 });
  await gamePage.waitForReady();

  // The mode-aware high-score hook writes the practice key only.
  await gamePage.setHighScore(1234);
  await gamePage.setLives(0);
  await expect.poll(async () => (await gamePage.state()).gameOver, { timeout: 5_000 }).toBe(true);

  const stored = await page.evaluate(() => ({
    ranked: localStorage.getItem('subInvadersHighScore'),
    practice: localStorage.getItem('subInvadersPracticeHighScore'),
  }));

  expect(stored.practice).toBe('1234');
  expect(stored.ranked).toBeNull();
  expect(apiPosts).toEqual([]);
});
