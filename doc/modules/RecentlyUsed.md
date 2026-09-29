# Module: RecentlyUsed

**Kind:** Module
**Scope:** Multi-file logical unit (2 source files)
**Group:** src/module

<!-- section-id: representative-file -->
## Representative File

`src/module/tool/recentlyUsed.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: contract -->
## Contract (added 2026-08-07 reconciliation)

Tracks which tool slugs the user opened most recently, backed by `storage`
under the key `"recent-tool"` (not `"recently-used"` — a prior mismatch
between this key and `doc/SCHEMA.md` has been corrected in this pass).

```typescript
function getRecentTool(): string[]
function recordRecentTool(slug: string): void
function clearRecentTool(): void
```

- `getRecentTool()` reads the stored array; returns `[]` if the stored value
  is missing or not an array (defensive against stale/corrupt data).
- `recordRecentTool(slug)` removes any existing occurrence of `slug`, prepends
  it, and truncates to `MAX_RECENT = 10` entries (most-recent-first,
  deduplicated).
- `clearRecentTool()` removes the storage key entirely.
- **Not currently wired up**: no caller in the codebase invokes
  `recordRecentTool` — `ToolClientFrame` (`src/component/tool/ToolClientFrame.tsx`)
  fires `trackEvent`/`logEvent` on tool open/execute but does not call this
  module. This matches `doc/project-status.md` "Next Steps" item 3 ("Wire
  recently used tool tracking into ToolClientFrame"), which remains open.

<!-- section-id: member-files -->
## Member Files

- `src/module/tool/recentlyUsed.test.ts` [test-companion]
- `src/module/tool/recentlyUsed.ts` [implementation] *(representative)*

<!-- section-id: inferred-role -->
## Inferred Role

- Logical unit spanning 2 source files (module).
- Representative file: src/module/tool/recentlyUsed.ts
- Merge signals: shared-name-prefix
- file-role: utility
- default-classification: utility
- Derived from multi-file merged unit "RecentlyUsed" (2 member files).

<!-- section-id: merge-context -->
## Merge Context

This logical unit was identified by the following merge signals:

- shared-name-prefix

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.
