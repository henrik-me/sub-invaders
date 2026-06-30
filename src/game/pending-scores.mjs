export const PENDING_SCORES_KEY = 'subInvadersPendingScores';
export const CAP = 20;

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

function normalizeEntry(entry, now) {
  if (!entry || typeof entry !== 'object') {
    return undefined;
  }

  const { sessionId, finishedAt } = entry;
  const score = Number(entry.score);
  const queuedAt = entry.queuedAt === undefined ? now() : Number(entry.queuedAt);
  const invalid =
    typeof sessionId !== 'string' ||
    sessionId.trim() === '' ||
    !Number.isInteger(score) ||
    score < 0 ||
    typeof finishedAt !== 'string' ||
    finishedAt.trim() === '' ||
    !Number.isFinite(queuedAt) ||
    queuedAt < 0;

  if (invalid) {
    return undefined;
  }

  return { sessionId, score, finishedAt, queuedAt: Math.floor(queuedAt) };
}

function isPendingEntry(entry) {
  return entry?.queuedAt !== undefined && normalizeEntry(entry, Date.now) !== undefined;
}

function save(queue, { storage } = {}) {
  try {
    const target = resolveStorage(storage);

    if (target && typeof target.setItem === 'function') {
      target.setItem(PENDING_SCORES_KEY, JSON.stringify(queue));
    }
  } catch {
    // Pending-score persistence is best-effort; gameplay must not fail on storage errors.
  }
}

export function read(opts = {}) {
  try {
    const target = resolveStorage(opts.storage);
    if (!target || typeof target.getItem !== 'function') {
      return [];
    }

    const value = target.getItem(PENDING_SCORES_KEY);
    if (value === null || value === undefined || value === '') {
      return [];
    }

    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every(isPendingEntry)) {
      save([], opts);
      return [];
    }

    return parsed.map((entry) => ({ ...entry }));
  } catch {
    save([], opts);
    return [];
  }
}

export function peek(opts = {}) {
  return read(opts).map((entry) => ({ ...entry }));
}

export function enqueue(entry, opts = {}) {
  const now = typeof opts.now === 'function' ? opts.now : Date.now;
  const queue = read(opts);
  const normalized = normalizeEntry(entry, now);
  if (normalized === undefined) {
    return queue.length;
  }

  queue.push(normalized);
  while (queue.length > CAP) {
    queue.shift();
  }

  save(queue, opts);
  return queue.length;
}

function isPermanentlyDead(error) {
  return (
    (error?.status === 409 && error?.code === 'session-consumed') ||
    (error?.status === 400 && error?.code === 'expired')
  );
}

function droppedNote(entry, error) {
  const reason = error.code === 'session-consumed' ? 'already submitted' : 'expired';
  return `Ranked score ${entry.score} for session ${entry.sessionId} was dropped: ${reason}.`;
}

export async function drain(submitFn, opts = {}) {
  const queue = read(opts);
  const remaining = [];
  const notes = [];
  let submitted = 0;
  let dropped = 0;
  let stopped = false;

  for (const entry of queue) {
    if (stopped) {
      remaining.push(entry);
      continue;
    }

    try {
      await submitFn(entry);
      submitted += 1;
    } catch (error) {
      if (isPermanentlyDead(error)) {
        dropped += 1;
        notes.push(droppedNote(entry, error));
        continue;
      }

      stopped = true;
      remaining.push(entry);
    }
  }

  save(remaining, opts);
  return { submitted, dropped, remaining: remaining.length, notes };
}
