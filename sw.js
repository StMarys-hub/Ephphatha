/**
 * EPHPHATHA SERVICE WORKER (NETWORK-FIRST WITH OFFLINE VAULT FALLBACK)
 * Ensures live code & manifest updates take effect immediately on refresh while
 * preserving 100% offline readiness in Tier 4.
 */

const CACHE_NAME = 'ephphatha-sanctuary-v3.5.15';
const CORE_ASSETS = [
  './',
  './index.html',
  './setup-guide.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './assets/fonts/Manjari-Regular.woff2',
  './assets/fonts/Manjari-Bold.woff2',
  './assets/fonts/Meera-Regular.woff2',
  './src/styles/main.css',
  './src/ui/appController.js',
  './src/ui/canonicalBibleController.js',
  './src/ui/qrShareModal.js',
  './src/utils/qrCode.js',
  './src/domain/canonicalBible.js',
  './src/domain/periods.js',
  './src/domain/dailyTitles.js',
  './src/domain/youtubeBibleMap.js',
  './src/domain/securityEngine.js',
  './src/domain/crdtEngine.js',
  './src/adapters/indexedDbRepo.js',
  './src/adapters/bibleFailoverGateway.js',
  './src/adapters/fellowshipGateway.js',
  './src/adapters/googleSheetsAdapter.js',
  './src/adapters/audioEngine.js',
  './src/adapters/youtubeAudioAdapter.js',
  './src/adapters/syncWorkerClient.js',
  './data/schedule_manifest_v3.json',
  './data/scripture_fallback_vault.json',
  './data/youtube_bible_in_a_year_365.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
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

  // Never intercept cross-origin audio streams (e.g. Cloudflare Edge Worker HTTP 206 byte ranges)
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Network-First with Offline Cache Fallback for instant updates
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
