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

### Approved Colorfield homepage presentation (2026-10-28; implemented as a visual candidate, pending user review)

The user selected an adaptation of Colorfield design 03 to the **existing** homepage rather than replacement of the site layout. `docs/DESIGN.md` ("Approved homepage Colorfield adaptation") owns the binding detailed visual, copy, ordering, theme, accessibility and acceptance contract. Historical v0.4.3/v0.4.4 task-first ordering recorded above remains historical until the new candidate is implemented and verified.

The prospective homepage remains server-composed from `src/app/page.tsx` plus the current `HomeClient` for category/search presentation. Keep all registered tools in the canonical sections exactly once, with a tool-specific decorative icon, registry name, and visible registry description. Distinguish the category sections with visibly colored pastel surfaces and light solid cards. Do not duplicate tool metadata, create a second search owner, or change global `SectionIsland` behavior merely to style the home page. New display order: compact coral introduction, real search, category chips, complete catalog, preserved five featured tasks, then four guides. Remove the public-facing tool/count numerals from home copy, hero and category boards; keep programmatic catalog-size assertions.

The existing ToolSearch supports case-insensitive substring matching on name, description, category, and tags only. The new copy must not promise natural-language intent mapping. This is a visual/catalog-discovery change to be implemented separately, not a claim about current deployed behavior.

## Typography and secondary sections (2026-10-28)

The homepage uses the sitewide DM Sans face. Featured tasks and workflow guides (rendered by `src/app/page.tsx` as children of HomeClient) use `.home-support` panels with whole-card `.home-card` links and the same icon/title/description layout as the catalog; dark palettes derive boards, cards and hero from the active palette (see DESIGN.md). Data attributes, copy and destinations are unchanged.

## Sitewide redesign update (Prompts 7-8, 2026-10-31)

The 2026-10-28 featured-task and workflow-guide sections described above no longer render. `src/app/page.tsx` is the individual utility catalog only (no task, guide or workflow cards); `HomeClient` remains the only client owner of search and the 18-tool catalog, grouped by the seven canonical categories. Search uses the pure matcher `src/component/common/toolSearchMatch.ts`, which scores name, slug, description, category label and tags using a small fixed lexical normalization and filler-word removal (no synonyms or fuzzy matching), so it is no longer substring-only. Workflows and the Guide finder are separate header destinations (`/workflows`, `/guide`).

### Board layout (P09 correction, 2026-10-31)

The seven category boards render in one vertical column at every viewport width, in canonical category order (`flex flex-col gap-4` around the `data-home-board` wrappers in `HomeClient.tsx`); there is no outer multi-column board grid. The tool cards inside a board use a responsive grid (`sm:grid-cols-2 lg:grid-cols-3`: one column at 390 px, two at 768 px, three at 1440 px). Witnesses: `test/e2e/home-grid-workflow-card.spec.ts` (boards stack at 1440, 1280, 768 and 390 px) and the unchanged vertical-order assertion in `test/e2e/theme-pilot.spec.ts`. Single-tool boards (Math, Time) leave unused board width on wide screens by design.

