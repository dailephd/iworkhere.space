# PDF foundation validation

Run the project-local dependencies with Node 24. Normal install/build never
compiles QPDF C++; see `qpdf/README.md` for the pinned rebuild gate.

| Gate | Command |
| --- | --- |
| Runtime identities and retained notices | `node node_modules/tsx/dist/cli.mjs script/pdfAssetsVerify.ts` |
| Deterministic corpus regeneration | `node node_modules/tsx/dist/cli.mjs script/pdfFixture.ts` |
| Real Chromium / production Next foundation | `node node_modules/tsx/dist/cli.mjs script/pdfFoundationSmoke.ts` |
| Standalone Docker foundation | same smoke command with `--container` |

Use the project-local Playwright cache through `PLAYWRIGHT_BROWSERS_PATH` and
project-contained temporary paths. The smoke creates a unique `test-report/`
directory, refuses an existing harness route, creates a temporary composition
route, builds real production owners and removes the route in finally. Normal
production has no test harness route. Rebuild normally afterward so generated Next type
files and bundles reflect the ordinary application. `--existing-build` may reuse
the immediately preceding harness build only when its runtime owners are
unchanged; it is intended for fixture/assertion-only reruns.

The default matrix includes structural compression with exact frozen flags,
actual byte comparison, independent text/geometry/rotation verification and
all-page corpus raster comparison. Evidence includes equal/larger outcomes,
reducible text/vector, mixed and 100-page sources, and rejected damaged/encrypted
sources. The separate real QPDF warning test proves exit 3 can produce bytes;
the worker regression proves those bytes are discarded before transfer.

Chromium records native worker network traffic through CDP because ordinary
page events omit worker-internal imports/fetches. Native workers remain unchanged.
The smoke verifies same-origin GET-only traffic, native raster decoding,
page geometry/text/raster agreement, all worker termination and bounded errors.
Service-worker registration stays enabled. Its bootstrap cache exception is
required to preserve distinct Turbopack worker entries; vendor assets remain
cached only after use. No PDF asset is precached.

Cached bootstrap responses are reconstructed without a stored response URL;
their body/headers and cache-first availability remain intact. The focused
service-worker regression proves warmed HEIC operations still work offline.

The Docker mode owns a unique image/container, uses the existing standalone
Dockerfile, read-only runtime, dropped capabilities, no-new-privileges and a
bounded /tmp mount. It checks non-root UID, endpoint and Docker health, asset
MIME, the same real browser matrix, clean stop and removal of its owned image
and container. It does not deploy or run live ads/persistence.
