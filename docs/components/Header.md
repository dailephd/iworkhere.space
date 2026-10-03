# Component: Header

**Kind:** Component

<!-- section-id: representative-file -->
## Representative File

`src/component/layout/Header.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/component/layout/Header.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/component/layout/Header.tsx
- file-role: component
- extension: .tsx
- filename: PascalCase (Header)
- path-segment: components
- Derived from single-file merged unit "Header".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

### Current presentation

The home link displays `iworkhere.space`. Compact navigation links are composed from the existing navigation owner and populated category metadata. A `Search tools` link leads to the existing Discover search instead of rendering an inactive search input. The shared theme trigger displays `Themes`. Navigation wraps on narrow screens. The Delivery 1 pilot is visually approved by the user on 2026-10-03. See `docs/DESIGN.md`.


### Component-color correction (Delivery 1 visually approved 2026-10-03)

Header consumes contrasting header-bg/text/muted. Brand stays near white; quiet search and Themes controls use shell text. Geometry is unchanged.
