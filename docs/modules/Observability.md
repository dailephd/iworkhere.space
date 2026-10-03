# Module: Observability

**Kind:** Module

## Production integration

The facade remains authoritative. `captureError` deduplicates the same object by identity before logging; raw local error metadata is filtered at the network provider boundary. New metric/log validators, transport, early client initialization and dedup helpers are co-owned here. No vendor SDK or parallel logging system exists. See [OBSERVABILITY](../OBSERVABILITY.md) for privacy, endpoints and activation.

<!-- section-id: representative-file -->
## Representative File

`src/module/observability/index.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: contract -->
## Contract (added 2026-08-07 reconciliation)

The facade every tool and boundary must call instead of `analytics`/`log`
directly.

```typescript
function trackEvent<E extends AnalyticEventName>(event: E, prop: AnalyticEventProp[E]): void
function logEvent(message: string, meta?: Record<string, unknown>): void
function captureError(
    error: Error | unknown,
    meta?: Record<string, unknown>,
    trackAsEvent?: { name: AnalyticEventName; prop: AnalyticEventProp[AnalyticEventName] }
): void
```

- `trackEvent` delegates to `track()` from `@/module/analytics`.
- `logEvent` delegates to `log.info()` from `@/module/log/logger`.
- `captureError` logs the first occurrence via `log.error(message, { ...meta, stack,
  originalError })`, converting non-`Error` values with `String(error)`; it
  additionally calls `track()` only when `trackAsEvent` is supplied.
- Consumers: `ToolClientFrame` calls `logEvent`/`trackEvent` on tool
  open/execute and `captureError` on `setQuery` failures;
  `ToolErrorBoundary` calls `captureError` on render failure.

<!-- section-id: member-files -->
## Member Files

- `src/module/observability/index.ts` [barrel]
- `metric.ts` / `transport.client.ts`: exact measurement validation and fail-silent transport; optional viewport class.
- `errorMetric.client.ts` / `errorDedup.ts`: explicit safe reliability projection and independent per-sink identity deduplication.
- `clientInstrumentation.ts`: global errors, rejections and navigation; diagnostic logging remains via the facade.
- `persistence.server.ts`: server-only Neon measurement projection and maintenance delegation, used only by API transport adapters.
- SQL schema/transaction ownership: `database/observability/`; private read-only query/view ownership: independent `dashboard/`.

`reportClientErrorMetric(error, {failureCategory, toolId?})` uses the error only
as a WeakSet identity key, never to derive fields. ToolErrorBoundary calls this
explicit operation alongside captureError. `/api/log` remains diagnostic-only;
`/api/metric` alone persists measurements. No log metadata is serialized into
durable reliability records. Database and migration secrets stay server-side.

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/module/observability/index.ts
- file-role: barrel
- filename: index.ts
- Derived from single-file merged unit "Observability".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.
