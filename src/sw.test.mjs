import assert from 'node:assert/strict';
import test from 'node:test';

const sw = await import('./sw.mjs');

class FakeResponse {
  constructor(body = '', { ok = true, status = 200, label = body } = {}) {
    this.body = body;
    this.ok = ok;
    this.status = status;
    this.label = label;
    this.cloneCount = 0;
  }

  clone() {
    this.cloneCount += 1;
    return new FakeResponse(this.body, {
      ok: this.ok,
      status: this.status,
      label: `${this.label}:clone`,
    });
  }
}

class FakeCache {
  constructor({ failingAssets = new Set() } = {}) {
    this.added = [];
    this.addAllCalls = [];
    this.entries = new Map();
    this.matched = [];
    this.puts = [];
    this.failingAssets = failingAssets;
  }

  keyFor(request) {
    if (typeof request === 'string') {
      return request;
    }

    return new URL(request.url, 'https://sub-invaders.local').pathname;
  }

  async add(asset) {
    this.added.push(asset);

    if (this.failingAssets.has(asset)) {
      throw new Error(`asset failed: ${asset}`);
    }

    this.entries.set(asset, new FakeResponse(asset, { label: `cached:${asset}` }));
  }

  async addAll(assets) {
    this.addAllCalls.push([...assets]);

    for (const asset of assets) {
      await this.add(asset);
    }
  }

  async match(request) {
    this.matched.push(request);
    return this.entries.get(this.keyFor(request));
  }

  async put(request, response) {
    this.puts.push({ request, response });
    this.entries.set(this.keyFor(request), response);
  }
}

function createCaches(initial = {}) {
  const stores = new Map(Object.entries(initial));
  const deleted = [];

  return {
    stores,
    deleted,
    async open(name) {
      if (!stores.has(name)) {
        stores.set(name, new FakeCache());
      }

      return stores.get(name);
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      deleted.push(name);
      return stores.delete(name);
    },
  };
}

function createRequest(path, { method = 'GET', origin = 'https://sub-invaders.local' } = {}) {
  return {
    method,
    url: path.startsWith('http') ? path : `${origin}${path}`,
  };
}

function createFetchSpy({ response, fail = false } = {}) {
  const calls = [];
  const fetchSpy = async (request) => {
    calls.push(request);

    if (fail) {
      throw new Error('network failed');
    }

    return response ?? new FakeResponse('network', { label: 'network' });
  };

  fetchSpy.calls = calls;
  return fetchSpy;
}

test('sw.mjs imports cleanly in Node and exposes constants', () => {
  assert.equal(sw.BUILD_SHA, '__BUILD_SHA__');
  assert.equal(sw.CACHE_PREFIX, 'sub-invaders-');
  assert.equal(sw.CACHE_NAME, 'sub-invaders-__BUILD_SHA__');
  assert.deepEqual(sw.ASSET_ALLOWLIST, [
    '/',
    '/index.html',
    '/dist/main.mjs',
    '/dist/main.mjs.map',
    '/public/sprites.png',
    '/public/sprites.licence',
  ]);
});

test('onInstall precaches the static allowlist one asset at a time', async () => {
  const cache = new FakeCache();
  const caches = createCaches({ current: cache });

  await sw.onInstall({ caches, cacheName: 'current' });

  assert.deepEqual(cache.added, sw.ASSET_ALLOWLIST);
  assert.equal(cache.entries.size, sw.ASSET_ALLOWLIST.length);
});

test('onInstall tolerates a failing asset without rejecting', async () => {
  const cache = new FakeCache({ failingAssets: new Set(['/dist/main.mjs.map']) });
  const caches = createCaches({ current: cache });

  await assert.doesNotReject(sw.onInstall({ caches, cacheName: 'current' }));
  assert.deepEqual(cache.added, sw.ASSET_ALLOWLIST);
  assert.equal(cache.entries.has('/dist/main.mjs.map'), false);
});

test('onActivate deletes stale sub-invaders caches and keeps current cache', async () => {
  const current = new FakeCache();
  const stale = new FakeCache();
  const unrelated = new FakeCache();
  const caches = createCaches({
    'sub-invaders-old': stale,
    'sub-invaders-new': current,
    'other-cache': unrelated,
  });

  await sw.onActivate({ caches, cacheName: 'sub-invaders-new' });

  assert.deepEqual(caches.deleted, ['sub-invaders-old']);
  assert.deepEqual(await caches.keys(), ['sub-invaders-new', 'other-cache']);
});

test('onFetch returns cached allowlisted assets without calling fetch', async () => {
  const cache = new FakeCache();
  const cached = new FakeResponse('cached-main', { label: 'cached-main' });
  const request = createRequest('/dist/main.mjs');
  cache.entries.set('/dist/main.mjs', cached);
  const caches = createCaches({ current: cache });
  const fetchSpy = createFetchSpy();

  const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

  assert.equal(response, cached);
  assert.equal(fetchSpy.calls.length, 0);
  assert.deepEqual(cache.matched, [request]);
});

test('onFetch fetches and caches allowlisted assets on cache miss', async () => {
  const cache = new FakeCache();
  const caches = createCaches({ current: cache });
  const request = createRequest('/public/sprites.png');
  const networkResponse = new FakeResponse('sprites', { label: 'sprites' });
  const fetchSpy = createFetchSpy({ response: networkResponse });

  const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

  assert.equal(response, networkResponse);
  assert.deepEqual(fetchSpy.calls, [request]);
  assert.equal(networkResponse.cloneCount, 1);
  assert.equal(cache.puts.length, 1);
  assert.equal(cache.entries.get('/public/sprites.png').label, 'sprites:clone');
});

test('onFetch is network-only for api requests', async () => {
  const cache = new FakeCache();
  const caches = createCaches({ current: cache });
  const request = createRequest('/api/score');
  const networkResponse = new FakeResponse('api', { label: 'api' });
  const fetchSpy = createFetchSpy({ response: networkResponse });

  const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

  assert.equal(response, networkResponse);
  assert.deepEqual(fetchSpy.calls, [request]);
  assert.deepEqual(cache.matched, []);
});

test('onFetch is network-only for cross-origin requests', async () => {
  const cache = new FakeCache();
  const caches = createCaches({ current: cache });
  const request = createRequest('https://cdn.example.test/public/sprites.png');
  const networkResponse = new FakeResponse('cdn', { label: 'cdn' });
  const fetchSpy = createFetchSpy({ response: networkResponse });

  const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

  assert.equal(response, networkResponse);
  assert.deepEqual(fetchSpy.calls, [request]);
  assert.deepEqual(cache.matched, []);
});

test('onFetch returns a cached allowlisted asset when fetch fails after a miss', async () => {
  const cache = new FakeCache();
  const request = createRequest('/index.html');
  const lateCached = new FakeResponse('late-cached', { label: 'late-cached' });
  let matchCount = 0;
  cache.match = async () => {
    matchCount += 1;
    return matchCount === 1 ? undefined : lateCached;
  };
  const caches = createCaches({ current: cache });
  const fetchSpy = createFetchSpy({ fail: true });

  const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

  assert.equal(response, lateCached);
  assert.equal(fetchSpy.calls.length, 1);
});

test('onFetch never throws on network failure and returns a graceful fallback', async () => {
  const caches = createCaches({ current: new FakeCache() });
  const request = createRequest('/api/session');
  const fetchSpy = createFetchSpy({ fail: true });

  const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

  assert.equal(fetchSpy.calls.length, 1);
  assert.equal(response.status, 503);
});

test('registerServiceWorker wires install/activate/fetch and delegates to handlers', async () => {
  const cache = new FakeCache();
  const caches = createCaches({ 'sub-invaders-__BUILD_SHA__': cache });
  const listeners = {};
  const calls = [];
  const scope = {
    caches,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => { calls.push('skipWaiting'); },
    clients: { claim: async () => { calls.push('claim'); } },
    fetch: async () => new FakeResponse('net', { label: 'net' }),
  };

  sw.registerServiceWorker(scope);
  assert.deepEqual(Object.keys(listeners).sort(), ['activate', 'fetch', 'install']);

  let installP;
  listeners.install({ waitUntil: (p) => { installP = p; } });
  await installP;
  assert.ok(calls.includes('skipWaiting'));
  assert.deepEqual(cache.added, sw.ASSET_ALLOWLIST);

  let activateP;
  listeners.activate({ waitUntil: (p) => { activateP = p; } });
  await activateP;
  assert.ok(calls.includes('claim'));

  let respondedP = null;
  listeners.fetch({
    request: createRequest('/index.html'),
    respondWith: (p) => { respondedP = p; },
  });
  assert.ok(respondedP);
  await respondedP;

  let respondedNonGet = false;
  listeners.fetch({
    request: createRequest('/api/score', { method: 'POST' }),
    respondWith: () => { respondedNonGet = true; },
  });
  assert.equal(respondedNonGet, false);
});

test('registerServiceWorker falls back to global fetch when scope.fetch is absent', () => {
  const listeners = {};
  const scope = {
    caches: createCaches(),
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };

  assert.doesNotThrow(() => sw.registerServiceWorker(scope));
  assert.equal(typeof listeners.fetch, 'function');
});

test('onFetch falls back to network when the cache cannot be opened', async () => {
  const caches = {
    async open() { throw new Error('cache unavailable'); },
    async keys() { return []; },
    async delete() { return false; },
  };
  const request = createRequest('/index.html');
  const fetchSpy = createFetchSpy({ response: new FakeResponse('net', { label: 'net' }) });

  const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

  assert.equal(response.label, 'net');
  assert.equal(fetchSpy.calls.length, 1);
});

test('onFetch still returns the network response when caching it fails', async () => {
  const cache = new FakeCache();
  cache.put = async () => { throw new Error('quota exceeded'); };
  const caches = createCaches({ current: cache });
  const request = createRequest('/index.html');
  const networkResponse = new FakeResponse('fresh', { label: 'fresh' });
  const fetchSpy = createFetchSpy({ response: networkResponse });

  const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

  assert.equal(response, networkResponse);
});

test('onFetch is network-only for non-GET requests', async () => {
  const caches = createCaches({ current: new FakeCache() });
  const request = createRequest('/index.html', { method: 'POST' });
  const networkResponse = new FakeResponse('posted', { label: 'posted' });
  const fetchSpy = createFetchSpy({ response: networkResponse });

  const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

  assert.equal(response, networkResponse);
  assert.deepEqual(fetchSpy.calls, [request]);
});

test('onFetch is network-only for same-origin GETs outside the allowlist', async () => {
  const cache = new FakeCache();
  const caches = createCaches({ current: cache });
  const request = createRequest('/not-cached.js');
  const networkResponse = new FakeResponse('dynamic', { label: 'dynamic' });
  const fetchSpy = createFetchSpy({ response: networkResponse });

  const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

  assert.equal(response, networkResponse);
  assert.deepEqual(fetchSpy.calls, [request]);
  assert.deepEqual(cache.matched, []);
});

test('onFetch tolerates a cache.match failure and falls through to network', async () => {
  const cache = new FakeCache();
  cache.match = async () => { throw new Error('match failed'); };
  const caches = createCaches({ current: cache });
  const request = createRequest('/index.html');
  const networkResponse = new FakeResponse('after-match-fail', { label: 'after-match-fail' });
  const fetchSpy = createFetchSpy({ response: networkResponse });

  const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

  assert.equal(response, networkResponse);
  assert.equal(fetchSpy.calls.length, 1);
});

test('onInstall uses addAll when a cache has no add method', async () => {
  const addAllCalls = [];
  const addAllOnlyCache = {
    addAll: async (assets) => { addAllCalls.push([...assets]); },
  };
  const caches = createCaches({ current: addAllOnlyCache });

  await sw.onInstall({ caches, cacheName: 'current' });

  assert.equal(addAllCalls.length, sw.ASSET_ALLOWLIST.length);
});

test('onFetch resolves the origin from global location when self.location is absent', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'location');
  globalThis.location = { origin: 'https://loc.example' };

  try {
    const cache = new FakeCache();
    const cached = new FakeResponse('loc-cached', { label: 'loc-cached' });
    cache.entries.set('/index.html', cached);
    const caches = createCaches({ current: cache });
    const request = { method: 'GET', url: 'https://loc.example/index.html' };
    const fetchSpy = createFetchSpy();

    const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

    assert.equal(response, cached);
    assert.equal(fetchSpy.calls.length, 0);
  } finally {
    if (original) {
      Object.defineProperty(globalThis, 'location', original);
    } else {
      delete globalThis.location;
    }
  }
});

test('onFetch serves an allowlisted asset regardless of the query string (ignoreSearch)', async () => {
  const cachedRoot = new FakeResponse('root', { label: 'root' });
  // A query-sensitive cache: only an ignoreSearch match resolves `/?mode=...` to `/`.
  const cache = {
    async match(request, opts) {
      const url = new URL(typeof request === 'string' ? request : request.url, 'https://sub-invaders.local');
      const key = opts?.ignoreSearch ? url.pathname : `${url.pathname}${url.search}`;
      return key === '/' ? cachedRoot : undefined;
    },
    async put() {},
  };
  const caches = createCaches({ current: cache });
  const request = createRequest('/?mode=practice');
  const fetchSpy = createFetchSpy();

  const response = await sw.onFetch(request, { caches, cacheName: 'current', fetch: fetchSpy });

  assert.equal(response, cachedRoot);
  assert.equal(fetchSpy.calls.length, 0);
});
