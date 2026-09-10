/* ===== SERVICE WORKER - tamween v3 ===== */
const APP_VERSION = '3.0';
const CACHE_NAME = 'tamween-v3';

// On install: skip waiting immediately so new SW takes over fast
self.addEventListener('install', e => {
  self.skipWaiting();
});

// On activate: delete ALL old caches then claim clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first strategy: always try network, fall back to cache
self.addEventListener('fetch', e => {
  // Skip non-GET or cross-origin chrome-extension requests
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Cache a copy of fresh responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

// Listen for SKIP_WAITING message from app
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
