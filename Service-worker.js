const CACHE_NAME = 'dz-green-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
  // أضف أيقونات أو ملفات صوت هنا إذا رفعتها
];

self.addEventListener('install', evt=>{
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt=>{
  evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', evt=>{
  evt.respondWith(
    caches.match(evt.request).then(resp => resp || fetch(evt.request).then(r=>{
      // cache dynamic responses (optional)
      return r;
    })).catch(()=> caches.match('/index.html'))
  );
});
