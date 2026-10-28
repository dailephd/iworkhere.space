# Component: ServiceWorkerRegister

**Kind:** Component

<!-- section-id: representative-file -->
## Representative File

`src/component/layout/ServiceWorkerRegister.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/component/layout/ServiceWorkerRegister.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/component/layout/ServiceWorkerRegister.tsx
- file-role: component
- extension: .tsx
- filename: PascalCase (ServiceWorkerRegister)
- path-segment: components
- Derived from single-file merged unit "ServiceWorkerRegister".
- Merge signals: single-file-unit

<!-- section-id: service-worker-policy -->
## Service worker policy (v0.4.4)

`ServiceWorkerRegister` is unchanged: it registers `/sw.js` in production only
and fails silently. The caching policy is owned solely by `public/sw.js`; no
framework, second registration path or additional cache family exists. The
cache is `iworkhere-shell-v0.4.4`. Requests are classified in this order:

1. Non-GET, cross-origin, `/api/`, Next RSC/prefetch/data (`RSC: 1`,
   `Next-Router-Prefetch`, `Next-Router-Segment-Prefetch`, `_rsc`,
   `/_next/data/`), any query-bearing URL, and `/robots.txt`, `/sitemap.xml`,
   `/ads.txt`, `/sw.js`, `/manifest.webmanifest`: network only, no cache read or
   write.
2. Same-origin HTML navigation: network first. Only an HTTP 200, non-redirected
   `text/html` response is stored, keyed by the clean pathname. After a network
   failure only that pathname's stored page is served; otherwise a plain-text 503
   "not available offline" response is returned, never another route.
3. Allowlisted prefixes (`/_next/static/`, `/vendor/pdfjs/6.4.299/`,
   `/vendor/qpdf/12.4.2/`, `/examples/v0.4.3/`, `/examples/v0.4.4/`): cache first,
   storing only HTTP 200. Cached `turbopack-worker-` bootstrap responses are
   re-wrapped without a stored URL so warmed HEIC workers keep their own URL and
   fragment.
4. Everything else: network only.

Activation deletes only `app-shell-v1` and other `iworkhere-shell-` caches except
the current one. `skipWaiting` and `clients.claim` are retained and no reload is
forced.

Tests: `test/e2e/service-worker.spec.ts` observes Cache Storage keys for clean,
query, RSC, API, root-file and 404 requests, online freshness, same-page offline
fallback, owned-cache eviction with unrelated-cache retention, and the warmed HEIC
journey. `script/serviceWorker.test.ts` runs the worker in a VM for bypass,
bootstrap and precache contracts. Cold-offline operation is not guaranteed.

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.
