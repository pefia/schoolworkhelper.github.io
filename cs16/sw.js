const CACHE = 'webxash-runtime-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([
    '/cs16/',
    '/cs16/index.html',
    '/cs16/icon.svg',
    '/cs16/engine/index.html'
  ])));
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_OFFLINE_ASSETS') return;
  const reply = event.ports[0];
  event.waitUntil((async () => {
    try {
      const manifestResponse = await fetch('/cs16/offline-assets.json', { cache: 'no-store' });
      if (!manifestResponse.ok) throw new Error('Offline asset manifest is unavailable');
      const manifestCopy = manifestResponse.clone();
      const assets = await manifestResponse.json();
      if (!Array.isArray(assets) || assets.length === 0) throw new Error('Offline asset manifest is empty');
      const cache = await caches.open(CACHE);
      await cache.addAll(assets);
      await cache.put('/cs16/offline-assets.json', manifestCopy);
      reply.postMessage({ ok: true });
    } catch (error) {
      reply.postMessage({ ok: false, error: error.message });
      throw error;
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name.startsWith('webxash-runtime-') && name !== CACHE)
        .map((name) => caches.delete(name))
    )),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
