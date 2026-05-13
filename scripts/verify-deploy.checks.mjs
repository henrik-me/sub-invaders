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
];

export default checks;
