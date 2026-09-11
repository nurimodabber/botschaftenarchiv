const CACHE_NAME = 'bahai-bib-v4.5';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css?v=4.5',
  '/css/styles.css',
  '/css/tokens.css',
  '/css/base.css',
  '/css/library.css',
  '/css/viewer.css',
  '/css/timeline.css',
  '/css/workshop.css',
  '/css/books.css',
  '/css/sources.css',
  '/css/settings.css',
  '/css/responsive.css',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-512-maskable.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/favicon.svg',
  '/js/state.js?v=4.5',
  '/js/state.js',
  '/js/i18n.js?v=4.5',
  '/js/i18n.js',
  '/js/settings.js?v=4.5',
  '/js/settings.js',
  '/js/filters.js?v=4.5',
  '/js/filters.js',
  '/js/search_engine.js?v=4.5',
  '/js/search_engine.js',
  '/js/viewer.js?v=4.5',
  '/js/viewer.js',
  '/js/collections.js?v=4.5',
  '/js/collections.js',
  '/js/compilation_builder.js?v=4.5',
  '/js/compilation_builder.js',
  '/js/timeline_data.js?v=4.5',
  '/js/timeline_data.js',
  '/js/timeline.js?v=4.5',
  '/js/timeline.js',
  '/js/books.js?v=4.5',
  '/js/books.js',
  '/js/sources.js?v=4.5',
  '/js/sources.js',
  '/js/app.js?v=4.5',
  '/js/app.js'
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
