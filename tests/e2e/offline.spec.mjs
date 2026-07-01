import { expect, test } from './_fixtures.mjs';

// CS08: a ranked score whose submission fails on the network (offline) is queued
// in localStorage.subInvadersPendingScores and drained on the next online load.

function pendingCount(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('subInvadersPendingScores');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.length : -1;
    } catch {
      return -1;
    }
  });
}

test('an offline ranked score is queued, then drained on the next online load', async ({ gamePage, page }) => {
  // /api/session succeeds (real session id) but /api/score fails while "offline".
  let scoreOffline = true;
  const scorePosts = [];
  await page.route('**/api/score', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    scorePosts.push(1);
    if (scoreOffline) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'accepted', score: 0, submissionId: 'drained' }),
    });
  });

  await gamePage.goto({ seed: 11, formationSpeed: 0 }); // ranked
  await gamePage.waitForReady();
  await gamePage.setLives(0);
  await expect.poll(async () => (await gamePage.state()).gameOver, { timeout: 5_000 }).toBe(true);

  // The failed ranked submission enqueues the score.
  await expect.poll(() => pendingCount(page), { timeout: 5_000 }).toBeGreaterThan(0);

  // Back online: reloading drains the queue on load and re-submits.
  scoreOffline = false;
  const postsBeforeReload = scorePosts.length;
  await page.reload();
  await gamePage.waitForReady();

  await expect.poll(() => pendingCount(page), { timeout: 5_000 }).toBe(0);
  expect(scorePosts.length).toBeGreaterThan(postsBeforeReload);
});
