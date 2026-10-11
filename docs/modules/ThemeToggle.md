# Module: ThemeToggle

**Kind:** Module

<!-- section-id: representative-file -->
## Representative File

`src/component/common/ThemeToggle.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/component/common/ThemeToggle.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/component/common/ThemeToggle.tsx
- file-role: shared-core
- path-segment: common
- Derived from single-file merged unit "ThemeToggle".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

## Current appearance contract (2026-10-09)

The trigger remains exactly `Themes`, without an icon. It opens a named nonmodal Appearance settings dialog containing native Palette (seven choices) and Color mode (three choices) radio groups. One Dark disables the mode group. Selection keeps the panel open; native arrows/Space work, Escape and Close restore trigger focus, outside click/focus departure dismiss it. The panel scrolls within mobile bounds. No effects preference is exposed. Persistence/state come only from ThemeProvider; colors do not alter layout.
