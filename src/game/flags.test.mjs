import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FLAG_FETCH_TIMEOUT_MS,
  HEALTH_ENDPOINT,
  parseMetaFlags,
  readDefaultFlags,
  fetchFlags,
  isDailyChallengeEnabled,
} from './flags.mjs';

test('flags: HEALTH_ENDPOINT is /api/health per CS03 contract', () => {
  assert.equal(HEALTH_ENDPOINT, '/api/health');
});

test('flags: FLAG_FETCH_TIMEOUT_MS is bounded at 1500ms (CS04-11 R4 amendment)', () => {
  assert.equal(FLAG_FETCH_TIMEOUT_MS, 1500);
});

test('flags: parseMetaFlags handles single key=value', () => {
  assert.deepEqual(parseMetaFlags('dailyChallenge=off'), { dailyChallenge: 'off' });
});

test('flags: parseMetaFlags handles multiple semicolon-separated pairs', () => {
  assert.deepEqual(
    parseMetaFlags('dailyChallenge=off; experimentX=on'),
    { dailyChallenge: 'off', experimentX: 'on' },
  );
});

test('flags: parseMetaFlags returns empty object on empty/missing input', () => {
  assert.deepEqual(parseMetaFlags(''), {});
  assert.deepEqual(parseMetaFlags(null), {});
  assert.deepEqual(parseMetaFlags(undefined), {});
});

test('flags: parseMetaFlags ignores malformed pairs without "="', () => {
  assert.deepEqual(parseMetaFlags('justtext; ok=yes'), { ok: 'yes' });
});

test('flags: readDefaultFlags reads <meta name="flags">', () => {
  const doc = {
    querySelector: (sel) => {
      if (sel === 'meta[name="flags"]') {
        return { getAttribute: () => 'dailyChallenge=off' };
      }
      return null;
    },
  };
  assert.deepEqual(readDefaultFlags(doc), { dailyChallenge: 'off' });
});

test('flags: readDefaultFlags returns empty when meta element missing', () => {
  const doc = { querySelector: () => null };
  assert.deepEqual(readDefaultFlags(doc), {});
});

test('flags: fetchFlags merges /api/health flags over HTML defaults', async () => {
  const doc = {
    querySelector: () => ({ getAttribute: () => 'dailyChallenge=off; other=keep' }),
  };
  const fetchImpl = async (url) => {
    assert.equal(url, '/api/health');
    return { ok: true, json: async () => ({ flags: { dailyChallenge: 'on' } }) };
  };
  const flags = await fetchFlags({ documentRef: doc, fetchImpl });
  assert.equal(flags.dailyChallenge, 'on');
  assert.equal(flags.other, 'keep');
});

test('flags: fetchFlags falls back to defaults when health returns non-ok', async () => {
  const doc = { querySelector: () => ({ getAttribute: () => 'dailyChallenge=off' }) };
  const fetchImpl = async () => ({ ok: false, json: async () => ({}) });
  const flags = await fetchFlags({ documentRef: doc, fetchImpl });
  assert.equal(flags.dailyChallenge, 'off');
});

test('flags: fetchFlags falls back to defaults when fetch throws', async () => {
  const doc = { querySelector: () => ({ getAttribute: () => 'dailyChallenge=off' }) };
  const fetchImpl = async () => { throw new Error('network down'); };
  const flags = await fetchFlags({ documentRef: doc, fetchImpl });
  assert.equal(flags.dailyChallenge, 'off');
});

test('flags: fetchFlags falls back to defaults when JSON body is non-object', async () => {
  const doc = { querySelector: () => ({ getAttribute: () => 'dailyChallenge=off' }) };
  const fetchImpl = async () => ({ ok: true, json: async () => null });
  const flags = await fetchFlags({ documentRef: doc, fetchImpl });
  assert.equal(flags.dailyChallenge, 'off');
});

test('flags: fetchFlags falls back to defaults when JSON parse rejects', async () => {
  const doc = { querySelector: () => ({ getAttribute: () => 'dailyChallenge=off' }) };
  const fetchImpl = async () => ({ ok: true, json: async () => { throw new Error('bad json'); } });
  const flags = await fetchFlags({ documentRef: doc, fetchImpl });
  assert.equal(flags.dailyChallenge, 'off');
});

test('flags: fetchFlags ignores body.flags when not an object', async () => {
  const doc = { querySelector: () => ({ getAttribute: () => 'dailyChallenge=off' }) };
  const fetchImpl = async () => ({ ok: true, json: async () => ({ flags: 'not-an-object' }) });
  const flags = await fetchFlags({ documentRef: doc, fetchImpl });
  assert.equal(flags.dailyChallenge, 'off');
});

test('flags: fetchFlags aborts via AbortController on timeout and returns defaults', async () => {
  const doc = { querySelector: () => ({ getAttribute: () => 'dailyChallenge=off' }) };
  const fetchImpl = async (_url, init) => new Promise((_resolve, reject) => {
    if (init?.signal) {
      init.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }
    // never resolve — wait for abort.
  });
  const flags = await fetchFlags({ documentRef: doc, fetchImpl, timeoutMs: 5 });
  assert.equal(flags.dailyChallenge, 'off');
});

test('flags: fetchFlags returns defaults when fetchImpl unavailable', async () => {
  const doc = { querySelector: () => ({ getAttribute: () => 'dailyChallenge=off' }) };
  const flags = await fetchFlags({ documentRef: doc, fetchImpl: null });
  assert.equal(flags.dailyChallenge, 'off');
});

test('flags: isDailyChallengeEnabled true only when value === "on"', () => {
  assert.equal(isDailyChallengeEnabled({ dailyChallenge: 'on' }), true);
  assert.equal(isDailyChallengeEnabled({ dailyChallenge: 'off' }), false);
  assert.equal(isDailyChallengeEnabled({ dailyChallenge: 'true' }), false);
  assert.equal(isDailyChallengeEnabled({}), false);
  assert.equal(isDailyChallengeEnabled(null), false);
  assert.equal(isDailyChallengeEnabled(undefined), false);
});
