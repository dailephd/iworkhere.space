# Module: ThemeStorage

**Kind:** Module

<!-- section-id: representative-file -->
## Representative File

`src/module/theme/themeStorage.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: contract -->
## Contract (added 2026-08-07 reconciliation)

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


### Four-theme migration contract

Valid IDs are system/light/dark/onedark. Retired vscode-modern, dracula, amethyst-haze, mercury-fog, civic-light and spectrum resolve to System: invalid persisted values are removed, and stale DOM attributes are cleared. Root pre-paint initialization accepts only light/dark/onedark. System is absence of data-theme and CSS Light/Dark preference.
