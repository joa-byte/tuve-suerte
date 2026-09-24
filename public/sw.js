const CACHE_NAME = 'tuve-suerte-shell-v7';
const APP_SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/vendor/roughjs/rough.js',
  '/styles.css',
  '/styles/tokens.css',
  '/styles/base.css',
  '/styles/components.css',
  '/styles/screens.css',
  '/styles/forms.css',
  '/assets/paper-texture.svg',
  '/assets/face-logo-transparent.png',
  '/assets/ink-underline.svg',
  '/assets/select-mark.svg',
  '/assets/fonts/covered-by-your-grace/CoveredByYourGrace.woff2',
  '/assets/fonts/waiting-for-the-sunrise/WaitingfortheSunrise.woff2',
  '/manifest.webmanifest',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-48.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('tuve-suerte-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // La API siempre va a la red: nunca servimos cenas u opiniones desactualizadas.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
