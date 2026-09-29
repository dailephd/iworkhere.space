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
    | "system" | "light" | "dark" | "onedark" | "vscode-modern"
    | "dracula" | "amethyst-haze" | "mercury-fog";

function listThemes(): ThemeEntry[]   // { id, label, description? }
function isThemeId(x: unknown): x is ThemeId
```

- `theme_definition_list` is a private array of eight `ThemeEntry` objects
  (id/label/optional description); `listThemes()` is the only accessor.
- `isThemeId()` is a runtime type guard used by `themeStorage.loadTheme()` to
  validate values read back from `storage` before trusting them as `ThemeId`.
- `doc/styling.md` documents only a Light/Dark theme policy; the six
  additional named themes (onedark, vscode-modern, dracula, amethyst-haze,
  mercury-fog, plus system) are implemented but have no per-theme token
  specification in any tracked document. Recorded as an open documentation
  gap in the Architecture Assimilation Report, not fixed in this pass.

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
