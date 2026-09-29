/* POLARIS service worker: works offline at stations with poor links.
 * - app shell and hashed assets: cache first
 * - public API reads: network first, cached copy when offline
 * - signed-in, admin and write requests are never cached */
const VERSION = 'polaris-v1';
const SHELL = ['/', '/index.html', '/polaris-emblem.svg', '/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const PRIVATE = /^\/api\/(admin|me|auth|events)\b/;

async function networkFirst(req, fallbackUrl) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (fallbackUrl && (await cache.match(fallbackUrl))) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') return e.respondWith(networkFirst(req, '/index.html'));
  if (url.pathname.startsWith('/api/')) {
    if (PRIVATE.test(url.pathname) || url.pathname.includes('/download') || url.pathname.endsWith('/weather')) return;
    return e.respondWith(networkFirst(req));
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/uploads/') || SHELL.includes(url.pathname)) {
    return e.respondWith(cacheFirst(req));
  }
});
