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

## Current appearance contract (2026-10-09)

The provider owns the single appearance context consumed by ThemeToggle. It hydrates `loadAppearance()` in a layout effect, applies the runtime attributes and then enables the trigger. System listens for OS color-scheme changes; explicit modes and One Dark ignore them. Selection applies immediately, persists through themeStorage and retains in-memory state even if writes fail. Server/initial markup is stable; layout's initializer applies saved colors before paint.
