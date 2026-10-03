# Component: VerticalNav

**Kind:** Component

<!-- section-id: representative-file -->
## Representative File

`src/component/layout/VerticalNav.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/component/layout/VerticalNav.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/component/layout/VerticalNav.tsx
- file-role: component
- extension: .tsx
- filename: PascalCase (VerticalNav)
- path-segment: components
- Derived from single-file merged unit "VerticalNav".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

### Current layout contract

The active pilot renders `VerticalNav` as compact, wrapping links in the upper application header; it no longer occupies a permanent 176px desktop rail. Items come from the existing `NavItem` owner and use normal destinations with current-path active state. Mobile keeps the same links and wraps them without a drawer or modal. See `docs/DESIGN.md`.


### Component-color correction (pending visual approval)

Navigation uses header-muted normal text, nav-hover-bg, nav-active-bg/text. The active page also retains aria-current; color does not own state.
