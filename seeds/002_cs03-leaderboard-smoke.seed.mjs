/**
 * CS03/D15 — Leaderboard smoke seed.
 *
 * Posts a deterministic smoke score to the deployed Sub Invaders backend so
 * the leaderboard has at least one row immediately after a fresh staging
 * deploy. The seed is idempotent: it asks the leaderboard for current entries
 * first and skips the insert when the marker score is already present.
 *
 * Marker score: SMOKE_SCORE (intentionally low so it cannot top the live
 * leaderboard, but unique enough to recognise on re-run).
 *
 * Usage:
 *   SUB_INVADERS_BASE_URL=https://<deploy>.azurestaticapps.net \
 *     node scripts/run-seeds.mjs --env staging --only 002_cs03 --quiet
 *
 * Reads the base URL from environment variables in priority order:
 *   1. SUB_INVADERS_BASE_URL — explicit override (recommended in CI).
 *   2. STAGING_BASE_URL      — convention used by the deploy workflow.
 */

const SMOKE_SCORE = 137; // distinctive, low enough not to dominate a real leaderboard
const RUN_DURATION_MS = 11_000; // > 10s minimum required by the server contract

function resolveBaseUrl(env) {
  const fromEnv = process.env.SUB_INVADERS_BASE_URL ?? process.env.STAGING_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, '');
  }
  throw new Error(
    `seeds/002_cs03_leaderboard_smoke: SUB_INVADERS_BASE_URL must be set for env "${env}"`,
  );
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? '' : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  if (text) {
    try { json = JSON.parse(text); } catch { /* leave json null */ }
  }
  return { status: response.status, body: text, json };
}

async function getJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let json = null;
  if (text) {
    try { json = JSON.parse(text); } catch { /* leave json null */ }
  }
  return { status: response.status, body: text, json };
}

export async function seed({ env, log }) {
  const baseUrl = resolveBaseUrl(env);

  // Step 1 — idempotency check: is the marker score already on the leaderboard?
  const probe = await getJson(`${baseUrl}/api/leaderboard?period=all`);
  if (probe.status !== 200 || !Array.isArray(probe.json?.entries)) {
    throw new Error(
      `idempotency probe failed: GET /api/leaderboard returned HTTP ${probe.status}`,
    );
  }
  if (probe.json.entries.some((row) => Number(row?.score) === SMOKE_SCORE)) {
    log(`marker score ${SMOKE_SCORE} already present in leaderboard — skipping insert`);
    return;
  }

  // Step 2 — start a session.
  const session = await postJson(`${baseUrl}/api/session`, {});
  if (session.status !== 200 || typeof session.json?.sessionId !== 'string') {
    throw new Error(
      `POST /api/session failed: HTTP ${session.status} body=${session.body.slice(0, 200)}`,
    );
  }
  const sessionId = session.json.sessionId;
  const startedAtMs = Date.parse(session.json.startedAt);
  if (!Number.isFinite(startedAtMs)) {
    throw new Error('POST /api/session returned an invalid startedAt timestamp');
  }
  log(`started session ${sessionId}`);

  // Step 3 — submit the smoke score with a finishedAt > startedAt + 10s.
  const finishedAt = new Date(startedAtMs + RUN_DURATION_MS).toISOString();
  const submission = await postJson(`${baseUrl}/api/score`, {
    sessionId,
    score: SMOKE_SCORE,
    finishedAt,
  });
  if (submission.status !== 200 || submission.json?.status !== 'accepted') {
    throw new Error(
      `POST /api/score failed: HTTP ${submission.status} body=${submission.body.slice(0, 200)}`,
    );
  }
  log(`submitted smoke score ${SMOKE_SCORE} (submissionId=${submission.json.submissionId ?? 'n/a'})`);
}
