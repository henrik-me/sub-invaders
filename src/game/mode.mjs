export const MODES = Object.freeze({
  RANKED: 'ranked',
  PRACTICE: 'practice',
});

export const LAST_MODE_KEY = 'subInvadersLastMode';

const VALID_MODES = new Set(Object.values(MODES));

function isValidMode(mode) {
  return VALID_MODES.has(mode);
}

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

function resolveSearch({ search, url } = {}) {
  if (search !== undefined) {
    return search;
  }

  if (url !== undefined) {
    return readSearchFromUrl(url);
  }

  try {
    return readSearchFromUrl(globalThis.location);
  } catch {
    return undefined;
  }
}

function readSearchFromUrl(url) {
  try {
    if (typeof url === 'string') {
      return new URL(url, 'http://sub-invaders.local').search;
    }

    if (url && typeof url.search === 'string') {
      return url.search;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function modeFromSearch(search) {
  try {
    if (typeof search !== 'string') {
      return undefined;
    }

    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    const mode = params.get('mode');
    return isValidMode(mode) ? mode : undefined;
  } catch {
    return undefined;
  }
}

function modeFromStorage(storage) {
  try {
    const target = resolveStorage(storage);

    if (!target || typeof target.getItem !== 'function') {
      return undefined;
    }

    const mode = target.getItem(LAST_MODE_KEY);
    return isValidMode(mode) ? mode : undefined;
  } catch {
    return undefined;
  }
}

export function readUrlMode(opts = {}) {
  return modeFromSearch(resolveSearch(opts));
}

export function getMode(opts = {}) {
  return modeFromStorage(opts.storage) ?? MODES.RANKED;
}

export function setMode(mode, { storage } = {}) {
  if (!isValidMode(mode)) {
    return;
  }

  try {
    const target = resolveStorage(storage);

    if (!target || typeof target.setItem !== 'function') {
      return;
    }

    target.setItem(LAST_MODE_KEY, mode);
  } catch {
    // Mode persistence is best-effort; gameplay still has a safe ranked default.
  }
}

export function isRanked(opts = {}) {
  return getMode(opts) === MODES.RANKED;
}

export function isPractice(opts = {}) {
  return getMode(opts) === MODES.PRACTICE;
}
