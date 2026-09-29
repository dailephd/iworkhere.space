# Module: Storage

**Kind:** Module
**Scope:** Multi-file logical unit (2 source files)
**Group:** src/lib

<!-- section-id: representative-file -->
## Representative File

`src/lib/storage.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: contract -->
## Contract (added 2026-08-07 reconciliation)

The `lib` layer's sole persistence abstraction. All persistent state access in
the app goes through this module — no direct `localStorage` calls elsewhere.

```typescript
interface StorageAdapter {
    get<T>(key: string): T | null
    set<T>(key: string, value: T): void
    remove(key: string): void
}
export const storage: StorageAdapter
```

- Backed by `localStorage` via `createLocalStorageAdapter()` (current
  implementation; swappable without changing consumer code).
- SSR-safe: every method checks `typeof window !== "undefined"` first and is
  a no-op / returns `null` on the server.
- `get`/`set` handle `JSON.parse`/`JSON.stringify` internally; a parse failure
  or write failure (e.g. quota exceeded) is swallowed and `get` returns
  `null` rather than throwing.
- Known consumers and their keys: `"theme"` (`src/module/theme/themeStorage.ts`),
  `"recent-tool"` (`src/module/tool/recentlyUsed.ts`), `"analytic_event_count"`
  (`src/module/analytics/provider.ts`). See `doc/SCHEMA.md` §5 for the full
  key table.

<!-- section-id: member-files -->
## Member Files

- `src/lib/storage.test.ts` [test-companion]
- `src/lib/storage.ts` [implementation] *(representative)*

<!-- section-id: inferred-role -->
## Inferred Role

- Logical unit spanning 2 source files (module).
- Representative file: src/lib/storage.ts
- Merge signals: shared-name-prefix
- file-role: utility
- default-classification: utility
- Derived from multi-file merged unit "Storage" (2 member files).

<!-- section-id: merge-context -->
## Merge Context

This logical unit was identified by the following merge signals:

- shared-name-prefix

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.
