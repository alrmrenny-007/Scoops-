// Service worker for Scoops — handles offline caching (so the site can be
// installed as an app) and push notifications for the staff dashboard.

const CACHE_NAME = 'scoops-cache-v2';
const PRECACHE_URLS = [
  '/', '/index.html', '/style.css', '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Only manage requests to this site itself. Cross-origin requests (Supabase's
  // API, Google Fonts, the GSAP/Supabase CDN scripts) must be left completely
  // alone — intercepting those broke live data loading entirely.
  if (new URL(req.url).origin !== self.location.origin) return;

  // Page loads: try the network first (so a deploy update shows up right away),
  // fall back to the cache — or the cached home page — if offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Everything else (CSS/JS/icons): serve from cache instantly if we have it,
  // and refresh the cache in the background for next time.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

/* ============ PUSH NOTIFICATIONS (staff dashboard) ============ */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }

  const title = data.title || 'New order!';
  const options = {
    body: data.body || 'A new order just came in.',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/admin.html' },
    tag: 'scoops-order',
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/admin.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('admin.html') && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
