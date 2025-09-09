const CACHE_NAME = 'klmz-music-v1.2.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/appwrite@18.2.0',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
];
// ✅ INSTALACIÓN DEL SERVICE WORKER
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando KLMZ MUSIC...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: Cache abierto para KLMZ MUSIC');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});
// ✅ ACTIVACIÓN DEL SERVICE WORKER
self.addEventListener('activate', event => {
  console.log('✅ Service Worker: KLMZ MUSIC activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
// ✅ INTERCEPTAR REQUESTS (CACHE FIRST STRATEGY)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - devolver respuesta
        if (response) {
          return response;
        }
        
        // IMPORTANTE: Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(response => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
  );
});
// ✅ BACKGROUND SYNC para música
self.addEventListener('sync', event => {
  if (event.tag === 'klmz-music-sync') {
    console.log('🎵 Service Worker: Sincronizando música en background');
    // Aquí puedes implementar sincronización de favoritos, etc.
  }
});
// ✅ PUSH NOTIFICATIONS para actualizaciones
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Nueva música disponible',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Escuchar ahora',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/icon-192.png'
      }
    ]
  };
  event.waitUntil(
    self.registration.showNotification('KLMZ MUSIC', options)
  );
});
// ✅ NOTIFICATION CLICK
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification click: ', event.notification.tag);
  event.notification.close();
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// ✅✅✅ PIEZA AÑADIDA PARA FORZAR LA ACTUALIZACIÓN ✅✅✅
self.addEventListener('message', event => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
