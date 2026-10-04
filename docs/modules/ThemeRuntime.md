# Module: ThemeRuntime

**Kind:** Module
**Scope:** Multi-file logical unit (2 source files)
**Group:** src/module

<!-- section-id: representative-file -->
## Representative File

`src/module/theme/themeRuntime.client.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: contract -->
## Contract (added 2026-08-07 reconciliation)

```typescript
function setTheme(themeId: ThemeId): void
function getThemeFromDom(): ThemeId
```

- `setTheme` applies the theme by setting `data-theme="<themeId>"` on
  `document.documentElement`, or removing the attribute entirely for
  `"system"` (so the CSS `prefers-color-scheme` rule takes over).
- `getThemeFromDom` reads the current `data-theme` attribute back and
  round-trips it through an explicit value check against all four `ThemeId`
  values, removing invalid attributes and defaulting to `"system"` for anything else.
- Browser-context only (`document` access) — must only be called from Client
  Components, effects, or event handlers, never at module scope or during
  server rendering. Depends on `themeRegistry.ts` for the `ThemeId` type and canonical guard
  (no import of `storage`).

<!-- section-id: member-files -->
## Member Files

- `src/module/theme/themeRuntime.client.test.ts` [test-companion]
- `src/module/theme/themeRuntime.client.ts` [implementation] *(representative)*

<!-- section-id: inferred-role -->
## Inferred Role

- Logical unit spanning 2 source files (module).
- Representative file: src/module/theme/themeRuntime.client.ts
- Merge signals: shared-name-prefix
- file-role: utility
- default-classification: utility
- Derived from multi-file merged unit "ThemeRuntime" (2 member files).

<!-- section-id: merge-context -->
## Merge Context

This logical unit was identified by the following merge signals:

- shared-name-prefix

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.


### Four-theme migration contract

Valid IDs are system/light/dark/onedark. Retired vscode-modern, dracula, amethyst-haze, mercury-fog, civic-light and spectrum resolve to System: invalid persisted values are removed, and stale DOM attributes are cleared. Root pre-paint initialization accepts only light/dark/onedark. System is absence of data-theme and CSS Light/Dark preference.
