# Module: ThemeStorage

**Kind:** Module

<!-- section-id: representative-file -->
## Representative File

`src/module/theme/themeStorage.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: contract -->
## Historical API baseline (2026-08-07; superseded by current contract below)

```typescript
function storeTheme(themeId: ThemeId): void
function loadTheme(): ThemeId | null
```

- Persists the chosen `ThemeId` (see `docs/modules/ThemeRegistry.md`) under the
  `storage` key `"theme"` via `storeTheme`.
- `loadTheme()` reads the raw stored value and validates it with
  `isThemeId()` from `themeRegistry.ts`; removes invalid values (including retired IDs) and returns `null` if unset or invalid
  rather than an unchecked cast.
- Depends on `src/lib/storage.ts` for the underlying SSR-safe adapter and on
  `themeRegistry.ts` for the `ThemeId` type/guard — does not touch the DOM
  itself (see `themeRuntime.client.ts` for that).

<!-- section-id: member-files -->
## Member Files

- `src/module/theme/themeStorage.ts` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/module/theme/themeStorage.ts
- file-role: utility
- default-classification: utility
- Derived from single-file merged unit "ThemeStorage".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

## Current appearance contract (2026-10-09)

`loadAppearance()` and `storeAppearance()` use the SSR-safe storage adapter for JSON keys `theme` (mode or legacy onedark) and `palette` (PaletteId). Missing/invalid values independently fall back to Violet & Graphite/System and invalid keys are removed. Existing `theme: "onedark"` migrates to the preserved fixed-dark palette. `loadTheme()`/`storeTheme()` remain compatible. Failed reads/writes do not throw; the provider keeps interactive state when persistence is blocked.
