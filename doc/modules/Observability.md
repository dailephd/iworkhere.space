# Module: Observability

**Kind:** Module

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
- `captureError` always logs via `log.error(message, { ...meta, stack,
  originalError })`, converting non-`Error` values with `String(error)`; it
  additionally calls `track()` only when `trackAsEvent` is supplied.
- Consumers: `ToolClientFrame` calls `logEvent`/`trackEvent` on tool
  open/execute and `captureError` on `setQuery` failures;
  `ToolErrorBoundary` calls `captureError` on render failure.

<!-- section-id: member-files -->
## Member Files

- `src/module/observability/index.ts` [barrel]

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
