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

### Homepage launcher contract

The homepage client composes one `ToolSearch` surface, category links derived
from populated metadata, all four registered image tools under “Image tools”,
and a linked compact list of the remaining tools. Tool identity and descriptions
come from the registry through the server page. Search filtering remains in the
shared `ToolSearch` owner. Every category and tool destination is a normal link.
The launcher is compact and pending visual approval, not a marketing landing page.


### Component-color correction (pending visual approval)

Category links consume category hue/soft roles. Tool cards consume card roles with a thin category edge and category hover tint. Image group uses image-soft. Existing metadata owns category identity; no duplicate catalog or palette.


### Island/material candidate

Image tools and All other tools now compose the same presentation-only SectionIsland. Metadata selection and ToolGrid remain local. Common padding/radius/heading/border/elevation establish peer hierarchy.
