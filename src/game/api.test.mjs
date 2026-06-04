import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, ApiError, __forTesting } from './api.mjs';

function fakeFetch(impl) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return impl(url, init);
  };
  fn.calls = calls;
  return fn;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('createApiClient throws when fetch is not available', () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = undefined;
    assert.throws(() => createApiClient({ fetch: undefined, baseUrl: '/api' }), /fetch is not available/);
  } finally {
    globalThis.fetch = original;
  }
});

test('normalizeBase strips trailing slash and falls back to /api', () => {
  assert.equal(__forTesting.normalizeBase('/api/'), '/api');
  assert.equal(__forTesting.normalizeBase(undefined), '/api');
  assert.equal(__forTesting.normalizeBase(''), '/api');
});


test('CS12: isValidUtcDate rejects impossible calendar dates and accepts real dates', () => {
  for (const date of ['2026-02-30', '2026-99-99', '0000-00-00', '2026-13-01', '2026-00-10']) {
    assert.equal(__forTesting.isValidUtcDate(date), false, `${date} should be rejected`);
  }
  assert.equal(__forTesting.isValidUtcDate('2024-02-29'), true);
  assert.equal(__forTesting.isValidUtcDate('2026-05-14'), true);
});

test('startSession returns sessionId/nonce/startedAt', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, {
    sessionId: 'abc-123',
    nonce: 'deadbeef',
    startedAt: '2026-05-13T00:00:00Z',
  }));
  const client = createApiClient({ fetch });
  const out = await client.startSession();
  assert.deepEqual(out, { sessionId: 'abc-123', nonce: 'deadbeef', startedAt: '2026-05-13T00:00:00Z' });
  assert.equal(fetch.calls[0].url, '/api/session');
  assert.equal(fetch.calls[0].init.method, 'POST');
});

test('startSession throws ApiError when response is malformed', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { nope: true }));
  const client = createApiClient({ fetch });
  await assert.rejects(client.startSession(), (err) => err instanceof ApiError && err.code === 'malformed_response');
});

test('submitScore validates arguments', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { status: 'accepted' }));
  const client = createApiClient({ fetch });
  await assert.rejects(client.submitScore({ score: 1, finishedAt: 'x' }), /sessionId is required/);
  await assert.rejects(client.submitScore({ sessionId: 'a', score: -1, finishedAt: 'x' }), /non-negative integer/);
  await assert.rejects(client.submitScore({ sessionId: 'a', score: 1 }), /finishedAt/);
});

test('submitScore POSTs JSON body', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { status: 'accepted', score: 100 }));
  const client = createApiClient({ fetch });
  const out = await client.submitScore({ sessionId: 'abc', score: 100, finishedAt: '2026-05-13T00:00:00Z' });
  assert.equal(out.status, 'accepted');
  assert.equal(fetch.calls[0].init.method, 'POST');
  assert.equal(fetch.calls[0].init.headers['Content-Type'], 'application/json');
  const sent = JSON.parse(fetch.calls[0].init.body);
  assert.deepEqual(sent, { sessionId: 'abc', score: 100, finishedAt: '2026-05-13T00:00:00Z' });
});

test('submitScore surfaces backend error code and message', async () => {
  const fetch = fakeFetch(() => jsonResponse(409, { error: 'already_consumed', message: 'session has already been used' }));
  const client = createApiClient({ fetch });
  await assert.rejects(
    client.submitScore({ sessionId: 'abc', score: 1, finishedAt: '2026-05-13T00:00:00Z' }),
    (err) => err instanceof ApiError && err.status === 409 && err.code === 'already_consumed',
  );
});

test('submitScore wraps network errors', async () => {
  const fetch = fakeFetch(() => { throw new Error('boom'); });
  const client = createApiClient({ fetch });
  await assert.rejects(
    client.submitScore({ sessionId: 'abc', score: 1, finishedAt: '2026-05-13T00:00:00Z' }),
    (err) => err instanceof ApiError && err.code === 'network_error',
  );
});

test('getLeaderboard returns normalized entries', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, {
    period: 'all',
    entries: [
      { rank: 1, score: 5000, finishedAt: '2026-05-13T00:00:00Z' },
      { rank: 2, score: 4000, finishedAt: '2026-05-13T00:00:00Z' },
    ],
  }));
  const client = createApiClient({ fetch });
  const result = await client.getLeaderboard({ period: 'all' });
  assert.equal(result.period, 'all');
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].rank, 1);
  assert.equal(fetch.calls[0].url, '/api/leaderboard?period=all');
});

test('getLeaderboard rejects malformed response', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { period: 'all' }));
  const client = createApiClient({ fetch });
  await assert.rejects(client.getLeaderboard(), (err) => err instanceof ApiError && err.code === 'malformed_response');
});

test('readJson throws ApiError when body is not JSON', async () => {
  const fetch = fakeFetch(() => new Response('<html/>', { status: 500, headers: { 'Content-Type': 'text/html' } }));
  const client = createApiClient({ fetch });
  await assert.rejects(client.startSession(), (err) => err instanceof ApiError && err.code === 'invalid_json');
});

test('non-2xx with no body falls back to http_<status> code', async () => {
  const fetch = fakeFetch(() => new Response('', { status: 503 }));
  const client = createApiClient({ fetch });
  await assert.rejects(
    client.startSession(),
    (err) => err instanceof ApiError && err.status === 503 && err.code === 'http_503',
  );
});

// CS04 D8 — daily-aware payload contract (CS04-14).
// submitScore and getLeaderboard MUST stay backward-compatible with CS03 callers
// that pass no period/utcDate/date, AND MUST forward the daily fields when the
// caller passes period:'daily'.

test('CS04: submitScore omits period/utcDate when not passed (CS03 back-compat)', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { status: 'accepted' }));
  const client = createApiClient({ fetch });
  await client.submitScore({ sessionId: 'abc', score: 10, finishedAt: '2026-05-14T00:00:00Z' });
  const sent = JSON.parse(fetch.calls[0].init.body);
  assert.deepEqual(Object.keys(sent).sort(), ['finishedAt', 'score', 'sessionId']);
  assert.equal(Object.hasOwn(sent, 'period'), false);
  assert.equal(Object.hasOwn(sent, 'utcDate'), false);
});

test('CS04: submitScore forwards period and utcDate when daily', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { status: 'accepted' }));
  const client = createApiClient({ fetch });
  await client.submitScore({
    sessionId: 'abc',
    score: 10,
    finishedAt: '2026-05-14T00:00:00Z',
    period: 'daily',
    utcDate: '2026-05-14',
  });
  const sent = JSON.parse(fetch.calls[0].init.body);
  assert.equal(sent.period, 'daily');
  assert.equal(sent.utcDate, '2026-05-14');
});

test('CS04: submitScore allows explicit period:"all" without utcDate', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { status: 'accepted' }));
  const client = createApiClient({ fetch });
  await client.submitScore({
    sessionId: 'abc',
    score: 10,
    finishedAt: '2026-05-14T00:00:00Z',
    period: 'all',
  });
  const sent = JSON.parse(fetch.calls[0].init.body);
  assert.equal(sent.period, 'all');
  assert.equal(Object.hasOwn(sent, 'utcDate'), false);
});

test('CS04: submitScore rejects invalid period', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { status: 'accepted' }));
  const client = createApiClient({ fetch });
  await assert.rejects(
    client.submitScore({ sessionId: 'a', score: 1, finishedAt: 'x', period: 'weekly' }),
    /period must be "all" or "daily"/,
  );
});

test('CS04: submitScore rejects daily without utcDate', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { status: 'accepted' }));
  const client = createApiClient({ fetch });
  await assert.rejects(
    client.submitScore({ sessionId: 'a', score: 1, finishedAt: '2026-05-14T00:00:00Z', period: 'daily' }),
    /utcDate must be YYYY-MM-DD/,
  );
});

test('CS04: submitScore rejects daily with malformed utcDate', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { status: 'accepted' }));
  const client = createApiClient({ fetch });
  await assert.rejects(
    client.submitScore({ sessionId: 'a', score: 1, finishedAt: '2026-05-14T00:00:00Z', period: 'daily', utcDate: '5/14/2026' }),
    /utcDate must be YYYY-MM-DD/,
  );
});

test('CS04: getLeaderboard CS03 default request unchanged (period=all, no date)', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { period: 'all', entries: [] }));
  const client = createApiClient({ fetch });
  await client.getLeaderboard();
  assert.equal(fetch.calls[0].url, '/api/leaderboard?period=all');
});

test('CS04: getLeaderboard daily includes date query param', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { period: 'daily', entries: [] }));
  const client = createApiClient({ fetch });
  await client.getLeaderboard({ period: 'daily', date: '2026-05-14' });
  assert.equal(fetch.calls[0].url, '/api/leaderboard?period=daily&date=2026-05-14');
});

test('CS04: getLeaderboard rejects daily without date', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { period: 'daily', entries: [] }));
  const client = createApiClient({ fetch });
  await assert.rejects(
    client.getLeaderboard({ period: 'daily' }),
    /date must be YYYY-MM-DD/,
  );
});

test('CS04: getLeaderboard rejects invalid period', async () => {
  const fetch = fakeFetch(() => jsonResponse(200, { period: 'all', entries: [] }));
  const client = createApiClient({ fetch });
  await assert.rejects(
    client.getLeaderboard({ period: 'weekly' }),
    /period must be "all" or "daily"/,
  );
});

test('CS12: submitScore rejects impossible daily utcDate before fetch', async () => {
  for (const utcDate of ['2026-02-30', '2026-99-99', '0000-00-00', '2026-13-01', '2026-00-10']) {
    const fetch = fakeFetch(() => jsonResponse(200, { status: 'accepted' }));
    const client = createApiClient({ fetch });
    await assert.rejects(
      client.submitScore({ sessionId: 'a', score: 1, finishedAt: '2026-05-14T00:00:00Z', period: 'daily', utcDate }),
      /utcDate must be YYYY-MM-DD/,
    );
    assert.equal(fetch.calls.length, 0, `${utcDate} should not fetch`);
  }
});

test('CS12: submitScore accepts real daily utcDate values', async () => {
  for (const utcDate of ['2024-02-29', '2026-05-14']) {
    const fetch = fakeFetch(() => jsonResponse(200, { status: 'accepted' }));
    const client = createApiClient({ fetch });
    await client.submitScore({ sessionId: 'a', score: 1, finishedAt: '2026-05-14T00:00:00Z', period: 'daily', utcDate });
    assert.equal(fetch.calls.length, 1);
  }
});

test('CS12: getLeaderboard rejects impossible daily date before fetch', async () => {
  for (const date of ['2026-02-30', '2026-99-99', '0000-00-00', '2026-13-01', '2026-00-10']) {
    const fetch = fakeFetch(() => jsonResponse(200, { period: 'daily', entries: [] }));
    const client = createApiClient({ fetch });
    await assert.rejects(client.getLeaderboard({ period: 'daily', date }), /date must be YYYY-MM-DD/);
    assert.equal(fetch.calls.length, 0, `${date} should not fetch`);
  }
});

test('CS12: getLeaderboard accepts real daily date values', async () => {
  for (const date of ['2024-02-29', '2026-05-14']) {
    const fetch = fakeFetch(() => jsonResponse(200, { period: 'daily', entries: [] }));
    const client = createApiClient({ fetch });
    await client.getLeaderboard({ period: 'daily', date });
    assert.equal(fetch.calls.length, 1);
  }
});
