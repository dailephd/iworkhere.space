# Module: ThemeProvider

**Kind:** Module

<!-- section-id: representative-file -->
## Representative File

`src/component/common/ThemeProvider.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/component/common/ThemeProvider.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/component/common/ThemeProvider.tsx
- file-role: shared-core
- path-segment: common
- Derived from single-file merged unit "ThemeProvider".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

The provider always applies `loadTheme() ?? "system"`, removing stale explicit DOM attributes when stored values are retired, unknown or absent. It renders stable children without theme-dependent markup. The root inline script validates the same three explicit IDs before paint and removes invalid storage.
