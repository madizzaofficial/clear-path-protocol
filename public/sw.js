const CACHE = "protocole-clear-v2";
const STATIC = ["/icon-192.png", "/icon-512.png", "/manifest.json", "/logo_clear.png", "/favicon.ico"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Purge tous les anciens caches (v1, etc.)
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Uniquement les assets statiques listés ci-dessus
  if (STATIC.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
    return;
  }

  // Tout le reste (JS, CSS, navigation, API) → réseau direct, jamais caché
});
