import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import checks from './verify-deploy.checks.mjs';

describe('verify-deploy.checks — wired CS02 deliverable 9 probe', () => {
  it('exports an array of checks', () => {
    assert.ok(Array.isArray(checks));
    assert.ok(checks.length >= 1);
  });

  it('each check has name + (expect.status OR run)', () => {
    for (const c of checks) {
      assert.equal(typeof c.name, 'string', 'name must be string');
      assert.ok(c.name.length > 0);

      const hasExpect = c.expect && typeof c.expect.status === 'number';
      const hasRun = typeof c.run === 'function';
      assert.ok(hasExpect || hasRun, `${c.name} must declare expect.status OR a run function`);

      if (hasExpect) {
        assert.equal(typeof c.path, 'string', `${c.name}: path must be string when using expect`);
        assert.ok(c.path.startsWith('/'), `path "${c.path}" must start with /`);
      }
    }
  });

  it('check names are unique', () => {
    const names = checks.map((c) => c.name);
    assert.equal(new Set(names).size, names.length);
  });

  it('covers frontend-root, health, and sprites per CS02 acceptance criterion 11', () => {
    const names = new Set(checks.map((c) => c.name));
    assert.ok(names.has('frontend-root'), 'must include frontend-root check');
    assert.ok(names.has('health'), 'must include health check');
    assert.ok(names.has('sprites'), 'must include sprites check');
  });

  it('frontend-root validator rejects the CS01 stub body (no #game-canvas)', () => {
    const root = checks.find((c) => c.name === 'frontend-root');
    assert.ok(root.expect.body, 'frontend-root must define a body validator');
    const cs01StubBody = '<!doctype html><html><body><h1>Sub Invaders coming soon</h1></body></html>';
    const result = root.expect.body(cs01StubBody, { baseUrl: '', expectedVersion: 'x' });
    assert.notEqual(result, null, 'CS01 stub body must FAIL validation');
    assert.match(result, /game-canvas/);
  });

  it('frontend-root validator accepts a body with the expected canvas + title', () => {
    const root = checks.find((c) => c.name === 'frontend-root');
    const goodBody = '<!doctype html><html><head><title>Sub Invaders</title></head><body><canvas id="game-canvas" width="800" height="600"></canvas></body></html>';
    assert.equal(root.expect.body(goodBody, { baseUrl: '', expectedVersion: 'x' }), null);
  });

  it('frontend-root validator rejects empty body', () => {
    const root = checks.find((c) => c.name === 'frontend-root');
    assert.notEqual(root.expect.body('', { baseUrl: '', expectedVersion: 'x' }), null);
  });

  it('health and sprites validators reject empty bodies', () => {
    for (const name of ['health', 'sprites']) {
      const c = checks.find((x) => x.name === name);
      assert.ok(c.expect.body, `${name} must define a body validator`);
      assert.notEqual(c.expect.body('', { baseUrl: '', expectedVersion: 'x' }), null);
      assert.equal(c.expect.body('non-empty payload', { baseUrl: '', expectedVersion: 'x' }), null);
    }
  });
});

describe('verify-deploy.checks — CS03/D13 leaderboard-sequence probe', () => {
  function findLeaderboardSequence() {
    return checks.find((c) => c.name === 'leaderboard-sequence');
  }

  it('exposes a leaderboard-sequence check with a run function', () => {
    const c = findLeaderboardSequence();
    assert.ok(c, 'must define a leaderboard-sequence check');
    assert.equal(typeof c.run, 'function');
  });

  it('passes when all three CS03 endpoints behave per contract', async () => {
    const c = findLeaderboardSequence();
    const calls = [];
    const ctx = {
      baseUrl: 'https://example.test',
      expectedVersion: 'sha-1',
      async httpRequest({ path, method }) {
        calls.push({ path, method });
        if (path === '/api/session' && method === 'POST') {
          return {
            status: 200,
            body: '',
            json: { sessionId: 'seq-1', nonce: 'nn', startedAt: '2026-05-13T00:00:00.000Z' },
          };
        }
        if (path === '/api/score' && method === 'POST') {
          return {
            status: 200,
            body: '',
            json: { status: 'accepted', score: 1, submissionId: 'sub-1' },
          };
        }
        if (path === '/api/leaderboard?period=all') {
          return {
            status: 200,
            body: '',
            json: { period: 'all', entries: [{ rank: 1, score: 1, finishedAt: '2026-05-13T00:00:11.000Z' }] },
          };
        }
        throw new Error(`unexpected request ${method} ${path}`);
      },
    };
    const result = await c.run(ctx);
    assert.equal(result, null, `expected pass, got: ${result}`);
    assert.equal(calls.length, 3);
  });

  it('returns a step-1 failure when /api/session does not return 200', async () => {
    const c = findLeaderboardSequence();
    const result = await c.run({
      baseUrl: 'https://example.test',
      expectedVersion: 'sha-1',
      httpRequest: async () => ({ status: 503, body: '', json: null }),
    });
    assert.match(result ?? '', /step 1.*HTTP 503/);
  });

  it('returns a step-1 failure when /api/session response is missing sessionId', async () => {
    const c = findLeaderboardSequence();
    const result = await c.run({
      baseUrl: 'https://example.test',
      expectedVersion: 'sha-1',
      httpRequest: async () => ({ status: 200, body: '{}', json: { startedAt: '2026-05-13T00:00:00.000Z' } }),
    });
    assert.match(result ?? '', /step 1.*sessionId/);
  });

  it('returns a step-2 failure when /api/score returns 409 already_consumed', async () => {
    const c = findLeaderboardSequence();
    const result = await c.run({
      baseUrl: 'https://example.test',
      expectedVersion: 'sha-1',
      async httpRequest({ path }) {
        if (path === '/api/session') {
          return { status: 200, body: '', json: { sessionId: 's', startedAt: '2026-05-13T00:00:00.000Z' } };
        }
        return { status: 409, body: '{"error":"already_consumed"}', json: { error: 'already_consumed' } };
      },
    });
    assert.match(result ?? '', /step 2.*HTTP 409/);
  });

  it('returns a step-3 failure when /api/leaderboard returns non-200', async () => {
    const c = findLeaderboardSequence();
    const result = await c.run({
      baseUrl: 'https://example.test',
      expectedVersion: 'sha-1',
      async httpRequest({ path }) {
        if (path === '/api/session') {
          return { status: 200, body: '', json: { sessionId: 's', startedAt: '2026-05-13T00:00:00.000Z' } };
        }
        if (path === '/api/score') {
          return { status: 200, body: '', json: { status: 'accepted' } };
        }
        return { status: 500, body: '', json: null };
      },
    });
    assert.match(result ?? '', /step 3.*HTTP 500/);
  });

  it('returns a step-3 failure when /api/leaderboard response is missing entries array', async () => {
    const c = findLeaderboardSequence();
    const result = await c.run({
      baseUrl: 'https://example.test',
      expectedVersion: 'sha-1',
      async httpRequest({ path }) {
        if (path === '/api/session') {
          return { status: 200, body: '', json: { sessionId: 's', startedAt: '2026-05-13T00:00:00.000Z' } };
        }
        if (path === '/api/score') {
          return { status: 200, body: '', json: { status: 'accepted' } };
        }
        return { status: 200, body: '{}', json: { period: 'all' } };
      },
    });
    assert.match(result ?? '', /step 3.*entries/);
  });
});
