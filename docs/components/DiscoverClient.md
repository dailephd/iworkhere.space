# Component: DiscoverClient

**Kind:** Component

<!-- section-id: representative-file -->
## Representative File

`src/app/discover/DiscoverClient.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/app/discover/DiscoverClient.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/app/discover/DiscoverClient.tsx
- file-role: component
- extension: .tsx
- filename: PascalCase (DiscoverClient)
- Derived from single-file merged unit "DiscoverClient".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

### Discovery contract

Discover uses the shared `ToolSearch` owner for client-side filtering by name,
description, category and registered tags. Results use normal destination links.
It introduces no second catalog or search-state owner.

### Server-visible guidance (v0.4.3 Batch 3)

`DiscoverClient` is unchanged. `src/app/discover/page.tsx` now explains that visitors can search directly or browse by category, states that the list is one flat list of all registered tools (not grouped), and renders a "Browse by category" list. Category ids, labels and descriptions come from `getAvailableCategory()`, `getToolCategoryLabel()` and `getToolCategoryDefinition()`; no category list or tool list is maintained in the page, and the added section contains only `/category/` links so tool-link counts are unchanged. The retired everyday category is no longer mentioned.
