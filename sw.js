const VERSION='inkspace-shell-v1';
const SHELL=['/','/index.html','/manifest.webmanifest','/assets/icon.svg','/assets/icon-192.png','/assets/icon-512.png','/src/styles.css','/src/app.js','/src/input.js','/src/tracker.js','/src/db.js','/src/pdf.js','/src/cloud.js','/config.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||event.request.url.includes('/auth/v1/')||event.request.url.includes('/rest/v1/'))return;
 const url=new URL(event.request.url);
 if(url.origin!==location.origin){if(url.hostname.includes('jsdelivr.net')){event.respondWith(caches.open(VERSION).then(async c=>{try{const res=await fetch(event.request);if(res.ok)c.put(event.request,res.clone());return res;}catch{const cached=await c.match(event.request);if(cached)return cached;throw new Error('PDF renderer unavailable offline');}}));}return;}
 event.respondWith(caches.match(event.request).then(async cached=>{if(cached)return cached;const res=await fetch(event.request);if(res.ok){const c=await caches.open(VERSION);c.put(event.request,res.clone());}return res;}));
});
