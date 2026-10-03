# API

This document defines the stable module contracts and extension points for this
platform.

It answers: what can safely be imported, extended, and relied upon across
boundaries.

All code must treat these definitions as contracts.
Violating them is an architectural breach.

---

## 1. What Is Public and Stable

The following are stable interfaces:

- **Tool registry contract** — the shape of a `ToolDefinition` and how tools are
  registered
- **Observability API** — `trackEvent`, `logEvent`, `captureError`
- **Storage API** — `storage.get`, `storage.set`, `storage.remove`
- **Metadata query API** — functions exported from `src/module/tool/metadata.ts`
- **SEO builder API** — `buildToolMetadata`, `buildCategoryMetadata` from
  `src/lib/seo.ts`
- **API route response contracts** — `/api/health`, `/api/log`, `/api/metric`,
  and `/api/observability/maintenance`; telemetry and persistence details are
  owned by `SCHEMA.md` and `OBSERVABILITY.md`

The following are internal and must not be imported across layers:

- Registry internals (direct `tool_definition_list` array access outside the
  registry module)
- Log provider implementations directly
- Analytics provider implementations directly

---

## 2. Tool Registry Contract

**Source:** `src/module/tool/registry.ts`

Every tool must be registered as a `ToolDefinition` with the following required
fields:

| Field | Type | Constraint |
|-------|------|------------|
| `id` | `ToolId` | Globally unique string across all tools |
| `slug` | `string` | URL-safe, lowercase, hyphen-separated; unique |
| `name` | `string` | Non-empty human-readable display name |
| `description` | `string` | One-sentence description |
| `category` | `ToolCategory` | One of the declared category values; see SCHEMA.md |
| `seo` | `ToolSeo` | Metadata for page generation; see SCHEMA.md |
| `capability` | `ToolCapability[]` | Subset of declared capability values; see SCHEMA.md |
| `statePolicy` | `ToolStatePolicy` (optional) | URL query sharing configuration |
| `Component` | `React.ComponentType<ToolComponentProp>` | The tool's React component |

Rules:

- `slug` must be globally unique across `tool_definition_list`.
- `id` must be globally unique across `tool_definition_list`.
- A tool must not be registered more than once.
- `category` must be one of the declared `ToolCategory` values.
- No dynamic registration or reflection-based discovery.
- Every new tool must be explicitly imported and added to `tool_definition_list`.

---

## 3. Tool Metadata API

**Source:** `src/module/tool/metadata.ts`

This is the public query layer wrapping the registry. All consumers must use
these functions, not `registry.ts` directly.

| Function | Returns | Description |
|----------|---------|-------------|
| `getAllTool()` | `ToolDefinition[]` | All registered tools |
| `getToolSeoBySlug(slug)` | `ToolSeo \| undefined` | SEO data for a tool |
| `getAllToolSeo()` | `ToolSeo[]` | SEO data for all tools |
| `getAvailableCategory()` | `ToolCategory[]` | Distinct categories present in the registry |
| `getToolCount()` | `number` | Total registered tool count |
| `getAllTag()` | `string[]` | All distinct tags across registered tools, sorted |
| `getToolByTag(tag)` | `ToolDefinition[]` | Tools that declare the given tag |
| `getToolByPopularity()` | `ToolDefinition[]` | All tools sorted by descending `popularity` (missing popularity treated as 0) |

`getToolBySlug(slug)` and `getToolByCategory(category)` are exported by
`registry.ts` itself (see §2), not by `metadata.ts`. `metadata.ts` does not
re-export them.

Rules:

- All metadata queries must go through `metadata.ts`, not `registry.ts`
  directly, except `getToolBySlug`/`getToolByCategory` which are registry
  exports used directly by route handlers (see §5).
- No tool data may be hardcoded outside the registry.
- New query functions go in `metadata.ts`, not `registry.ts`.

---

## 4. Tool Component Interface

All tool components must implement `ToolComponentProp`:

```typescript
interface ToolComponentProp {
  toolId: ToolId;
  query?: Record<string, string>;
  setQuery?: (next: Record<string, string>) => void;
}
```

Rules:

- Tool components must declare `"use client"`.
- Tool components must be self-contained with no routing knowledge.
- Tool components must not import from `app/`.
- Tool components live in `src/module/tool/<category>/`.

---

## 5. Slug Routing Contract

URL structure: `/tool/[slug]`

Rules:

- `tool/[slug]/page.tsx` is a Server Component.
- It calls `getToolBySlug(slug)` and returns `notFound()` if the result is
  missing.
- It renders `ToolClientFrame` with the resolved tool definition.
- `ToolClientFrame` is responsible for mounting the tool component and syncing
  URL state.
- The page must export `generateMetadata` using `buildToolMetadata(tool.seo)`.

Category routing: `/category/[category]`

- Must call `getToolByCategory(category)` and `notFound()` if the result is
  empty.
- Must export `generateMetadata` using `buildCategoryMetadata(...)`.

No business logic or tool logic may live in `app/` pages.

---

## 6. Server vs Client Boundary Rules

| Component | Rendering |
|-----------|-----------|
| `app/**/page.tsx` | Server Component |
| `app/**/layout.tsx` | Server Component |
| `AppShell` | Server Component |
| `ToolClientFrame` | Client Component |
| All tool components | Client Component |
| `ThemeToggle` | Client Component |
| `VerticalNav` | Client Component |
| `ServiceWorkerRegister` | Client Component |

Rules:

- Pages must not be marked `"use client"`.
- Layouts must not be marked `"use client"`.
- Only Client Components may use browser APIs (`window`, `document`,
  `localStorage`).
- Client Components must be SSR-safe: no browser API access in module scope or
  in the render path.

For full layer responsibilities see `doc/architecture.md`.

---

## 7. Observability Contract

**Source:** `src/module/observability/`

Public API:

| Function | Purpose |
|----------|---------|
| `trackEvent(event, prop)` | Product metrics — tool usage events |
| `logEvent(message, meta?)` | System debugging — info-level log |
| `captureError(error, meta?, trackAsEvent?)` | Error logging with optional analytics emission |

Allowed event names (see SCHEMA.md for payload shapes):

- `tool_opened`
- `tool_executed`
- `tool_result_copied`
- `tool_mode_changed`

Rules:

- Tools must only call `trackEvent` or `logEvent` from `@/module/observability`.
- Tools must never import from `@/module/analytics` or `@/module/log` directly.
- Error boundaries must use `captureError`.
- All observability calls must be non-blocking and must never throw.
- Adding a new event requires updating `AnalyticEventName` in
  `src/module/analytics/type.ts` first.

---

## 8. Storage Contract

**Source:** `src/lib/storage.ts`

Public API:

| Function | Signature | Description |
|----------|-----------|-------------|
| `storage.get<T>(key)` | `(key: string) => T \| null` | Read and deserialize |
| `storage.set<T>(key, value)` | `(key: string, value: T) => void` | Serialize and write |
| `storage.remove(key)` | `(key: string) => void` | Delete key |

Rules:

- No direct `localStorage` calls outside `src/lib/storage.ts`.
- All storage calls are SSR-safe: they are no-ops when `window` is undefined.
- JSON serialization is handled internally by the adapter.
- The storage backend is swappable without changing consumer code.

Declared storage keys and their value types are documented in SCHEMA.md.

---

## 9. Error Boundary and Error Capture Discipline

**Source:** `src/component/tool/ToolErrorBoundary.tsx`

- Every tool is wrapped in `ToolErrorBoundary` inside `ToolClientFrame`.
- `ToolErrorBoundary` calls `captureError(error, { toolId, componentStack })`
  automatically on render failure.
- It renders a user-friendly fallback with a "Try again" action.
- No tool component may catch and silently swallow errors.
- Explicit `try/catch` blocks at architectural boundaries must call
  `captureError`.

---

## 10. API Route Contracts

### POST /api/log

Accepts only the safe diagnostic projection sent by `RustLogProvider`. Its
sanitized logging allowlist and exact accepted response behavior are documented
in [Observability](OBSERVABILITY.md). This endpoint is diagnostic-only; it does
not write durable measurements.

### POST /api/metric

Accepts the bounded, exact discriminated measurement payload documented in
[SCHEMA.md](SCHEMA.md). It is the only durable metrics ingestion route. With
persistence disabled, it records the safe operational event and returns without
connecting to Neon.

### GET /api/observability/maintenance

Vercel Cron maintenance route. It requires `Authorization: Bearer CRON_SECRET`
and performs the schema-owned daily rollup and safe retention operation. See
[Observability](OBSERVABILITY.md) and [database ownership](../database/observability/README.md).

### GET /api/health

Response:
- `200 OK` — service is reachable

No response body required.

---

## 11. Service Worker Contract

**Source:** `public/sw.js`

- The service worker is registered only in production via
  `ServiceWorkerRegister`.
- It must not be registered in development mode.
- Navigation requests use network-first with cache fallback.
- Static assets use cache-first with network fallback.
- API routes (`/api/*`) are never cached.
- The SW cleans old caches on activate and claims all clients immediately.

---

## 12. Stability and Versioning Policy

The following are treated as stable contracts:

- `ToolDefinition` field names and types
- `ToolComponentProp` interface
- Observability function signatures (`trackEvent`, `logEvent`, `captureError`)
- Storage function signatures (`storage.get`, `storage.set`, `storage.remove`)
- Analytics event names
- API route request and response shapes

Breaking changes require:

- Updating this document
- Updating SCHEMA.md
- Updating `doc/architecture.md` if layer boundaries are affected
- Explicit communication in the PR description

No silent interface changes.
