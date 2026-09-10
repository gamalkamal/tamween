/* SERVICE WORKER DISABLED - no caching, always load fresh */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
/* Network only - no caching at all */
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
