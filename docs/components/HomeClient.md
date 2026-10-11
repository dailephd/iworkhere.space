# Component: HomeClient

**Kind:** Component

<!-- section-id: representative-file -->
## Representative File

`src/app/HomeClient.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/app/HomeClient.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/app/HomeClient.tsx
- file-role: component
- extension: .tsx
- filename: PascalCase (HomeClient)
- Derived from single-file merged unit "HomeClient".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

### Historical homepage launcher contract (superseded by v0.4.1)

The original Delivery 2 homepage composed one `ToolSearch` surface, populated
category links, four image tools under “Image tools”, and a linked list of the
remaining tools. That historical two-group layout was replaced in released
v0.4.1 by the registry-derived per-category sections documented below.
The existing shared ToolSearch owner still handles search; category and tool
destinations remain ordinary links. The original launcher was compact rather
than a marketing landing page.


### Component-color correction (Delivery 1 visually approved 2026-10-03)

Category links consume category hue/soft roles. Tool cards consume card roles
with a thin category edge and category hover tint. Existing metadata owns
category identity; no duplicate catalog or palette.


### Current category sections

HomeClient renders one presentation-only SectionIsland for each populated
registry category in canonical order. Tool membership is registry-derived, and
all 18 tools appear exactly once. The direct All tools link navigates to
Discover. Metadata selection and ToolGrid remain local; SectionIsland owns no
category, tool, search or routing behavior. Shared section styling is consistent
across categories and appearance palettes.
