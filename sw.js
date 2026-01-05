
// Bump this value whenever assets change so GitHub Pages + SW cache don't serve stale JS.
const CACHE = 'moodkeeper-v1-6-3';
const ASSETS = [
  './',
  './index.html',
  './report.html',
  './css/styles.css',
  './js/router.js',
  './js/ui.js',
  './js/store.js',
  './js/security.js',
  './js/app.js',
  './js/features/home.js',
  './js/features/checkin.js',
  './js/features/practices.js',
  './js/features/alcohol.js',
  './js/features/stress.js',
  './js/features/goals.js',
  './js/features/calm.js',
  './js/features/insights.js',
  './js/features/settings.js',
  './js/features/unlock.js',
  './manifest.webmanifest',
  './assets/app-icon-192.png',
  './assets/app-icon-512.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>k===CACHE?null:caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e)=>{
  const req = e.request;
  e.respondWith(
    caches.match(req).then(cached=>{
      return cached || fetch(req).then(resp=>{
        const copy = resp.clone();
        caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
        return resp;
      }).catch(()=>cached);
    })
  );
});
