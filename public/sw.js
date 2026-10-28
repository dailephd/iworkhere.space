// Service worker for offline caching.
// Strategy, in request-classification order:
//   Non-GET, cross-origin, /api/, Next RSC/prefetch/data, query-bearing and
//   root files (robots, sitemap, ads.txt, sw.js, manifest): network only.
//   Clean same-origin HTML navigations: network first, same-path cache fallback.
//   Allowlisted static prefixes: cache first, network fallback.
//   Everything else: network only.
// Network-only requests never read or write Cache Storage.

const CACHE_NAME = "iworkhere-shell-v0.4.4";
const LEGACY_CACHE_NAME = "app-shell-v1";
const OWNED_CACHE_PREFIX = "iworkhere-shell-";

const STATIC_PREFIX_LIST = [
    "/_next/static/",
    "/vendor/pdfjs/6.4.299/",
    "/vendor/qpdf/12.4.2/",
    "/examples/v0.4.3/",
    "/examples/v0.4.4/",
];

const NETWORK_ONLY_PATH_LIST = ["/robots.txt", "/sitemap.xml", "/ads.txt", "/sw.js", "/manifest.webmanifest"];

const NEXT_ROUTER_HEADER_LIST = ["RSC", "Next-Router-Prefetch", "Next-Router-Segment-Prefetch"];

const OFFLINE_MESSAGE = "This page is not available offline. Reconnect and try again.";

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
                    .filter(isOwnedStaleCache)
                    .map(function (name) {
                        return caches.delete(name);
                    }),
            );
        }),
    );
    self.clients.claim();
});

// Only this app's legacy and older versioned shell caches are removed. Cache
// names from other workers or apps on the origin are never touched.
function isOwnedStaleCache(name) {
    if (name === CACHE_NAME) return false;
    return name === LEGACY_CACHE_NAME || name.startsWith(OWNED_CACHE_PREFIX);
}

function isNextRouterRequest(request, url) {
    if (url.pathname.startsWith("/_next/data/")) return true;
    if (url.searchParams.has("_rsc")) return true;
    if (!request.headers) return false;
    return NEXT_ROUTER_HEADER_LIST.some(function (name) {
        return Boolean(request.headers.get(name));
    });
}

// The fragment is not part of the request sent to the network, so it is
// excluded: worker bootstrap URLs carry their parameters there.
function hasQuery(url) {
    return url.href.split("#")[0].indexOf("?") !== -1;
}

function isStaticAsset(url) {
    return STATIC_PREFIX_LIST.some(function (prefix) {
        return url.pathname.startsWith(prefix);
    });
}

function isCacheableHtml(response) {
    if (response.status !== 200 || response.redirected) return false;
    var contentType = response.headers.get("content-type") || "";
    return contentType.indexOf("text/html") !== -1;
}

function offlineResponse() {
    return new Response(OFFLINE_MESSAGE, {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
}

function storeResponse(event, key, response) {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then(function (cache) {
                return cache.put(key, response);
            })
            .catch(function () {
                // A failed cache write must never affect the page.
            }),
    );
}

// Keyed by the clean pathname so a fallback can only serve the same page.
function respondToNavigation(event, url) {
    return fetch(event.request)
        .then(function (response) {
            if (isCacheableHtml(response)) storeResponse(event, url.pathname, response.clone());
            return response;
        })
        .catch(function () {
            return caches.match(url.pathname, { cacheName: CACHE_NAME }).then(function (cached) {
                return cached || offlineResponse();
            });
        });
}

function respondToStaticAsset(event, url) {
    return caches.match(event.request, { cacheName: CACHE_NAME }).then(function (cached) {
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
            if (response.status === 200) storeResponse(event, event.request, response.clone());
            return response;
        });
    });
}

self.addEventListener("fetch", function (event) {
    var request = event.request;
    var url = new URL(request.url);

    // Network only: returning without respondWith leaves the browser's own
    // fetch untouched and never reads or writes Cache Storage.
    if (request.method !== "GET") return;
    // The origin is always present in a real worker.
    if (self.location && url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/")) return;
    if (isNextRouterRequest(request, url)) return;
    if (hasQuery(url)) return;
    if (NETWORK_ONLY_PATH_LIST.indexOf(url.pathname) !== -1) return;

    if (request.mode === "navigate") {
        event.respondWith(respondToNavigation(event, url));
        return;
    }

    if (isStaticAsset(url)) {
        event.respondWith(respondToStaticAsset(event, url));
    }
});
