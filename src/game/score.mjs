export const HIGH_SCORE_KEY = 'subInvadersHighScore';

function resolveStorage(storage) {
  if (storage !== undefined) {
    return storage;
  }

  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function parseStoredScore(value) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  const raw = typeof value === 'string' ? value.trim() : value;

  if (typeof raw === 'string' && !/^\d+$/.test(raw)) {
    return undefined;
  }

  const score = Number(raw);
  return Number.isInteger(score) && score >= 0 ? score : undefined;
}

function coerceWritableScore(value) {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    return undefined;
  }

  return Math.max(0, Math.floor(score));
}

export function getHighScore({ storage } = {}) {
  try {
    const target = resolveStorage(storage);

    if (!target || typeof target.getItem !== 'function') {
      return 0;
    }

    return parseStoredScore(target.getItem(HIGH_SCORE_KEY)) ?? 0;
  } catch {
    return 0;
  }
}

export function setHighScore(value, { storage } = {}) {
  try {
    const score = coerceWritableScore(value);

    if (score === undefined) {
      return;
    }

    const target = resolveStorage(storage);

    if (!target || typeof target.setItem !== 'function') {
      return;
    }

    target.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // High-score persistence is best-effort only.
  }
}
