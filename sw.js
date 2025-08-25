self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activado');
});

// Puedes extender con caché si lo deseas:
self.addEventListener('fetch', (event) => {
  // event.respondWith(...) si implementas cache-first, etc.
});
