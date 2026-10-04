# Module: ThemeRegistry

**Kind:** Module
**Scope:** Multi-file logical unit (2 source files)
**Group:** src/module

<!-- section-id: representative-file -->
## Representative File

`src/module/theme/themeRegistry.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: contract -->
## Contract (added 2026-08-07 reconciliation)

The single source of truth for which themes exist — analogous in spirit to
`src/module/tool/registry.ts` for tools, but for `ThemeId` values.

```typescript
type ThemeId =
    | "system" | "light" | "dark" | "onedark";

function listThemes(): ThemeEntry[]   // { id, label, description? }
function isThemeId(x: unknown): x is ThemeId
```

- `theme_definition_list` is a private array of four `ThemeEntry` objects
  (id/label/optional description); `listThemes()` is the only accessor.
- `isThemeId()` is a runtime type guard used by `themeStorage.loadTheme()` to
  validate values read back from `storage` before trusting them as `ThemeId`.
- `docs/DESIGN.md` records all four canonical themes and shared cross-theme
  visual rules; token values remain implementation-owned in `src/style/theme.css`.

<!-- section-id: member-files -->
## Member Files

- `src/module/theme/themeRegistry.test.ts` [test-companion]
- `src/module/theme/themeRegistry.ts` [implementation] *(representative)*

<!-- section-id: inferred-role -->
## Inferred Role

- Logical unit spanning 2 source files (module).
- Representative file: src/module/theme/themeRegistry.ts
- Merge signals: shared-name-prefix
- file-role: utility
- default-classification: utility
- Derived from multi-file merged unit "ThemeRegistry" (2 member files).

<!-- section-id: merge-context -->
## Merge Context

This logical unit was identified by the following merge signals:

- shared-name-prefix

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.
