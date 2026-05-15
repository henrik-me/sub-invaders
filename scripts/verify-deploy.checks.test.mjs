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

  it('sprites validator rejects empty body and accepts non-empty payload', () => {
    const c = checks.find((x) => x.name === 'sprites');
    assert.ok(c.expect.body, 'sprites must define a body validator');
    assert.notEqual(c.expect.body('', { baseUrl: '', expectedVersion: 'x' }), null);
    assert.equal(c.expect.body('non-empty payload', { baseUrl: '', expectedVersion: 'x' }), null);
  });

  it('health validator (Issue #52) rejects empty, non-JSON, missing-commit, and "unknown" responses', () => {
    const c = checks.find((x) => x.name === 'health');
    assert.ok(c.expect.body, 'health must define a body validator');
    const ctx = { baseUrl: '', expectedVersion: 'x' };
    assert.notEqual(c.expect.body('', ctx), null, 'rejects empty body');
    assert.notEqual(c.expect.body('non-empty payload', ctx), null, 'rejects non-JSON body');
    assert.notEqual(c.expect.body('{"status":"ok"}', ctx), null, 'rejects body without commit field');
    assert.notEqual(
      c.expect.body('{"status":"ok","commit":"unknown"}', ctx),
      null,
      'rejects commit:"unknown" (BUILD_COMMIT was not propagated)'
    );
  });

  it('health validator accepts a valid commit and (when --expected-version is hex) enforces prefix match', () => {
    const c = checks.find((x) => x.name === 'health');
    // No expected version → just confirms commit is populated and non-"unknown".
    assert.equal(
      c.expect.body('{"commit":"abc1234"}', { baseUrl: '', expectedVersion: '' }),
      null
    );
    // Expected version is non-hex (e.g., a tag like "v1.0.0") → no prefix comparison.
    assert.equal(
      c.expect.body('{"commit":"abc1234"}', { baseUrl: '', expectedVersion: 'v1.0.0' }),
      null
    );
    // Expected version matches commit prefix (case-insensitive).
    assert.equal(
      c.expect.body(
        '{"commit":"abc1234"}',
        { baseUrl: '', expectedVersion: 'ABC1234567890fedcba0987654321abcdef01234' }
      ),
      null
    );
    // Expected version mismatch fails.
    assert.notEqual(
      c.expect.body(
        '{"commit":"abc1234"}',
        { baseUrl: '', expectedVersion: 'def56780000000000000000000000000000000ab' }
      ),
      null,
      'mismatch must fail'
    );
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

  it('passes when all three CS03 endpoints behave per contract and the probe row appears', async () => {
    const c = findLeaderboardSequence();
    const calls = [];
    // Step 1's startedAt = T0; probe sets finishedAt = T0 + 11 s and probeScore = 500.
    const startedAt = '2026-05-13T00:00:00.000Z';
    const finishedAt = '2026-05-13T00:00:11.000Z';
    const probeScore = 500;
    const ctx = {
      baseUrl: 'https://example.test',
      expectedVersion: 'sha-1',
      async httpRequest({ path, method, body }) {
        calls.push({ path, method, body });
        if (path === '/api/session' && method === 'POST') {
          return {
            status: 200,
            body: '',
            json: { sessionId: 'seq-1', nonce: 'nn', startedAt },
          };
        }
        if (path === '/api/score' && method === 'POST') {
          return {
            status: 200,
            body: '',
            json: { status: 'accepted', score: probeScore, submissionId: 'sub-1' },
          };
        }
        if (path === '/api/leaderboard?period=all') {
          return {
            status: 200,
            body: '',
            json: {
              period: 'all',
              entries: [{ rank: 1, score: probeScore, finishedAt }],
            },
          };
        }
        throw new Error(`unexpected request ${method} ${path}`);
      },
    };
    const result = await c.run(ctx);
    assert.equal(result, null, `expected pass, got: ${result}`);
    assert.equal(calls.length, 3);
    // The score POST must carry the probe score and the unique finishedAt.
    const scoreCall = calls.find((c) => c.path === '/api/score');
    const scorePayload = JSON.parse(scoreCall.body);
    assert.equal(scorePayload.score, probeScore);
    assert.equal(scorePayload.finishedAt, finishedAt);
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

  // CS03/D13 — exit criterion 7 regression guard. The probe must fail loudly when
  // /api/score returns "accepted" but the row is missing from the leaderboard
  // top-100 window. Without this guard, a backend that silently skipped persistence
  // (e.g. storage misconfiguration, table not provisioned, swallowed exception)
  // would pass the deployed smoke check.
  it('returns a step-4 failure when the probe row is absent from the leaderboard (sparse board)', async () => {
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
        // Sparse leaderboard (only some unrelated rows) — the probe row should be
        // here but isn't. This is the canonical "score endpoint lied" scenario.
        return {
          status: 200,
          body: '',
          json: {
            period: 'all',
            entries: [
              { rank: 1, score: 9999, finishedAt: '2026-05-12T00:00:00.000Z' },
              { rank: 2, score: 1234, finishedAt: '2026-05-12T01:00:00.000Z' },
            ],
          },
        };
      },
    });
    assert.match(result ?? '', /step 4.*persistence.*not found/);
    assert.match(result ?? '', /score=500/);
    assert.match(result ?? '', /2 entries/);
  });

  it('returns a step-4 failure when the probe row is absent from a saturated leaderboard', async () => {
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
        // Saturated top-100 with all scores > probe (probe=500). The probe row
        // would be trimmed; the failure message should call this out so operators
        // can choose between bumping the probe score or wiring a by-id endpoint.
        const entries = Array.from({ length: 100 }, (_, i) => ({
          rank: i + 1,
          score: 1000 + i,
          finishedAt: `2026-05-12T00:${String(i).padStart(2, '0')}:00.000Z`,
        }));
        return { status: 200, body: '', json: { period: 'all', entries } };
      },
    });
    assert.match(result ?? '', /step 4.*persistence.*not found/);
    assert.match(result ?? '', /top-100 capacity.*lowest score 1000/);
  });
});
