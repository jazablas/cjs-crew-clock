/* CJ's Crew - Clock service worker: makes the app installable and lets screens open on a weak signal.
   Pages and code always come fresh from the network when it's available (so updates show right away);
   the saved copy is used only when the phone is offline. Server data (Supabase) is never cached here. */
const VERSION = 'cc-2026-11-06a';
const CORE = ['./', './index.html', './manager.html', './display.html', './apply.html', './privacy.html', './guide.html', './handbook.html', './labels.html',
  './styles.css', './theme.css', './manager.css', './display.css', './labels.css',
  './config.js', './store.js', './app.js', './app-x.js', './manager.js', './manager-x.js', './manager-privacy.js', './display.js', './labels.js', './apply.js', './qrcode.min.js', './install.js',
  './favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './manifest.webmanifest', './manager.webmanifest', './board.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin){
    e.respondWith((async () => {
      try {
        const res = await fetch(req, {cache: 'no-cache'});
        if (res.ok && res.type === 'basic'){ const c = await caches.open(VERSION); c.put(stripQuery(req, url), res.clone()); }
        return res;
      } catch (err) {
        const c = await caches.open(VERSION);
        return (await c.match(stripQuery(req, url))) || (req.mode === 'navigate' ? (await c.match('./index.html')) : undefined) || Response.error();
      }
    })());
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(caches.open(VERSION + '-fonts').then(async c => (await c.match(req)) || fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; })));
  }
});
function stripQuery(req, url){ return url.search ? new Request(url.origin + url.pathname) : req; }
