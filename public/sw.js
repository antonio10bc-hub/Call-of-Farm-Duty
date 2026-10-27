// Service worker: permite jugar sin conexión sin quedarse con versiones viejas.
//
// Estrategia "primero la red": con conexión siempre se descarga lo último (y se guarda una
// copia); sin conexión, o si la red tarda demasiado, se usa la copia guardada.
// La primera visita guarda la estructura básica al instalarse, y la página le envía la
// lista de todo lo que ha cargado (módulos, iconos...) para que también lo guarde.
const CACHE = 'cofd-v11';
const SHELL = [
    './',
    './index.html',
    './style.css',
    './manifest.webmanifest',
    './vendor/three.module.min.js',
    './fonts/press-start-2p.woff2',
    './src/main.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-64.png',
];
const NETWORK_TIMEOUT = 4000;

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
        await self.clients.claim();
    })());
});

// La página manda las URLs que ya ha cargado para guardarlas también.
self.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'cache-urls') return;
    const urls = event.data.urls.filter((u) => new URL(u).origin === self.location.origin);
    event.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => c.add(u).catch(() => {})))));
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;

    event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
    const cache = await caches.open(CACHE);
    try {
        const res = await withTimeout(fetch(req), NETWORK_TIMEOUT);
        if (res.ok) cache.put(req, res.clone());
        return res;
    } catch {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
        return Response.error();
    }
}

function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), ms);
        promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
}
