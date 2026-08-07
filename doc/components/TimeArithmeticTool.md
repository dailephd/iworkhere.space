# Component: TimeArithmeticTool

**Kind:** Component

> Added 2026-08-07 reconciliation: no spec existed for this component prior to
> this pass, even though it is registered in `tool_definition_list`
> (`src/module/tool/registry.ts`, tool id `time-arithmetic`). This is a
> hand-authored addition, not output of the Milestone 12 ingestion pass that
> produced the other files in this directory.

<!-- section-id: representative-file -->
## Representative File

`src/module/tool/time/TimeArithmeticTool.tsx`

<!-- section-id: member-files -->
## Member Files

- `src/module/tool/time/TimeArithmeticTool.tsx` [implementation]
- `src/module/tool/time/timeArithmetic.ts` [pure logic — `calculateTime`, `addTime`, `subtractTime`, `parseTime`]
- `src/module/tool/time/timeArithmetic.test.ts` [test-companion, 31 tests]

<!-- section-id: responsibility -->
## Responsibility

Client Component implementing `ToolComponentProp` (`toolId`; `query`/
`setQuery` accepted but unused — registered with `statePolicy: { persist:
"none", shareableQuery: false }`, so URL state sharing is intentionally off
for this tool). Renders two `HH:MM` time inputs, an add/subtract operation
selector, and a result panel.

## Behavior

- Delegates all arithmetic to the pure `calculateTime(left, operation, right)`
  function in `timeArithmetic.ts`, which parses `HH:MM` (unbounded hours,
  two-digit minutes 00–59) via a regex, converts to total minutes, applies
  add/subtract, and re-formats. Returns a discriminated result:
  `{ ok: true, value }` or `{ ok: false, error }` where `error` is one of
  `"invalid-left" | "invalid-right" | "negative-result"`.
- Local component state only (`useState` for both inputs and the operation);
  nothing is persisted or synced to the URL.
- Fires `trackEvent("tool_opened", { toolId, slug: "time-arithmetic" })` once
  on mount (guarded by a `useRef` flag) and `trackEvent("tool_executed", ...)`
  whenever a new non-empty result is produced (deduplicated against the
  previous tracked result via `useRef`), both via
  `@/module/observability` — consistent with the observability contract in
  `doc/API.md` §7.
- Does not call `logEvent` directly (unlike `ToolClientFrame`, which already
  logs tool-open/execute at the frame level).

## Contract notes

- Errors are surfaced as inline field-level text, not thrown — matches
  `doc/TESTING.md` "no silent fallback" principle for validation but does not
  throw, since this is UI-facing input validation rather than a module
  boundary contract violation.
- Slug (`"time-arithmetic"`) is hardcoded in two `trackEvent` call sites
  inside the component rather than derived from `toolId`/routing — a minor,
  low-risk duplication versus deriving it from `pathname` the way
  `ToolClientFrame` does; noted here for future consolidation, not fixed in
  this documentation-only pass.
