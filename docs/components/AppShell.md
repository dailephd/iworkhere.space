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

`AppShell` is the sole owner of the page `main` landmark (`id="main-content"`) and skip-link target. It owns natural document flow: the browser document scrolls, with no fixed viewport shell or nested `.MainScroll`. Navigation is composed in the upper application header and consumes no body grid column. Optional advertising regions render only when supplied. Root supplies real top/right ads only under explicit production opt-in, without a fake footer banner. Right uses a stable 176px xl track, hidden below 1280px; optional left capability remains. The main workspace receives the released width and remains capped near 1280px. Mobile collapses to one column. This Delivery 1 pilot is visually approved by the user on 2026-10-03. See `docs/DESIGN.md`.


### Component-color correction (Delivery 1 visually approved 2026-10-03)

Shell header uses header-bg; protected advertising surfaces stay quiet surface-alt; footer uses footer-bg. No grid, spacing or scrolling changes.
