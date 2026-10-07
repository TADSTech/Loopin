const CACHE_NAME = "loopin-cache-v2";
const STATIC_ASSETS = ["/icon.png", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// Drop caches from older versions so stale HTML never lingers.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Page navigations: network-first so the HTML is always fresh,
  // falling back to the last good copy when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/")),
        ),
    );
    return;
  }

  // Same-origin static assets: serve from cache, refresh in the background.
  if (new URL(request.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          fetch(request)
            .then((response) => {
              if (response.ok) {
                const copy = response.clone();
                caches
                  .open(CACHE_NAME)
                  .then((cache) => cache.put(request, copy));
              }
            })
            .catch(() => {});
          return cached;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
  }
  // Cross-origin requests (fonts, avatar images) are left to the browser.
});
