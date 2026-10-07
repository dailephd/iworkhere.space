# TESTING

Testing in this project is not optional.

It enforces:

- Boundary integrity between layers
- Tool registry integrity and wiring
- Deterministic rendering and tool output
- SSR and hydration safety
- Observability and storage contract compliance
- Layout stability and responsiveness

Testing validates module boundaries, not just internal logic.

This protocol is mandatory for both human engineers and coding agents.

---

## 1. Scope and Goals

### Boundary Integrity

Every layer boundary must be validated:

- `app/` may only reach `module/`, `component/`, and `lib/`
- `lib/` must not import from `module/`
- Tool components must not import from `app/`
- Observability must not be bypassed

### Registry Integrity

- All registered tools must have unique slugs and unique IDs.
- All tools must implement `ToolComponentProp`.
- No undeclared categories or capabilities.

### Determinism

- Tool logic given identical inputs must produce identical outputs.
- No `Date.now()` or unseeded `Math.random()` in tool rendering or pure logic
  functions.

### SSR and Hydration Safety

- No browser API access in Server Components.
- No hydration mismatch between server-rendered HTML and client render.
- Client-only behavior must render a stable placeholder on the server.

### Observability and Storage Contract Compliance

- Tools must not call analytics or logging providers directly.
- No direct `localStorage` access outside `src/lib/storage.ts`.
- Storage adapter must be SSR-safe.

### Layout Stability

- App shell must remain structurally stable across viewport sizes.
- Banner, nav, and content slots must render correctly on mobile and desktop.

---

## 2. Test Categories

All tests fall into one of these categories:

1. Unit Tests (Vitest)
2. Contract Tests (Vitest)
3. Integration Tests (Vitest)
4. E2E Browser Tests (Playwright)

---

## 2.1 Unit Tests (Vitest)

Unit tests verify pure logic in isolation.

Vitest discovers source tests named `*.test.ts` or `*.test.tsx` under `src/`,
and script tests named `*.test.ts` under `script/`. Keep this include contract
explicit in `vitest.config.mts`.

Run `npm run verify` for the aggregate local validation sequence. It runs
typecheck, lint, test, and build in order and preserves the shared Vitest
`RUN_ID` reports and command logs under `test-report/<RUN_ID>/`.

Examples:

- SEO builder functions (`buildToolMetadata`, `buildCategoryMetadata`)
- Storage adapter serialization and SSR safety
- `recentlyUsed` ordering, deduplication, and cap enforcement
- Analytics payload construction
- Tool output transformation functions (e.g., slugify, expression evaluation,
  unit conversion)

Rules:

- No DOM access.
- No network calls.
- No global state mutation.
- No registry dependency unless explicitly testing registry behavior.

Each unit test must:

1. Define minimal input.
2. Call the function.
3. Assert exact expected output.
4. Assert no mutation of input data.

---

## 2.2 Contract Tests (Vitest)

Contract tests verify that data conforms to the declared schemas in SCHEMA.md.

**Tool registry:**

- All entries in `tool_definition_list` have unique `id`.
- All entries have unique `slug`.
- All categories are within the declared `ToolCategory` set.
- `getToolBySlug` returns `undefined` for unknown slugs.
- `getToolBySlug` returns the correct tool for known slugs.
- Duplicate slugs or IDs must be detectable.

**Metadata:**

- `getAllTool()` returns all registered tools.
- `getAvailableCategory()` returns only categories present in the registry.
- `getToolCount()` matches `tool_definition_list.length`.

**Analytics:**

- Only declared `AnalyticEventName` values are used.
- Event payloads are JSON-serializable.
- `track()` calls the active provider without throwing.

**Logging:**

- `log.debug`, `log.info`, `log.warn`, `log.error` do not throw.
- Level filtering suppresses logs below the configured level.
- `RustLogProvider` sends a POST request with the correct body shape (see
  SCHEMA.md §4).

**Storage adapter:**

- `storage.get` returns `null` when `window` is undefined (SSR-safe).
- `storage.set` is a no-op when `window` is undefined.
- `storage.get` returns `null` for missing keys.
- `storage.get` correctly deserializes a value written by `storage.set`.

**API routes:**

- `POST /api/log` returns 204 for a valid body.
- `POST /api/log` returns 400 for a missing `level`.
- `POST /api/log` returns 400 for an unknown `level`.
- `GET /api/health` returns 200.

---

## 2.3 Integration Tests (Vitest)

Integration tests verify cross-module wiring without external network.

Required integration tests:

- Tool page data flow: `getToolBySlug(slug)` → `buildToolMetadata(seo)` produces
  valid Next.js `Metadata`.
- `recentlyUsed` integrates with the storage adapter correctly: write then read
  returns the correct order.
- Observability facade: `captureError` routes to `log.error` and optionally
  emits an analytics event.
- Analytics provider swap: `setAnalyticProvider` changes the active provider and
  new calls reach it.

Rules:

- No external API calls.
- No real browser environment.
- Integration tests must run quickly (sub-second per test).

---

## 2.4 E2E Browser Tests (Playwright)

**Status: implemented in v0.2.0 Batch 1.** `@playwright/test@1.63.0` is pinned as
an exact devDependency. `npm test` remains Vitest only; `npm run verify` remains
Typecheck → Lint → Vitest → Build. Browser validation is a separate heavier gate:

```text
npm run build
npm run test:e2e
```

`playwright.config.ts` owns a fresh production server using
`npm run start -- --hostname 127.0.0.1 --port 3100`. Existing servers are never
reused. The suite runs headless Chromium only, one worker, zero retries, with
`desktop-chromium` (1280 × 720) and `mobile-chromium` (390 × 844) projects.
Install Chromium through the pinned local Playwright CLI; keep local browser
binaries under `.my-dev-kit-workflow/playwright-browsers` and set
`PLAYWRIGHT_BROWSERS_PATH` accordingly.

Each invocation generates a timestamp/random RUN_ID shared by its workers.
Reports live under `test-report/e2e/<RUN_ID>/`: `results.json`, `results.xml`,
`html/`, and `artifacts/`. HTML uses `open: never`; traces and screenshots are
retained only on failure; videos are disabled. CI always uploads the E2E hierarchy.

The Playwright config accepts `E2E_BASE_URL` for an already-running production
runtime. When set, it uses that base URL and does not launch `webServer`; when
unset, the existing `http://127.0.0.1:3100` server ownership and suite behavior
remain in effect. External-runtime mode tests browser behavior directly and
does not require a host `.next` build. HEIC lazy loading is verified by
instrumenting Worker construction, operation, application-owned URL and
termination in the browser; it does not inspect host build chunks.

`npm run test:container` builds and starts a local Docker image, checks runtime
health, HTTP routes, image contents, and clean shutdown, then runs this same
desktop/mobile browser suite against the container. It records a unique
`test-report/container/<CONTAINER_RUN_ID>/` summary and logs; the associated
browser report remains under `test-report/e2e/<E2E_RUN_ID>/`. This gate includes
container-specific PWA/service-worker delivery and HEIC lazy Worker/decoder
route and conversion checks through the same canonical browser coverage. The
container builds the production app internally; nested E2E has no host `.next`
prerequisite. The report also records the container's normal stop result and
OOM state. Container testing is
separate from both `npm run verify` and ordinary `npm run test:e2e`.

Specs in `test/e2e/` use a shared fixture that attaches listeners before navigation.
Every applicable route fails on `pageerror`, console errors and React hydration
warnings/errors, without suppression or arbitrary allowlists. Expected 404 status
is tested through a request to avoid treating an intentional failed resource as an
unapproved browser diagnostic. Health response, all fifteen registered tool routes and catalog flows, calculator
and time arithmetic interactions, responsive shell/skip/navigation/footer,
document scrolling, theme reload persistence and production SW are covered.

Image fixtures follow [the provenance convention](../test/fixtures/images/README.md).
No internet image downloads occur during tests. File lifecycle requirements are
specified in [ImageFileProcessing](modules/ImageFileProcessing.md).

Historical batch counts belong in their run reports rather than this durable
testing contract. Every Vitest, Playwright, container, database, and dashboard
run must record its own unique `RUN_ID` and report path; the current candidate's
exact counts are recorded in the documentation-reconciliation audit report.

Image-family specs own real outputs, MIME/dimensions, downloads, alpha/background
semantics, lifecycle, privacy and responsive containment. heic-converter.spec.ts
owns real codec/worker lifecycle and lazy decoder activation. Fresh-context
resource evidence rechecks all unrelated routes and initial HEIC rendering.
imageFeedback.test.ts and image-feedback.spec.ts protect safe stage/context/action
feedback, local actual size/pixel limits, decode uncertainty, bounded worker
responses and cancellation without alerts. Deterministic dimension injection is
not presented as real large-file decoding; prior actual 45 MP HEIC rejection is
preserved separately. No large error fixture is committed.

Playwright is a first-class discipline in this project, not optional decoration.

E2E tests verify what users actually experience in a browser.

**Navigation and routing:**

- Home page (`/`) loads without error and without console warnings.
- Discover page (`/discover`) loads and lists registered tools.
- A tool page (`/tool/[slug]`) loads the correct tool component by slug.
- A category page (`/category/[category]`) loads and filters tools correctly.
- An unknown slug returns a 404 response.

**Tool page rendering:**

- Tool name and description are visible on the page.
- Tool component renders without console errors.
- No hydration warnings appear in the browser console.

**Responsive layout:**

- Mobile viewport (390×844): nav, header, content slot, and footer are present
  and structurally correct with no overflow.
- Desktop viewport (1280×720): top navigation and content area are
  present and visible.
- Ad banner slots render at the correct breakpoints.

**Hydration mismatch detection:**

- Every Playwright test must attach a console error listener before page load.
- If the browser console emits a React hydration warning, the test must fail.
- No filtering or suppression of hydration warnings in test setup.

**Service worker:**

- In production builds, `/sw.js` is served with the correct content type.
- `ServiceWorkerRegister` does not register the SW in development mode.

---

## 3. SSR and Hydration Safety Rules

The following render-time patterns are forbidden and must be caught by tests:

| Pattern | Why Forbidden |
|---------|--------------|
| `Date.now()` in render | Produces different output on server and client |
| `Math.random()` (unseeded) in render | Non-deterministic HTML |
| `window` or `document` access in render | Server throws `ReferenceError` |
| Server/client conditional altering HTML shape | Hydration mismatch |

Client-only behavior must:

1. Render a stable placeholder on the server.
2. Hydrate without altering the DOM structure.
3. Reveal client-only content only after mount.

Playwright must fail any test where the browser console emits a hydration
warning.

---

## 4. Layout and Responsiveness Coverage

E2E tests must verify layout at two viewports:

| Viewport | Dimensions | What to Check |
|----------|-----------|---------------|
| Mobile | 390×844 | Header and responsive navigation usable, content visible, footer reachable, no horizontal overflow |
| Desktop | 1280×720 | Top navigation visible, ads absent by default, content area renders correctly |

Use structural assertions, not pixel-perfect comparisons:

- Assert elements exist in the DOM.
- Assert elements are visible (not `display: none` unless intentionally hidden
  at that viewport).
- Do not assert exact pixel dimensions or positions.
- Assert no console errors at any viewport.

---

## 5. Required Tests When Adding

### New tool

1. Unit test for tool logic functions (pure transformation, validation).
2. Contract test: verify slug and ID uniqueness after registration.
3. E2E test: verify the tool page loads and renders the tool component by slug.

### New category

1. Contract test: `getAvailableCategory()` includes the new category.
2. E2E test: category page loads and lists tools in that category.

### New API route

1. Contract test: valid request returns the correct status code.
2. Contract test: invalid request returns 400.
3. Integration test: route handler processes a valid payload correctly.

### Layout changes

1. E2E tests at mobile and desktop viewports.
2. Assert no new console errors.

### New analytics event

1. Update `AnalyticEventName` in `src/module/analytics/type.ts`.
2. Contract test: event name is in the declared set.
3. Contract test: payload is JSON-serializable.

### New storage key

1. Update SCHEMA.md storage key table.
2. Contract test: key reads `null` when not set.
3. Contract test: `storage.set` then `storage.get` returns the correct value.

---

## 6. Determinism and Flake Prevention

Rules:

- No time-based assertions (`Date.now()`, `new Date()`, timer waits).
- No animation-based assertions (delay-based waits, `waitForAnimation`).
- No retry loops that mask underlying flakiness.
- Seed randomness explicitly if a tool or utility uses `Math.random()`.
- Network requests in E2E tests must be stubbed or use a consistent local dev
  server.

---

## 7. Prohibitions

- No network calls in unit or contract tests.
- No broad snapshot tests that fail on trivial HTML changes.
- No hiding hydration warnings by filtering console output.
- No bypassing the observability facade in tests (e.g., importing directly from
  `analytics/` in a tool test to skip `observability/`).
- No skipping failing tests without documented justification.
- No `test.only` committed to `master`.
- No mocking of core behavior (storage adapter, observability facade) in
  integration tests unless explicitly testing the mock layer itself.

---

## 8. Final Principle

Testing enforces architecture.

Every module boundary must be validated.
Every registered tool must satisfy its contract.
Every render path must be SSR-safe.
Every user flow must be verified in a real browser.

If a test fails, the architecture contract was violated.

Fix the violation.
Testing is structural enforcement, not checkbox coverage.

## Production integrations

### Persistent observability and independent dashboard

Root unit tests retain `/api/log` compatibility and verify backward-compatible
metric variants, bounded client errors, free-form field rejection, query/hash
rejection before persistence, coarse viewport boundaries, dual-sink deduplication,
real ToolErrorBoundary behavior, safe SQL projection, missing configuration,
same-origin browser checks, safe database failures, and cron authorization.
The Neon network boundary alone is mocked in unit tests; actual rollup,
idempotence, late-day recomputation and retention run against disposable SQL.

`npm run test:observability-db` owns one uniquely named Postgres 17 container,
applies schema twice with container psql, verifies counts/continuous percentiles,
reruns, recent recomputation, unrolled-old retention/rolled-old deletion,
current-day exclusion, historical aggregate preservation, all actual dashboard
query plans and read-only grants. It cleans up only its own container in finally.
No locally installed psql or Neon secret is required. Reports are unique under
`test-report/observability-db-<RUN_ID>/`, including postgres.log and summary.json.

Dashboard validation is independent: `npm --prefix dashboard ci` then
`npm --prefix dashboard run verify`. Typecheck/lint/Vitest/build require no
production database. Tests cover all ranges, source choice, UTC binning, exact
view-model totals, disjoint daily/current-day sources, empty states, honest
percentile labels, query privacy, read-only requests, failure configuration,
client dependency boundaries, no auth dependencies and crawler protection.
Reports live at `dashboard/test-report/<RUN_ID>/` and are uploaded by its workflow.

`npm --prefix dashboard run test:visual` serves the production DashboardView
with an isolated deterministic query-repository fixture, never a production
adapter switch. It captures 24h/90d/1y/All time desktop, mobile and system-dark
PNG evidence in a unique dashboard/test-report directory. Inspect the captures
after running; this does not establish production traffic or performance.

Normal public E2E/container runs explicitly keep both browser telemetry and
server persistence disabled. No automated app test writes production Neon.
Migration missing-configuration behavior may be tested locally; successful SQL
application is proved in disposable Postgres, not by provisioning external Neon.
Migration tests also verify one-transaction statement execution and suppression
of both URL-constructor and SQL/connection diagnostics. Actual CLI probes with
missing configuration and a synthetic invalid URL exit 1 without printing the
configured value. Dashboard runtime smoke verifies real HTTP 500/no metrics and
crawler headers without a database; ISO text projection prevents driver Date
objects from reaching display components.

Default builds and E2E/container tests keep both public enable flags false/absent. Enabled AdSense contracts use stubs; never click ads or rely on live Google responses. The shared browser fixture aborts and fails on any Google advertising request. Disabled integration tests check meta, exact ads.txt, absent units/script/fake footer and no metric/log transport. Unit tests cover typed metrics, 8 KiB limits, safe log projection, query/hash removal, File/Blob/input exclusions, fail-silent providers, Web Vitals callback, early errors/navigation, identity omission and ad init dedup/failure. Container smoke explicitly disables flags and verifies ads.txt plus health before the full suite. Every run writes a unique report. Current default shell has no ad tracks; enabled right rail is 176px at xl.

### Vercel Web Analytics v0.3.1

`src/module/analytics/vercelWebAnalytics.test.ts` owns exact-true enablement and
URL sanitizer contracts. `src/component/observability/VercelWebAnalytics.test.tsx`
and `src/app/layout.test.tsx` cover the app-owned wrapper and single root mount.
The normal `test/e2e/vercel-analytics.spec.ts` verifies disabled local behavior.
`npx tsx script/vercelAnalyticsSmoke.ts` creates an isolated enabled production
build and browser context to check automatic initial/navigation views and query,
hash and tool/file privacy. It validates intake semantically without assuming
a fixed script or endpoint path, and does not prove live Vercel receipt. Local
E2E and container builds keep the public flag false; container validation
remains default-off. See the implementation and reconciliation reports for
version-specific results and evidence boundaries.

## UI/discovery Delivery 2 acceptance

Focused tests verify registry-derived sitemap membership, environment robots/noindex boundary, apex-stable canonical/social metadata, server guide content and canonical related IDs. Production E2E extends current image flows and checks breadcrumbs, initial HTML, metadata, Light/Dark responsive workspace allocation, downloads/reset/focus, and protected routes. Observer geometry uses the approved Resizer precedent at 1440×900 and 390×844 through semantic containment/allocation/order contracts. Child targets precede containers for the current directional fit API; intentional guide/document-height changes are not protected absolute Y coordinates. Frozen supplementary scroll lanes establish document scrolling and viewport reachability; its current capture API cannot apply selected-file/theme state, so Playwright owns those runtime states. Generated evidence remains under test-report/ or ignored project workflow roots.

## Document family validation

Adjacent document-domain Vitest tests cover frozen source/collection/render
limits, page-selection order and deduplication, atomic additions, worker
protocol/termination, independent verification, cancellation/stale generations,
local errors, focus and URL cleanup. Registry/metadata/guide/sitemap tests
protect five document tools, 15 total tools, six populated categories and
23 canonical sitemap URLs. Operation-specific browser specs are
`pdf-page-copy.spec.ts`, `images-to-pdf.spec.ts`, `pdf-to-image.spec.ts` and
`compress-pdf.spec.ts`; `document-family.spec.ts` covers discovery/search,
SSR/canonicals/related links, accessible landmarks, keyboard Reset, bounded
source failures, four independent cold routes and all-five warmed offline
operations. Parser/runtime acceptance uses real deterministic fixtures with
provenance in `test/fixtures/pdf/README.md`; mock tests alone are not proof of
PDF fidelity or native worker behavior.

Existing PDF-specific commands use installed project-local dependencies:

| Gate | Command |
| --- | --- |
| Runtime manifests, checksums and notices | `node node_modules/tsx/dist/cli.mjs script/pdfAssetsVerify.ts` |
| Real production-browser foundation corpus | `node node_modules/tsx/dist/cli.mjs script/pdfFoundationSmoke.ts` |
| Selected-page raster-export foundation | `node node_modules/tsx/dist/cli.mjs script/pdfFoundationSmoke.ts --pdf-to-image` |
| Standalone foundation runtime | `node node_modules/tsx/dist/cli.mjs script/pdfFoundationSmoke.ts --container` |

See [foundation instructions](../script/pdfFoundation.md) for the temporary
test-only harness, unique reports, local browser cache, cleanup and normal
rebuild requirements, and [QPDF build instructions](../script/qpdf/README.md)
for controlled fresh-cache reproducibility. Normal builds do not compile QPDF.
`npm run verify`, `npm run test:e2e` and `npm run test:container` retain their
existing responsibilities; PDF-specific checks are explicit script commands,
not additional package scripts. There is no `docs:check` package command.
Documentation consistency uses a source/docs claim matrix, targeted searches,
package-script checks and registry/metadata/guide/sitemap comparisons.

Batch 6 used project-local headless my-frontend-observer 0.10.0 with ten
document lanes: five routes at 1440×900 and 390×844. Semantic containment,
visibility, ordering, overlap, scrolling and horizontal-overflow checks passed
without recapturing homepage/image baselines. Idle Split observes its visible
Add group control; loaded groups, result states and conditional JPEG controls
are browser-test responsibilities. Local Batch 6 browser/container acceptance
is inherited implementation evidence; hosted v0.3 exact-SHA readiness remains
a separate workflow. Run IDs/counts belong in the implementation report and
ignored run evidence, not generic command examples.

## Diagnostic hotfix

Diagnostic validation includes serializer/redactor/API/client/server tests, additive migration order, actual PostgreSQL insertion/30-day pruning/read-role rejection/all range query plans, independent dashboard verify/runtime/visual, root verify, public E2E and container. Existing unique report directories apply. Production smoke uses exactly one operator-controlled diagnostic and checks matching UUID/message/stack/deployment in logs, Neon and protected dashboard.

## QR Code Generator validation

The production QR encoder (`uqr`) and the test decoder (`jsqr`) are independent
and both exact-pinned; `jsqr` is a devDependency and is never imported from
production source (a unit test asserts this). Unit tests decode the
project-rendered RGBA pixels with `jsqr` and read the matrix format bits with a
small test-only reader to prove error-correction level M. Playwright downloads
the real PNG, checks its signature and IHDR (512×512), redraws it in the browser
and decodes the pixels with `jsqr` in Node. Encoder self-validation (the library
decoding or describing its own output) is not accepted as correctness proof.
