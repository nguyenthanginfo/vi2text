const CACHE_NAME = 'voice-to-text-studio-shell-vi-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './about.html',  
  './css/style.css',
  './css/about.css',
  './js/theme.js',
  './js/settings.js',
  './js/session.js',
  './js/ui.js',
  './js/vu-meter.js',
  './js/vad.js',
  './js/speech-recognizer.js',
  './js/providers/google.js',
  './js/providers/azure.js',
  './js/tts.js',
  './js/voices.js',
  './js/text-save.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/top-logo.png',
  './icons/mb-account.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Chỉ cache app-shell tĩnh (cùng origin). KHÔNG đụng vào request tới
  // Google/Azure hay bất kỳ domain khác — luôn phải đi mạng thật, không cache.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
