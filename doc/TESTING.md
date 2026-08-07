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

**Status: planned, not yet implemented.** As of this reconciliation pass there
is no `@playwright/test` dependency, Playwright config, or `*.spec.ts` file in
the repository, and `npm run test` only executes Vitest (`vitest run`). The
rules below define the intended discipline for when Playwright is introduced;
until then, layout, routing, and hydration behavior are exercised only through
Vitest unit/contract tests and manual verification. Do not treat this section
as evidence that E2E coverage currently exists.

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
- Desktop viewport (1280×720): vertical nav, banner slots, and content area are
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
| Mobile | 390×844 | Header visible, vertical nav hidden or collapsed, content visible, no overflow |
| Desktop | 1280×720 | Vertical nav visible, banner slots present, content area renders correctly |

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
