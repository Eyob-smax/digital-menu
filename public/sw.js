/**
 * Service worker: makes the customer app open with no network at all.
 *
 * Caching policy, deliberately split by what the resource *is*:
 *
 *   Navigations   network-first, fall back to the cached shell.
 *                 A customer with signal gets the live app; a customer in a
 *                 basement still gets an app instead of the dinosaur.
 *
 *   Build assets  cache-first. Next.js fingerprints /_next/static/*, so a
 *                 given URL's contents never change and staleness is
 *                 impossible.
 *
 *   API calls     network-only. Menu and order data are cached deliberately
 *                 in IndexedDB by lib/offline-store, which knows how to
 *                 version and merge them. Letting the SW also cache them
 *                 would create a second, dumber cache that disagrees.
 *
 * Bumping CACHE_VERSION retires every old cache on the next activation.
 */

const CACHE_VERSION = "dm-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

/** Routes worth having available cold. */
const SHELL_ROUTES = ["/", "/favorites", "/history", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one 404 doesn't abort the whole install.
      await Promise.allSettled(SHELL_ROUTES.map((route) => cache.add(route)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch other origins, or the auth endpoints.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/auth")) return;

  // API data belongs to IndexedDB, not here.
  if (url.pathname.startsWith("/api/")) return;

  // Staff and admin screens are useless offline and must never show stale
  // order data, so they are left entirely to the network.
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/staff")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icon") ||
    /\.(?:css|js|woff2?|png|jpe?g|svg|webp|avif)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
  }
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);

    // Keep the shell fresh for next time.
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached =
      (await caches.match(request)) ??
      (await caches.match("/")) ??
      (await caches.match("/offline"));

    return (
      cached ??
      new Response(
        "<!doctype html><meta charset=utf-8><title>Offline</title><p>You are offline and this page has not been saved yet.</p>",
        { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
      )
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(ASSET_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached ?? Response.error();
  }
}

/** Lets the page ask a waiting worker to take over immediately. */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
