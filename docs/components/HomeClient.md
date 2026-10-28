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


### Task-first section (v0.4.3 Batch 3)

`src/app/page.tsx` (server) renders the introduction and one "Start with a common task" section before `HomeClient`. `HomeClient` itself is unchanged: it still owns ToolSearch, category links and the seven registry-derived sections with all eighteen cards exactly once.

The five featured tasks (`compress-pdf`, `pdf-to-image`, `images-to-pdf`, `image-resizer`, `image-converter`) come from the existing value-example owner (`getFeaturedValueExample()`: the five records whose `featuredOnHome` is true; nine tools have examples, and the home page deliberately does not list the four added in v0.4.4); each tool is resolved through `getToolByIdList()`. Each item shows the example task, the supported outcome and the first recorded limitation, and links once to `/tool/<slug>`. These are editorial entry points, not catalog cards: they do not carry `.catalog-card`, are not inside a `SectionIsland`, and are not labelled popular, trending or recommended. The introduction states only documented capabilities: local browser processing where a tool says so, and that results depend on file, browser and limits.

### Practical file workflows section (v0.4.4 Batch 5)

`src/app/page.tsx` (server) renders a compact "Practical file workflows" section (`data-workflow-section`) after the five featured tasks and before `HomeClient`. It lists the four guides from `getAllTaskGuide()` (title as a link to `/guide/<slug>` and the expected outcome). `HomeClient` is unchanged and remains the only client owner of search and the 18-tool catalog; guide records are never passed to it, the five-featured projection is unchanged, and the catalog card count stays 18.

### Approved Colorfield homepage presentation (2026-10-28; implementation pending)

The user selected an adaptation of Colorfield design 03 to the **existing** homepage rather than replacement of the site layout. `docs/DESIGN.md` ("Approved homepage Colorfield adaptation") owns the binding detailed visual, copy, ordering, theme, accessibility and acceptance contract. Historical v0.4.3/v0.4.4 task-first ordering recorded above remains historical until the new candidate is implemented and verified.

The prospective homepage remains server-composed from `src/app/page.tsx` plus the current `HomeClient` for category/search presentation. Keep all registered tools in the canonical sections exactly once, with a tool-specific decorative icon, registry name, and visible registry description. Distinguish the category sections with visibly colored pastel surfaces and light solid cards. Do not duplicate tool metadata, create a second search owner, or change global `SectionIsland` behavior merely to style the home page. New display order: compact coral introduction, real search, category chips, complete catalog, preserved five featured tasks, then four guides. Remove the public-facing tool/count numerals from home copy, hero and category boards; keep programmatic catalog-size assertions.

The existing ToolSearch supports case-insensitive substring matching on name, description, category, and tags only. The new copy must not promise natural-language intent mapping. This is a visual/catalog-discovery change to be implemented separately, not a claim about current deployed behavior.

