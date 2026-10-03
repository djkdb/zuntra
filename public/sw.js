/* TripMate service worker: keeps already-visited trip pages readable offline. */
const VERSION = "v1";
const STATIC_CACHE = `tm-static-${VERSION}`;
const PAGE_CACHE = `tm-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const APP_PATHS = ["/dashboard", "/trips"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGE_CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Signed out: forget every cached page (they contain personal trip data).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR") {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable build assets: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // App pages: network first, fall back to the last copy, then to the offline page.
  if (request.mode === "navigate" && APP_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !res.redirected) caches.open(PAGE_CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(OFFLINE_URL))),
    );
  }
});
