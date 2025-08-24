const STATIC_CACHE_NAME = 'klmz-static-v5';
const DYNAMIC_CACHE_NAME = 'klmz-dynamic-v5';

// Recursos esenciales de la app que siempre deben estar en caché.
const APP_SHELL = [
    '/',
    '/index.html',
    // Puedes añadir aquí una imagen de logo o un ícono si lo tienes
    // '/images/logo.png',
];

self.addEventListener('install', event => {
    console.log('[SW] Instalando Service Worker...');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then(cache => {
            console.log('[SW] Pre-caching App Shell');
            return cache.addAll(APP_SHELL);
        })
    );
});

self.addEventListener('activate', event => {
    console.log('[SW] Activando Service Worker...');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => {
                if (key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
                    console.log('[SW] Eliminando caché antiguo:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Estrategia para las peticiones a la API de Supabase: Network first, fallback to cache.
    // Esto asegura que los datos (listas de álbumes/canciones) estén lo más actualizados posible.
    if (url.hostname === 'nqbldvpnqhngdtalvzov.supabase.co') {
        event.respondWith(
            fetch(event.request)
            .then(response => {
                // Si la petición a la red es exitosa, la clona y la guarda en el caché dinámico.
                const clonedResponse = response.clone();
                caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                    cache.put(event.request.url, clonedResponse);
                });
                return response;
            })
            .catch(() => {
                // Si la red falla, busca en el caché.
                return caches.match(event.request);
            })
        );
    } 
    // Estrategia para el App Shell: Cache first, fallback to network.
    // Esto hace que la app cargue instantáneamente.
    else if (APP_SHELL.includes(url.pathname)) {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request);
            })
        );
    }
    // Para otros recursos (como imágenes de portadas),
    // se puede usar una estrategia cache-first también.
    else {
        event.respondWith(
            caches.match(event.request).then(response => {
                if (response) {
                    return response;
                } else {
                    return fetch(event.request).then(res => {
                        return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                            // No se cachean las canciones (.mp3) aquí, se manejan en IndexedDB.
                            if (!url.pathname.endsWith('.mp3')) {
                                cache.put(event.request.url, res.clone());
                            }
                            return res;
                        });
                    }).catch(err => {
                        // Opcional: devolver una imagen o recurso offline por defecto si falla.
                    });
                }
            })
        );
    }
});
