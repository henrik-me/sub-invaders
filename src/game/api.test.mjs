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
