/**
 * src/game/api.mjs — Sub Invaders backend client.
 *
 * Wraps the CS03 Functions API (`/api/session`, `/api/score`, `/api/leaderboard`).
 * Browser `fetch()` only — no runtime dependencies. Errors are normalized into
 * Error subclasses so game scenes can surface predictable messages.
 */

import { isPractice as defaultIsPractice } from './mode.mjs';

const DEFAULT_BASE = '/api';
const PRACTICE_SKIP = Object.freeze({ skipped: true, reason: 'practice' });

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'unknown', cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (cause) this.cause = cause;
  }
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value >= 0;
}

function isValidUtcDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }
  const [year, month, day] = date.split('-').map(Number);
  if (year <= 0 || month <= 0 || day <= 0) {
    return false;
  }
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  roundTrip.setUTCFullYear(year);
  return roundTrip.getUTCFullYear() === year
    && roundTrip.getUTCMonth() === month - 1
    && roundTrip.getUTCDate() === day;
}

function normalizeBase(base) {
  const value = typeof base === 'string' && base.length > 0 ? base : DEFAULT_BASE;
  return value.replace(/\/+$/, '');
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new ApiError('response body is not valid JSON', {
      status: response.status,
      code: 'invalid_json',
      cause,
    });
  }
}

async function request(fetchFn, baseUrl, path, init = {}) {
  let response;
  try {
    response = await fetchFn(`${baseUrl}${path}`, init);
  } catch (cause) {
    throw new ApiError(`network error contacting ${path}`, {
      status: 0,
      code: 'network_error',
      cause,
    });
  }
  const body = await readJson(response);
  if (!response.ok) {
    const code = body?.error ?? `http_${response.status}`;
    const message = body?.message ?? `request to ${path} failed (${response.status})`;
    throw new ApiError(message, { status: response.status, code });
  }
  return body;
}

export function createApiClient(opts = {}) {
  const fetchFn = opts.fetch ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchFn !== 'function') {
    throw new Error('createApiClient: fetch is not available');
  }
  const baseUrl = normalizeBase(opts.baseUrl);
  const isPractice = opts.isPractice ?? (() => defaultIsPractice());

  async function startSession() {
    if (isPractice()) {
      return PRACTICE_SKIP;
    }

    const body = await request(fetchFn, baseUrl, '/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!body || typeof body.sessionId !== 'string' || typeof body.startedAt !== 'string') {
      throw new ApiError('startSession: malformed response', {
        code: 'malformed_response',
      });
    }
    return {
      sessionId: body.sessionId,
      nonce: body.nonce ?? '',
      startedAt: body.startedAt,
    };
  }

  async function submitScore({ sessionId, score, finishedAt, period, utcDate } = {}) {
    if (isPractice()) {
      return PRACTICE_SKIP;
    }

    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw new ApiError('submitScore: sessionId is required', { code: 'invalid_argument' });
    }
    if (!isPositiveInt(score)) {
      throw new ApiError('submitScore: score must be a non-negative integer', { code: 'invalid_argument' });
    }
    if (typeof finishedAt !== 'string' || finishedAt.length === 0) {
      throw new ApiError('submitScore: finishedAt must be ISO-8601 string', { code: 'invalid_argument' });
    }
    const payload = { sessionId, score, finishedAt };
    if (period !== undefined) {
      if (period !== 'all' && period !== 'daily') {
        throw new ApiError('submitScore: period must be "all" or "daily"', { code: 'invalid_argument' });
      }
      payload.period = period;
      if (period === 'daily') {
        if (!isValidUtcDate(utcDate)) {
          throw new ApiError('submitScore: utcDate must be YYYY-MM-DD and a real UTC date when period is "daily"', { code: 'invalid_argument' });
        }
        payload.utcDate = utcDate;
      }
    }
    return request(fetchFn, baseUrl, '/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async function getLeaderboard({ period = 'all', date } = {}) {
    if (period !== 'all' && period !== 'daily') {
      throw new ApiError('getLeaderboard: period must be "all" or "daily"', { code: 'invalid_argument' });
    }
    const params = new URLSearchParams({ period });
    if (period === 'daily') {
      if (!isValidUtcDate(date)) {
        throw new ApiError('getLeaderboard: date must be YYYY-MM-DD and a real UTC date when period is "daily"', { code: 'invalid_argument' });
      }
      params.set('date', date);
    }
    const body = await request(fetchFn, baseUrl, `/leaderboard?${params.toString()}`, {
      method: 'GET',
    });
    if (!body || !Array.isArray(body.entries)) {
      throw new ApiError('getLeaderboard: malformed response', { code: 'malformed_response' });
    }
    return {
      period: body.period ?? period,
      entries: body.entries.map((row) => ({
        rank: Number(row.rank) || 0,
        score: Number(row.score) || 0,
        finishedAt: typeof row.finishedAt === 'string' ? row.finishedAt : '',
      })),
    };
  }

  return { startSession, submitScore, getLeaderboard };
}

export const __forTesting = { normalizeBase, isPositiveInt, isValidUtcDate };
