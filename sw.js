// Service Worker for FlashCalc PWA.
// Single-file offline-first PWA. Zero dependencies.

const CACHE = 'flashcalc-v0.1.0-e7125f47';

// Resolved against the worker's own URL, so the app works at a domain root
// or under a subpath (e.g. GitHub Pages project sites) with no changes.
const ROOT = new URL('./', self.location).pathname;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll fails the whole install if any request fails; use individual
      // adds so a missing icon does not block the shell.
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch((err) => console.warn('[sw] precache miss:', url, err.message))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Purge old caches only when the new one holds the complete shell.
    const cache = await caches.open(CACHE);
    const missing = [];
    for (const u of PRECACHE) {
      if (!(await cache.match(new URL(u, self.location).href))) missing.push(u);
    }
    if (missing.length > 0) {
      console.warn('[sw] precache incomplete, keeping old caches:', missing);
      return;
    }
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
  })());
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET.
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  // HTML and JSON: network-first with a 3s timeout so updates land, cache fallback offline.
  if (url.pathname.endsWith('.html') || url.pathname === ROOT || url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Everything else (icons, assets): cache-first.
  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// How long network-first waits before serving the cache. With no reception a
// fetch can hang on a dead-but-not-refused connection, which reads as
// "the app won't load" when launching offline.
const NETWORK_TIMEOUT_MS = 3000;

async function networkFirst(request) {
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = (await caches.match(request))
      ?? (request.mode === 'navigate' ? await caches.match(ROOT) : null);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network timeout')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}
