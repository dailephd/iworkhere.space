# Module: ToolSearch

**Kind:** Module

<!-- section-id: representative-file -->
## Representative File

`src/component/common/ToolSearch.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/component/common/ToolSearch.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/component/common/ToolSearch.tsx
- file-role: shared-core
- path-segment: common
- Derived from single-file merged unit "ToolSearch".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

### Search and link contract

`ToolSearch` owns the client-side query and optional tag-filter state used by
Home and Discover. It filters only passed items by name, description, category
and supplied tags. Results are Next.js links to `/tool/<slug>` so keyboard use,
open-in-new-tab and browser link preview work normally. `showResultsWhenEmpty`
and `showTagFilters` control presentation only; they do not introduce another
catalog or search owner.


### Component-color correction (pending visual approval)

Search field uses search-bg/border, separate from numeric input roles. Result category chips use canonical category hue/soft tokens. Filtering behavior is unchanged.


### Island/material candidate

Search stays solid, bordered and readable in every theme. Glass is intentionally limited to structural islands/stages/popover, not this input or result cards.
