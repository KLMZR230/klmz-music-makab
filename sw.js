const CACHE_NAME = 'klmz-music-v1';
const ASSETS = [
  './',
  './index.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.mode === 'navigate' || request.destination === 'document') {
    e.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }
  if (['style','script','image'].includes(request.destination)) {
    e.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return resp;
        })
      )
    );
    return;
  }
  e.respondWith(fetch(request).catch(() => caches.match(request)));
});
