// Service worker for offline caching.
// Strategy:
//   Navigation requests: network first, cache fallback
//   Static assets: cache first, network fallback
//   API routes: network only (no caching)

const CACHE_NAME = "app-shell-v1";

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(["/", "/discover"]);
        }),
    );
    self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (nameList) {
            return Promise.all(
                nameList
                    .filter(function (name) {
                        return name !== CACHE_NAME;
                    })
                    .map(function (name) {
                        return caches.delete(name);
                    }),
            );
        }),
    );
    self.clients.claim();
});

self.addEventListener("fetch", function (event) {
    var url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== "GET") return;

    // Skip API routes — always use network
    if (url.pathname.startsWith("/api/")) return;

    // Navigation requests: network first, cache fallback
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request)
                .then(function (response) {
                    var clone = response.clone();
                    caches
                        .open(CACHE_NAME)
                        .then(function (cache) {
                            cache.put(event.request, clone);
                        });
                    return response;
                })
                .catch(function () {
                    return caches.match(event.request).then(function (cached) {
                        return cached || caches.match("/");
                    });
                }),
        );
        return;
    }

    // Static assets: cache first, network fallback
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            if (cached) {
                // Worker entries share a bootstrap pathname with different
                // fragments. Keep its cached bytes/headers for offline use,
                // but omit the stored response URL so the worker retains its
                // own constructor URL and entry fragment.
                if (url.pathname.startsWith("/_next/static/chunks/turbopack-worker-")) {
                    return new Response(cached.body, {
                        status: cached.status,
                        statusText: cached.statusText,
                        headers: cached.headers,
                    });
                }
                return cached;
            }
            return fetch(event.request).then(function (response) {
                if (response.ok) {
                    var clone = response.clone();
                    caches
                        .open(CACHE_NAME)
                        .then(function (cache) {
                            cache.put(event.request, clone);
                        });
                }
                return response;
            });
        }),
    );
});
