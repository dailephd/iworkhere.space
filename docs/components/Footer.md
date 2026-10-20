# Component: Footer

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

### Current identity contract

Footer displays exactly `© 2026 iworkhere.space created by dailephd LLC` and adds a visible, keyboard-focusable `/privacy` link. In the released v0.4.2 architecture it is the single server-rendered Footer composed by `AppShell` inside the client `FooterViewportControl`, which anchors it to the viewport bottom and maintains document clearance; it is **not** normal-flow content when JavaScript is enabled. Without JavaScript it falls back to normal flow. `AppShell.footerActionSlot` supplies the existing conditional issue-report action, and its separate optional footer advertising slot remains in document flow (root supplies none). See `docs/DESIGN.md`.


### Component-color correction (Delivery 1 visually approved 2026-10-03)

Footer uses the shell footer-bg end-region and retains the exact identity copy. Natural **document scrolling** is unchanged; positioning of the footer itself is governed by the released v0.4.2 fixed/retractable wrapper.

### Planned v0.4.3 footer navigation contract (not yet implemented)

Preserve the `Footer.action` presentation slot and the existing `FooterViewportControl` state owner. In the expanded footer, render exactly one compact vertical group in visual and DOM order `Contact Us` (`/contact`, visible independently of reporting), `Report Issues` (existing action slot, only when enabled), and `Privacy Policy` (`/privacy`). The report trigger keeps accessible name `Report a problem or suggestion`; only its expanded **visible** label changes from the released full label to `Report Issues`, while the collapsed visible text stays `Report`. Do not create a duplicate button or dialog. Remove the always-on underline from the Privacy Policy footer link, retaining keyboard focus visibility, and give Contact Us the same quiet link styling. Preserve the copyright line and the separate Hide/Show footer toggle. Mark both links as collapsed-state details; never hide the issue action when enabled. Preserve the compact collapsed tab and storage preference. Use measured clearance rather than fixed heights, with viewport, keyboard, scroll-end, responsive, `noscript` and support-enabled/off regressions. Do not modify the banner slot or create a second semantic footer. The full product contract and batch ownership are in `docs/plans/v0.4.3-implementation-plan.md`.
