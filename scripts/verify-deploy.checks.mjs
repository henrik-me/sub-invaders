/**
 * scripts/verify-deploy.checks.mjs — Sub Invaders post-deploy check definitions.
 *
 * Wired per CS02 Deliverable 9 / Acceptance criterion 11: the verify-deploy
 * scaffold must probe the frontend root (now serves the playable game, not the
 * CS01 stub) AND keep `/api/health` green that CS01 added.
 *
 * The two project-specific concerns these checks encode:
 *   1. Frontend root returns HTTP 200 AND the body contains markers proving it
 *      is the CS02+ game host (canvas#game-canvas plus the "Sub Invaders"
 *      title). A bare 200 is not enough — a stale CS01 stub would also return
 *      200, so we sniff the body to detect a regression.
 *   2. `/api/health` returns HTTP 200 with a non-empty body. The Functions
 *      worker returns a short JSON or text payload; we don't assert shape here
 *      because that is owned by the Function under `../api/`.
 *   3. The sprite sheet served from `/public/sprites.png` returns HTTP 200 and
 *      a non-empty body. CS02 introduced this asset and a missed SWA upload
 *      manifested as a 404 in pre-merge testing (resolved by `git mv public
 *      src/public`); the check guards against future regressions of that fix.
 *
 * The version / deploy-info checks from the example file are intentionally
 * deferred to CS03 when the backend exposes `/api/version` and
 * `/api/deploy-info`. To run only these CS02 checks against a deploy:
 *
 *   node scripts/verify-deploy.mjs --url <base> --expected-version <sha> \
 *     --checks frontend-root,health,sprites
 *
 * @typedef {{ expectedVersion: string, baseUrl: string }} CheckContext
 * @module scripts/verify-deploy.checks.mjs
 */

const checks = [
  {
    name: 'frontend-root',
    path: '/',
    expect: {
      status: 200,
      body: (text) => {
        if (typeof text !== 'string' || text.length === 0) {
          return 'response body is empty';
        }
        if (!/<canvas[^>]+id=["']game-canvas["']/i.test(text)) {
          return 'response body does not contain the expected #game-canvas element (CS01 stub may still be deployed)';
        }
        if (!/Sub\s*Invaders/i.test(text)) {
          return 'response body does not contain the "Sub Invaders" title marker';
        }
        return null;
      },
    },
  },
  {
    name: 'health',
    path: '/api/health',
    expect: {
      status: 200,
      body: (text) => {
        if (typeof text !== 'string' || text.length === 0) {
          return 'health response body is empty';
        }
        return null;
      },
    },
  },
  {
    name: 'sprites',
    path: '/public/sprites.png',
    expect: {
      status: 200,
      body: (text) => {
        if (typeof text !== 'string' || text.length === 0) {
          return 'sprite sheet response body is empty';
        }
        return null;
      },
    },
  },
  {
    /**
     * CS03/D13 — state-carrying probe:
     *   POST /api/session → POST /api/score (with sessionId) → GET /api/leaderboard?period=all.
     * Each step rejects the entire check on failure so reviewers see exactly which step broke.
     */
    name: 'leaderboard-sequence',
    async run(ctx) {
      const { httpRequest, baseUrl } = ctx;
      if (typeof httpRequest !== 'function') {
        return 'leaderboard-sequence: httpRequest is unavailable (verify-deploy version mismatch)';
      }

      // Step 1: POST /api/session
      const sessionResponse = await httpRequest({
        baseUrl,
        path: '/api/session',
        method: 'POST',
      });
      if (sessionResponse.status !== 200) {
        return `step 1 (POST /api/session): HTTP ${sessionResponse.status} (expected 200)`;
      }
      const session = sessionResponse.json;
      if (!session || typeof session.sessionId !== 'string' || typeof session.startedAt !== 'string') {
        return 'step 1 (POST /api/session): malformed response — missing sessionId or startedAt';
      }

      // Step 2: POST /api/score
      // finishedAt must be after startedAt (server enforces a minimum run duration).
      const startedAtMs = Date.parse(session.startedAt);
      if (!Number.isFinite(startedAtMs)) {
        return 'step 1 (POST /api/session): startedAt is not a valid ISO-8601 timestamp';
      }
      const finishedAt = new Date(startedAtMs + 11_000).toISOString();
      const probeScore = 1; // intentionally tiny so it never tops the leaderboard
      const scoreResponse = await httpRequest({
        baseUrl,
        path: '/api/score',
        method: 'POST',
        body: JSON.stringify({ sessionId: session.sessionId, score: probeScore, finishedAt }),
      });
      if (scoreResponse.status !== 200) {
        return `step 2 (POST /api/score): HTTP ${scoreResponse.status} (expected 200) — body: ${scoreResponse.body.slice(0, 200)}`;
      }
      if (scoreResponse.json?.status !== 'accepted') {
        return `step 2 (POST /api/score): response.status is "${scoreResponse.json?.status}" (expected "accepted")`;
      }

      // Step 3: GET /api/leaderboard?period=all
      const leaderboardResponse = await httpRequest({
        baseUrl,
        path: '/api/leaderboard?period=all',
        method: 'GET',
      });
      if (leaderboardResponse.status !== 200) {
        return `step 3 (GET /api/leaderboard?period=all): HTTP ${leaderboardResponse.status} (expected 200)`;
      }
      const leaderboard = leaderboardResponse.json;
      if (!leaderboard || !Array.isArray(leaderboard.entries)) {
        return 'step 3 (GET /api/leaderboard?period=all): response missing entries array';
      }
      if (leaderboard.period !== 'all') {
        return `step 3 (GET /api/leaderboard?period=all): response.period is "${leaderboard.period}" (expected "all")`;
      }

      return null;
    },
  },
];

export default checks;
