// ══════════════════════════════════════════
// Sakura AI — Service Worker (PWA)
// ══════════════════════════════════════════

const CACHE_NAME = 'sakura-ai-v1';
const OFFLINE_URL = '/offline.html';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/auth.html',
  '/pricing.html',
  '/tools.html',
  '/tool-interface.html',
  '/dashboard.html',
  '/templates.html',
  '/faq.html',
  '/contact.html',
  '/privacy.html',
  '/terms.html',
  '/refund.html',
  '/checkout-success.html',
  '/styles.css',
  '/script.js',
  '/config.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/offline.html',
];

// ── Install ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('🌸 Sakura AI SW: Caching static assets');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
        .catch(err => console.warn('SW cache warning:', err));
    })
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('🌸 Sakura AI SW: Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API calls — always go to network
  if (url.pathname.startsWith('/api/') || url.hostname.includes('railway.app')) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: 'You are offline. Please check your connection.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Skip external resources (fonts, CDN)
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static assets, network-first for HTML pages
  if (request.destination === 'document') {
    // Network-first for HTML
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match(OFFLINE_URL)))
    );
  } else {
    // Cache-first for CSS, JS, images
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
  }
});

// ── Push Notifications ────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Sakura AI 🌸';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
