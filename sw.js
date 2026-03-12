
// Bump this value whenever assets change so GitHub Pages + SW cache don't serve stale JS.
const CACHE = 'moodkeeper-v1-7-0';
const ASSETS = [
  './',
  './index.html',
  './report.html',
  './css/styles.css',
  './js/router.js',
  './js/ui.js',
  './js/store.js',
  './js/security.js',
  './js/ai.js',
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

// Handle notification clicks — open or focus the app
self.addEventListener('notificationclick', (e)=>{
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(clients=>{
      for(const client of clients){
        if(client.url && client.focus) return client.focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

// Push handler (for future web push integration)
self.addEventListener('push', (e)=>{
  let data = { title:'Moodkeeper', body:'Your notebook is ready.' };
  try{ if(e.data) data = Object.assign(data, e.data.json()); }catch(_){}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './assets/app-icon-192.png',
      badge: './assets/app-icon-192.png',
      tag: 'mk-push'
    })
  );
});
