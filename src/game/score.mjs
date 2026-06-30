export const HIGH_SCORE_KEY = 'subInvadersHighScore';
export const PRACTICE_HIGH_SCORE_KEY = 'subInvadersPracticeHighScore';

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

function highScoreKeyFor(mode) {
  return mode === 'practice' ? PRACTICE_HIGH_SCORE_KEY : HIGH_SCORE_KEY;
}

export function getHighScoreFor(mode, { storage } = {}) {
  try {
    const target = resolveStorage(storage);

    if (!target || typeof target.getItem !== 'function') {
      return 0;
    }

    return parseStoredScore(target.getItem(highScoreKeyFor(mode))) ?? 0;
  } catch {
    return 0;
  }
}

export function setHighScoreFor(mode, value, { storage } = {}) {
  try {
    const score = coerceWritableScore(value);

    if (score === undefined) {
      return;
    }

    const target = resolveStorage(storage);

    if (!target || typeof target.setItem !== 'function') {
      return;
    }

    target.setItem(highScoreKeyFor(mode), String(score));
  } catch {
    // High-score persistence is best-effort only.
  }
}

export function getHighScore({ storage } = {}) {
  return getHighScoreFor('ranked', { storage });
}

export function setHighScore(value, { storage } = {}) {
  setHighScoreFor('ranked', value, { storage });
}
