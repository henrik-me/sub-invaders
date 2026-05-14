import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeaderboardScene, __forTesting } from './leaderboard.mjs';

function makeRenderer() {
  const calls = [];
  return {
    width: () => 480,
    clear(color) { calls.push({ op: 'clear', color }); },
    drawText(text, x, y, opts) { calls.push({ op: 'drawText', text, x, y, opts }); },
    calls,
  };
}

function makeInput(map) {
  return { pressed: (key) => Boolean(map[key]) };
}

function makeApi(promiseFactory) {
  return { getLeaderboard: promiseFactory };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

test('formatScore floors and clamps', () => {
  assert.equal(__forTesting.formatScore(123.9), '123');
  assert.equal(__forTesting.formatScore(-1), '0');
  assert.equal(__forTesting.formatScore('x'), '0');
});

test('shortenError truncates long messages', () => {
  const long = 'x'.repeat(150);
  assert.equal(__forTesting.shortenError(new Error(long)).length, 80);
  assert.equal(__forTesting.shortenError('short'), 'short');
});

test('renders LOADING then READY entries from apiClient', async () => {
  const apiClient = makeApi(() => Promise.resolve({
    period: 'all',
    entries: [
      { rank: 1, score: 9001, finishedAt: '2026-05-13T00:00:00Z' },
      { rank: 2, score: 4242, finishedAt: '2026-05-13T00:00:00Z' },
    ],
  }));
  const scene = createLeaderboardScene({ apiClient, top: 10 });
  scene.enter();

  const r1 = makeRenderer();
  scene.render(r1);
  assert.ok(r1.calls.some((c) => c.op === 'drawText' && /LOADING/.test(c.text)));

  await flush();

  const r2 = makeRenderer();
  scene.render(r2);
  const drawn = r2.calls.filter((c) => c.op === 'drawText').map((c) => c.text);
  assert.ok(drawn.some((t) => t.includes('9001')));
  assert.ok(drawn.some((t) => t.includes('4242')));
  assert.equal(scene.state().phase, 'ready');
  assert.equal(scene.state().entries.length, 2);
});

test('shows error UI when api rejects', async () => {
  const apiClient = makeApi(() => Promise.reject(new Error('backend down')));
  const scene = createLeaderboardScene({ apiClient });
  scene.enter();
  await flush();

  const r = makeRenderer();
  scene.render(r);
  const drawn = r.calls.filter((c) => c.op === 'drawText').map((c) => c.text);
  assert.ok(drawn.some((t) => t === 'UNABLE TO LOAD'));
  assert.ok(drawn.some((t) => t === 'backend down'));
  assert.equal(scene.state().phase, 'error');
});

test('shows NO SCORES when entries empty', async () => {
  const apiClient = makeApi(() => Promise.resolve({ period: 'all', entries: [] }));
  const scene = createLeaderboardScene({ apiClient });
  scene.enter();
  await flush();

  const r = makeRenderer();
  scene.render(r);
  assert.ok(r.calls.some((c) => c.text === 'NO SCORES YET'));
});

test('Space triggers onRestart, M triggers onMenu', async () => {
  let restarted = 0;
  let menued = 0;
  const apiClient = makeApi(() => Promise.resolve({ period: 'all', entries: [] }));
  const scene = createLeaderboardScene({
    apiClient,
    onRestart: () => { restarted++; },
    onMenu: () => { menued++; },
  });
  scene.enter();
  await flush();

  scene.handleInput(makeInput({ Space: true }));
  assert.equal(restarted, 1);
  scene.handleInput(makeInput({ KeyM: true }));
  assert.equal(menued, 1);
});

test('falls back to error state when apiClient missing', () => {
  const scene = createLeaderboardScene({});
  scene.enter();
  assert.equal(scene.state().phase, 'error');
  assert.equal(scene.state().error, 'leaderboard unavailable');
});

test('respects top limit when provided', async () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({
    rank: i + 1, score: 1000 - i, finishedAt: '2026-05-13T00:00:00Z',
  }));
  const apiClient = makeApi(() => Promise.resolve({ period: 'all', entries }));
  const scene = createLeaderboardScene({ apiClient, top: 5 });
  scene.enter();
  await flush();
  assert.equal(scene.state().entries.length, 5);
});

test('default onMenu and onRestart fallbacks are invoked without errors', async () => {
  const apiClient = makeApi(() => Promise.resolve({ period: 'all', entries: [] }));
  const scene = createLeaderboardScene({ apiClient });
  scene.enter();
  await flush();

  assert.doesNotThrow(() => scene.handleInput(makeInput({ Space: true })));
  assert.doesNotThrow(() => scene.handleInput(makeInput({ KeyM: true })));
  assert.doesNotThrow(() => scene.handleInput(makeInput({})));
  assert.doesNotThrow(() => scene.handleInput(null));
});

test('treats missing entries field as empty list', async () => {
  const apiClient = makeApi(() => Promise.resolve({ period: 'all' }));
  const scene = createLeaderboardScene({ apiClient });
  scene.enter();
  await flush();
  assert.equal(scene.state().phase, 'ready');
  assert.equal(scene.state().entries.length, 0);
});

test('falls back to CANVAS.width when renderer lacks width()', async () => {
  const apiClient = makeApi(() => Promise.resolve({ period: 'all', entries: [] }));
  const scene = createLeaderboardScene({ apiClient });
  scene.enter();
  await flush();

  const calls = [];
  const renderer = {
    clear(color) { calls.push({ op: 'clear', color }); },
    drawText(text, x, y, opts) { calls.push({ op: 'drawText', text, x, y, opts }); },
  };
  scene.render(renderer);
  const titleCall = calls.find((c) => c.op === 'drawText' && c.text === 'LEADERBOARD');
  assert.ok(titleCall, 'title was drawn');
  assert.ok(Number.isFinite(titleCall.x) && titleCall.x > 0, 'used CANVAS.width fallback');
});

// CS04 D8/D14 — daily-mode leaderboard reads (CS04-14)
test('CS04: default period is all-time and omits date (CS03 back-compat)', async () => {
  const captured = [];
  const apiClient = { getLeaderboard: (args) => { captured.push(args); return Promise.resolve({ period: 'all', entries: [] }); } };
  const scene = createLeaderboardScene({ apiClient });
  scene.enter();
  await flush();
  assert.equal(captured.length, 1);
  assert.equal(captured[0].period, 'all');
  assert.equal(Object.prototype.hasOwnProperty.call(captured[0], 'date'), false);
});

test('CS04: daily mode passes period:"daily" + date through to getLeaderboard', async () => {
  const captured = [];
  const apiClient = { getLeaderboard: (args) => { captured.push(args); return Promise.resolve({ period: 'daily', entries: [] }); } };
  const scene = createLeaderboardScene({ apiClient, period: 'daily', date: '2026-05-14' });
  scene.enter();
  await flush();
  assert.equal(captured.length, 1);
  assert.equal(captured[0].period, 'daily');
  assert.equal(captured[0].date, '2026-05-14');
});

test('CS04: non-string date in daily mode is dropped (defensive)', async () => {
  const captured = [];
  const apiClient = { getLeaderboard: (args) => { captured.push(args); return Promise.resolve({ period: 'daily', entries: [] }); } };
  const scene = createLeaderboardScene({ apiClient, period: 'daily', date: 12345 });
  scene.enter();
  await flush();
  assert.equal(captured[0].period, 'daily');
  assert.equal(Object.prototype.hasOwnProperty.call(captured[0], 'date'), false);
});

test('CS04: unknown period falls back to all-time', async () => {
  const captured = [];
  const apiClient = { getLeaderboard: (args) => { captured.push(args); return Promise.resolve({ period: 'all', entries: [] }); } };
  const scene = createLeaderboardScene({ apiClient, period: 'weekly', date: '2026-05-14' });
  scene.enter();
  await flush();
  assert.equal(captured[0].period, 'all');
  assert.equal(Object.prototype.hasOwnProperty.call(captured[0], 'date'), false);
});
