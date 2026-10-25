# Component: Footer

## Current maintenance state — 2026-10-24

The footer is one semantic `<footer>` in ordinary document flow. `AppShell` renders it after the main content (and after the optional footer advertising slot) inside a `min-h-screen` flex column, so short pages end with the footer at the bottom of the viewport and long pages reach it by scrolling. Copyright, Contact Us, Privacy Policy and the conditional Report Issues action remain visible. There is no fixed or sticky positioning, collapse control, saved preference, spacer, `--footer-clearance` variable or keyboard-avoidance logic, and `FooterViewportControl` has been deleted. `Footer` itself still renders only the inner content and owns no action logic. Statements below about a fixed or retractable footer are superseded historical records.

**Kind:** Component

<!-- section-id: representative-file -->
## Representative File

`src/component/layout/Footer.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/component/layout/Footer.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/component/layout/Footer.tsx
- file-role: component
- extension: .tsx
- filename: PascalCase (Footer)
- path-segment: components
- Derived from single-file merged unit "Footer".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

### Current identity and placement contract

Footer displays exactly `© 2026 iworkhere.space created by dailephd LLC` and adds a visible, keyboard-focusable `/privacy` link. In the released v0.4.2 architecture it is the single server-rendered Footer composed by `AppShell` inside the client `FooterViewportControl`, which anchors it to the viewport bottom and maintains document clearance; it is **not** normal-flow content when JavaScript is enabled. Without JavaScript it falls back to normal flow. `AppShell.footerActionSlot` supplies the existing conditional issue-report action, and its separate optional footer advertising slot remains in document flow (root supplies none). See `docs/DESIGN.md`.


### Component-color correction (Delivery 1 visually approved 2026-10-03)

Footer uses the shell footer-bg end-region and retains the exact identity copy. Natural **document scrolling** is unchanged; positioning of the footer itself is governed by the released v0.4.2 fixed/retractable wrapper.

### Historical v0.4.3 footer navigation contract (Batch 4, implemented; collapse behavior superseded)

The `Footer.action` presentation slot and the `FooterViewportControl` state owner are unchanged. The expanded footer renders exactly one compact horizontal group (a single row on desktop, wrapping in order on narrow screens; the earlier vertical stack is superseded), in DOM and visual order: `Contact Us` (`/contact`, always present), `Report Issues` (the existing action slot, only when reporting is enabled) and `Privacy Policy` (`/privacy`). Footer still owns no action logic. The links are quiet (no permanent underline, underline on hover) with the standard focus ring; copyright stays on the leading side and the Hide/Show toggle is untouched. Contact Us and Privacy Policy carry `data-footer-detail`, so the collapsed tab hides them and the copyright while the report action (when enabled) and Show footer remain. The report button's visible text is `Report Issues` expanded and `Report` collapsed; its accessible name is `Report Issues — report a problem or suggestion` (owned by `SupportCoordinator`). No second footer, report button or dialog is created, and the banner slot is untouched. See `docs/DESIGN.md` for geometry and clearance.
