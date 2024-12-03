const CACHE_NAME = 'pwa-cache-v1';
const ASSETS = [
    'index.html',
    'brujula.html',
    'offline.html',
    'assets/css/style.css',
    'assets/js/lib/pouchdb-9.0.0.min.js',
    'assets/js/lib/moment-with-locales.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).catch(() => {
                return caches.match('offline.html');
            });
        })
    );
});
