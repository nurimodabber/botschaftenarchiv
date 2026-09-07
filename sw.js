const CACHE_NAME = 'bahai-bib-v3.2';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css?v=3.2',
  '/css/styles.css',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-512-maskable.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/favicon.svg',
  '/js/app.js?v=3.2',
  '/js/app.js',
  '/js/viewer.js',
  '/js/search.js',
  '/js/compilation_builder.js?v=2.6',
  '/js/compilation_builder.js',
  '/js/timeline.js?v=3.1',
  '/js/timeline.js',
  '/js/books.js',
  '/js/sources.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('PWA Cache pre-caching non-fatal warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Bypass Vercel analytics, speed insights, external third parties
  if (url.origin !== self.location.origin) {
    return;
  }

  // Bypass binary documents (PDF, DOCX, EPUB) from heavy cache bloating
  if (url.pathname.endsWith('.pdf') || url.pathname.endsWith('.docx') || url.pathname.endsWith('.epub')) {
    return;
  }

  // Navigation requests (HTML pages) -> Network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // Static assets (CSS, JS, WebManifest, Images, Fonts) -> Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
