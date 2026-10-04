# SCHEMA

This document defines the canonical data contracts between modules in this
platform.

These include TypeScript-level interface contracts and the dedicated observability
database contract. SQL ownership lives in `database/observability/001-schema.sql`.

No module may assume undocumented fields.
No module may introduce undocumented fields without updating this document.

Silent reinterpretation of data is forbidden.

---

## 1. Core Design Principles

1. All contracts are explicit TypeScript interfaces.
2. All required fields must be present. Optional fields must be clearly marked.
3. No implicit type coercion.
4. Validation failures must throw explicit errors, not silently fall back.
5. Field names must be descriptive.

---

## 2. Tool Definition Schema

**Source:** `src/module/tool/type.ts`, `src/module/tool/registry.ts`

A `ToolDefinition` represents one registered tool.

### Required Fields

| Field | Type | Constraint |
|-------|------|------------|
| `id` | `ToolId` | Globally unique string across all tools |
| `slug` | `string` | URL-safe, lowercase, hyphen-separated; unique |
| `name` | `string` | Non-empty human-readable display name |
| `description` | `string` | One-sentence description |
| `category` | `ToolCategory` | See allowed values below |
| `seo` | `ToolSeo` | Required; see SEO sub-schema below |
| `capability` | `ToolCapability[]` | Non-empty; see allowed values below |
| `statePolicy` | `ToolStatePolicy` (optional) | URL state sharing configuration |
| `Component` | `React.ComponentType<ToolComponentProp>` | The tool's React component |

The field is `capability` (singular) and `Component` (capital `C`) in the
current `ToolDefinition` interface (`src/module/tool/type.ts`), not
`capabilities` / `component`. `statePolicy` is optional — several registered
tools (`slugify`, `length-converter`, `html-text-extractor`,
`weight-converter`) omit it.

### Allowed Category Values

`document` | `image` | `text` | `math` | `time` | `everyday`

New categories must be added to the `ToolCategory` type and to this document
before use.

### Allowed Capability Values

`client-only` | `offline` | `requires-network`

A tool that runs entirely in the browser and works offline must declare both
`client-only` and `offline`.
A tool that needs network access must declare `requires-network`.

### ToolSeo Sub-Schema

**Source:** `src/module/tool/type.ts` (`ToolSeo`)

| Field | Type | Required |
|-------|------|----------|
| `title` | `string` | Yes |
| `description` | `string` | Yes |
| `canonicalPath` | `string` | Yes |

The field is named `canonicalPath`, not `canonical`. There is no `keywords`
field on `ToolSeo` in the current implementation.

### Validation Rules

- `id` must be unique across `tool_definition_list`.
- `slug` must be unique across `tool_definition_list`.
- `category` must be one of the declared `ToolCategory` values.
- `seo.title` must be non-empty.
- `seo.description` must be non-empty.
- Duplicate registration is forbidden and must fail explicitly.

---

## 3. Analytics Event Schema

**Source:** `src/module/analytics/type.ts`

All analytics events must use a declared event name and a typed payload.

### Event Name Policy

| Event Name | Trigger |
|------------|---------|
| `tool_opened` | User navigates to a tool page |
| `tool_executed` | User runs the tool (e.g., clicks Calculate) |
| `tool_result_copied` | User copies the tool output |
| `tool_mode_changed` | User switches tool mode or setting |

Rules:

- Only event names declared in `AnalyticEventName` are allowed.
- Adding a new event requires updating `AnalyticEventName` in `type.ts` first.
- Event names are stable identifiers. Do not rename without a versioning note.
- No free-form strings as event names.

### Payload Shape Rules

- All payloads must use named TypeScript interfaces.
- Payload fields must be JSON-serializable.
- No functions, class instances, or DOM references in payloads.
- No PII (personally identifiable information) in event payloads.
- Optional fields must be typed as `field?: Type`, not `field: Type | undefined`.

---

## 4. Logging Record Schema

**Source:** `src/module/log/types.ts`

All log records produced by the logging module must conform to this schema.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `level` | `"debug" \| "info" \| "warn" \| "error"` | Yes | Severity |
| `message` | `string` | Yes | Human-readable log message |
| `timestamp` | `string` | Yes | ISO 8601 UTC timestamp |
| `meta` | `Record<string, unknown>` | No | Structured context |
| `url` | `string` | No | Page URL at time of log |

### Safe Payload Rules

- No secrets, tokens, or credentials in log records.
- `meta` values must be JSON-serializable.
- Log records must never block the UI thread.
- If sending to `/api/log`, the request must be fire-and-forget (fail-silent).

---

## 5. Storage Key Schema

**Source:** `src/lib/storage.ts`

All storage keys used in the application are declared here.

| Key | Value Type | Consumer | Description |
|-----|-----------|----------|-------------|
| `"theme"` | `ThemeId` (`"system" \| "light" \| "dark" \| "onedark"`) | `themeStorage.ts` (`src/module/theme/`) | User theme preference; see `docs/architecture.md` theme module section |
| `"recent-tool"` | `string[]` | `recentlyUsed` module (`src/module/tool/recentlyUsed.ts`) | Ordered list of tool slugs (max 10) |
| `"analytic_event_count"` | `Record<string, number>` | analytics local provider (`src/module/analytics/provider.ts`) | Per-event occurrence count |

The actual key strings are `"recent-tool"` (not `"recently-used"`) and
`"analytic_event_count"` (underscore, not `"analytic-event-count"`) — this
table previously did not match the implementation.

New storage keys must be added to this table before use.

### Serialization Rules

- All values are JSON-serialized by the storage adapter.
- Consumers must never call `JSON.parse` or `JSON.stringify` directly on stored
  values.
- If a stored value fails to parse, the adapter returns `null`. Consumers must
  handle `null`.
- No raw string storage of complex objects.

### SSR Safety Rules

- All storage reads and writes are no-ops when `window` is undefined.
- No storage access in Server Components.
- No storage access in module scope (top-level statements outside functions).

---

## 6. API Route Response Schemas

### Production telemetry (explicit opt-in)

`POST /api/metric` accepts an exact discriminated JSON object, at most 8 KiB:

- Common: `type`, ISO `timestamp`, safe `pathname` (no query/hash), optional `deviceClass` (mobile/tablet/desktop/unknown).
- `analytic-event`: canonical `event`, `prop: {toolId, slug}`. Mode values are omitted from transport.
- `web-vital`: `name` (LCP/INP/CLS/FCP/TTFB/FID), finite nonnegative `value`, finite `delta`, bounded `id`, optional `rating` and `navigationType` enums.
- `navigation`: `navigationType` (initial/push/replace/traverse), optional `referrerHostname` only.
- `client-error`: required `failureCategory` (window-error/unhandled-rejection/tool-render-error/unknown), optional bounded `toolId`. No message, stack, error object or metadata.

Unknown fields, arbitrary metadata, malformed numbers, invalid routes and oversized bodies return 400. Accepted requests write structured runtime logs. Persistence disabled or successful insert returns 204; explicit enabled persistence with configuration/database failure returns empty 503. Production persistence additionally checks available same-origin browser headers (403 on mismatch). There is no identity/session field. Existing accepted variants remain backward compatible without deviceClass.

DeviceClass means CSS viewport width only: <768 mobile, 768–1023 tablet,
>=1024 desktop, missing/invalid unknown. The server normalizes omitted values to
unknown. No physical-device/OS detection occurs.

The durable event table has id, occurred_at, received_at, kind, pathname, tool_id,
event_name, metric_name, metric_value, metric_rating, failure_category,
device_class, referrer_host and navigation_type. Both timestamps are server
database now(), never client timestamps. All columns are explicit; no generic
JSON exists in metric tables. Vital id/delta remain outside metric storage; separate error_diagnostic records store bounded redacted diagnostic text and structured context.
Daily count dimensions normalize optional values to empty strings and include
safe referrer_host for long-range breakdowns. Daily_vital stores sample_count and
Postgres continuous p50/p75/p95 per day/path/metric/viewport group. Rollup_day
records day and successful completion timestamp. See the database README for
constraints, indexes, transaction ownership and 90-day raw/indefinite daily retention.

`GET /api/observability/maintenance` takes Authorization: Bearer CRON_SECRET,
returns 401 for missing/invalid authorization, 204 after atomic daily rollup and
safe retention, and empty 503 for persistence/configuration/database failure.

Network logs preserve redacted bounded messages and useful Error fields/stacks; URLs omit query/hash. Explicit runtime context replaces arbitrary metadata. File/Blob, filenames, input/output, dimensions, full URLs, query/hash, storage, cookies and identity are excluded at the transport boundary. Default telemetry remains local unless `NEXT_PUBLIC_OBSERVABILITY_ENABLED=true`.

**Source:** `src/app/api/`

### POST /api/log

Request shape:

```typescript
{
  level: "debug" | "info" | "warn" | "error";
  message: string; // redacted, at most 4096 UTF-8 bytes
  timestamp: string; // ISO 8601
  pathname: string; // no query/hash
  meta: { toolId?: string; boundary?: string; failureCategory?: string; placement?: string }; // semantic allowlist
  diagnostic?: ErrorDiagnostic; // module/observability/diagnostic.ts strict client contract
}
```

Response:

- `204 No Content` — valid request accepted
- `400 Bad Request` — invalid body shape or unknown level

### GET /api/health

Response:

- `200 OK` — service is reachable

Response body: `{ "status": "ok" }`.

---

## 7. Recently Used Tool Schema

**Source:** `src/module/tool/recentlyUsed.ts`

The recently-used list is a `string[]` of tool slugs stored under the
`"recent-tool"` key.

| Property | Constraint |
|----------|------------|
| Element type | `string` (tool slug) |
| Max length | 10 entries |
| Ordering | Most recently used first |
| Deduplication | Each slug appears at most once |

Rules:

- `recordRecentTool(slug)` prepends the slug, deduplicates, and trims to max 10.
- Slugs must correspond to registered tools, but the schema does not enforce
  this at read time.
- Consumers must handle stale slugs gracefully (e.g., tool removed from
  registry).

---

## 8. Validation Rules

Before consuming data across a module boundary:

- Validate required fields exist.
- Validate field types match the declared contract.
- Validate enumerated values are within the declared set.
- If validation fails, throw an explicit error. Do not silently fallback or
  coerce.

---

## 9. Versioning Strategy

When a schema changes:

- Update this document first.
- Update the corresponding TypeScript interface.
- Update consumers if field names or types change.
- Do not silently rename or remove fields.
- Do not reinterpret an existing field with a new semantic meaning.
- If the change is breaking, communicate explicitly in the PR description.

Schema integrity is foundational to reliability.


## Diagnostic hotfix

ErrorDiagnostic: UUID id; ISO reporter timestamp; 64-hex SHA-256 fingerprint; client/server origin; warn/error severity; canonical DiagnosticError; explicit DiagnosticContext; server-added DeploymentContext. /api/log accepts client origin only, rejects additional fields and browser deployment claims, limits payload to 64 KiB. error_diagnostic contains received/reported times, searchable name/message/stack/cause/component/path/tool/boundary/category/fingerprint and bounded contexts. See additive 002 SQL and OBSERVABILITY.md.
