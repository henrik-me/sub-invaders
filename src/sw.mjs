export const BUILD_SHA = '__BUILD_SHA__';
export const CACHE_PREFIX = 'sub-invaders-';
export const CACHE_NAME = CACHE_PREFIX + BUILD_SHA;
export const ASSET_ALLOWLIST = [
  '/',
  '/index.html',
  '/dist/main.mjs',
  '/dist/main.mjs.map',
  '/public/sprites.png',
  '/public/sprites.licence',
];

const FALLBACK_ORIGIN = 'https://sub-invaders.local';

function getServiceOrigin() {
  if (typeof self !== 'undefined' && self.location?.origin) {
    return self.location.origin;
  }

  if (typeof location !== 'undefined' && location.origin) {
    return location.origin;
  }

  return FALLBACK_ORIGIN;
}

function responseClone(response) {
  return typeof response?.clone === 'function' ? response.clone() : response;
}

function fallbackResponse() {
  if (typeof Response === 'function') {
    return new Response('', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }

  return {
    ok: false,
    status: 503,
    statusText: 'Service Unavailable',
  };
}

async function safeFetch(fetchFn, request) {
  try {
    return await fetchFn(request);
  } catch {
    return fallbackResponse();
  }
}

async function safeMatch(cache, request) {
  try {
    // Allowlisting is pathname-based, so match ignoring the query string:
    // otherwise an offline deep-link like `/?mode=practice` misses the cached `/`.
    return await cache.match(request, { ignoreSearch: true });
  } catch {
    return undefined;
  }
}

export async function onInstall({
  caches,
  cacheName = CACHE_NAME,
  assets = ASSET_ALLOWLIST,
}) {
  const cache = await caches.open(cacheName);

  // Cache each asset independently so one stale deploy artifact cannot brick SW install.
  await Promise.allSettled(assets.map(async (asset) => {
    if (typeof cache.add === 'function') {
      await cache.add(asset);
      return;
    }

    if (typeof cache.addAll === 'function') {
      await cache.addAll([asset]);
    }
  }));
}

export async function onActivate({
  caches,
  cacheName = CACHE_NAME,
  cachePrefix = CACHE_PREFIX,
}) {
  const names = await caches.keys();

  await Promise.all(names
    .filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
    .map((name) => caches.delete(name)));
}

export async function onFetch(request, {
  caches,
  cacheName = CACHE_NAME,
  fetch,
}) {
  try {
    if (request?.method !== 'GET') {
      return await safeFetch(fetch, request);
    }

    const serviceOrigin = getServiceOrigin();
    const url = new URL(request.url, serviceOrigin);
    const isSameOrigin = url.origin === serviceOrigin;
    const isApiRequest = url.pathname.startsWith('/api/');

    if (!isSameOrigin || isApiRequest) {
      return await safeFetch(fetch, request);
    }

    if (!ASSET_ALLOWLIST.includes(url.pathname)) {
      return await safeFetch(fetch, request);
    }

    let cache;

    try {
      cache = await caches.open(cacheName);
    } catch {
      return await safeFetch(fetch, request);
    }

    const cached = await safeMatch(cache, request);

    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(request);

      if (response?.ok) {
        try {
          await cache.put(request, responseClone(response));
        } catch {
          // The network response is still useful even if cache storage is full or unavailable.
        }
      }

      return response;
    } catch {
      return await safeMatch(cache, request) || fallbackResponse();
    }
  } catch {
    return fallbackResponse();
  }
}

// Wiring is extracted so it can be exercised in Node with a fake scope; the guard
// below only runs inside a real Service Worker (where `self` is defined).
export function registerServiceWorker(scope) {
  const fetchFn = typeof scope.fetch === 'function'
    ? scope.fetch.bind(scope)
    : (typeof fetch === 'function' ? fetch : undefined);

  scope.addEventListener('install', (event) => {
    scope.skipWaiting?.();
    event.waitUntil(onInstall({ caches: scope.caches }));
  });

  scope.addEventListener('activate', (event) => {
    event.waitUntil(onActivate({ caches: scope.caches })
      .then(() => scope.clients?.claim?.()));
  });

  scope.addEventListener('fetch', (event) => {
    if (event.request?.method !== 'GET') {
      return;
    }

    event.respondWith(onFetch(event.request, {
      caches: scope.caches,
      fetch: fetchFn,
    }));
  });
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  registerServiceWorker(self);
}
