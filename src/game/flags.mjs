// CS04 D5 / CS04-11 — frontend feature flag delivery.
//
// Flag resolution order (CS04-11):
//   1. HTML <meta name="flags" content="key1=value1; key2=value2"> default.
//   2. GET /api/health response body's `flags` object overrides defaults.
//   3. On fetch failure or timeout, fall back to (1).
//
// fetchFlags() is called once at boot from main.mjs (row 10) BEFORE pushing
// the menu scene so the daily option's visibility is decided up front.

export const FLAG_FETCH_TIMEOUT_MS = 1500;

export const HEALTH_ENDPOINT = '/api/health';

export function parseMetaFlags(metaContent) {
  const out = {};
  if (typeof metaContent !== 'string' || metaContent.trim() === '') return out;
  for (const part of metaContent.split(/[;,]/)) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key === '') continue;
    out[key] = value;
  }
  return out;
}

export function readDefaultFlags(documentRef) {
  const doc = documentRef ?? (typeof document !== 'undefined' ? document : null);
  if (!doc || typeof doc.querySelector !== 'function') return {};
  const meta = doc.querySelector('meta[name="flags"]');
  if (!meta) return {};
  return parseMetaFlags(meta.getAttribute('content'));
}

function mergeFlags(defaults, overrides) {
  return { ...defaults, ...overrides };
}

export async function fetchFlags({
  documentRef,
  fetchImpl,
  timeoutMs = FLAG_FETCH_TIMEOUT_MS,
  endpoint = HEALTH_ENDPOINT,
} = {}) {
  const defaults = readDefaultFlags(documentRef);
  const fetcher = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetcher) return defaults;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller && timeoutMs > 0
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const res = await fetcher(endpoint, controller ? { signal: controller.signal } : undefined);
    if (!res || !res.ok) return defaults;
    const body = await res.json().catch(() => null);
    if (!body || typeof body !== 'object') return defaults;
    const overrides = body.flags && typeof body.flags === 'object' ? body.flags : {};
    return mergeFlags(defaults, overrides);
  } catch {
    return defaults;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export function isDailyChallengeEnabled(flags) {
  return flags?.dailyChallenge === 'on';
}
