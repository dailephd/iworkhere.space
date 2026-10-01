# Component: AppShell

**Kind:** Component

<!-- section-id: representative-file -->
## Representative File

`src/component/layout/AppShell.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/component/layout/AppShell.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/component/layout/AppShell.tsx
- file-role: component
- extension: .tsx
- filename: PascalCase (AppShell)
- path-segment: components
- Derived from single-file merged unit "AppShell".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

### Current layout and scroll contract

`AppShell` is the sole owner of the page `main` landmark (`id="main-content"`) and the skip-link target. It owns natural document flow: the browser document scrolls, with no fixed viewport shell or nested `.MainScroll`. Desktop content includes a 176px navigation rail and flexible workspace, with optional 112px advertising rails only when their slots are supplied. The active application supplies only the right advertising rail. Mobile collapses to one column. The content area is capped near 1280px. See `doc/DESIGN.md`.
