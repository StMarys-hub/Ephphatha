/**
 * EPHPHATHA SERVICE WORKER (STALE-WHILE-REVALIDATE & TIER-4 OFFLINE VAULT)
 * Caches core application shell, Malayalam typography, schedule_manifest_v3.json,
 * and scripture_fallback_vault.json for 0ms offline startup.
 */

const CACHE_NAME = 'ephphatha-sanctuary-v3.0.2';
const CORE_ASSETS = [
  './',
  './index.html',
  './setup-guide.html',
  './manifest.webmanifest',
  './src/styles/main.css',
  './src/ui/appController.js',
  './src/domain/periods.js',
  './src/domain/securityEngine.js',
  './src/adapters/indexedDbRepo.js',
  './src/adapters/bibleFailoverGateway.js',
  './src/adapters/audioEngine.js',
  './src/adapters/syncWorkerClient.js',
  './data/schedule_manifest_v3.json',
  './data/scripture_fallback_vault.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Stale-While-Revalidate for local assets & schedule manifest
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

