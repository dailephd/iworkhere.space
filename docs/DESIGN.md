# Design system

## Approved homepage Colorfield adaptation — 2026-10-28

Status: APPROVED DESIGN DIRECTION; IMPLEMENTED AS A VISUAL CANDIDATE on `feature/homepage-colorfield-refresh` (pending user review, not released). Reference colors apply to the original palette in Light only (`--home-*` tokens in `src/style/theme.css`); other palettes and modes derive from their own roles. Icons live in `src/app/HomeToolIcon.tsx`, keyed by tool slug with a generic fallback. This is a post-v0.4.4 homepage presentation decision, not an amendment to the released v0.4.3/v0.4.4 implementation history, a new utility release, or a change to the frozen v0.5.0/v0.6.0 catalogs. This section supersedes older homepage layout/order and restrained-category-fill preferences **for the next homepage implementation only**. Historical descriptions below remain historical. The approved direction is a colorful adaptation of the current category-based homepage, not a new website shell or a copy of the standalone prototype.

### Product and information architecture

- Preserve the existing `AppShell`, fixed Header, measured header footprint, normal-flow Footer, navigation links, Themes control, existing six palette identities plus One Dark, the route structure and the existing server/client boundary.
- Preserve the registry-derived full homepage catalog, in the canonical populated-category order from `src/module/tool/category.ts`. Every registered tool appears exactly once as a catalog entry. Each entry visibly contains a recognizable icon, its canonical name and the full, truthful tool description from `src/module/tool/registry.ts`, and is a real anchor to `/tool/<slug>`. No fictitious tools, made-up testimonials, usage rankings, metrics or new tool metadata.
- Homepage order: compact colorful introduction (one H1) → existing working ToolSearch → linked category chips → full category-section catalog → existing five verified featured task entry points → existing four Practical File Workflows links. The featured tasks and workflow guides remain available and server-rendered, but no longer push the actual catalog below long blocks of copy. Do not create two full catalogs or merge guides into tool cards.
- Remove all visible **tool and category counts** from the homepage, including the existing introductory `18 browser tools` text, prototype-style big numeral/count block, catalog totals, per-category totals and count badges. Counts may still be computed in code and tests for completeness; they must not appear in homepage visitor-facing text. The total must not be hardcoded in new UI copy.
- The hero should be a compact, distinctly coral/salmon visual panel rather than a full-screen promotional landing section. Approved H1: `Small tasks. Big difference.` Supporting sentence: `Convert, compress, calculate, and prepare files with focused browser utilities.` Do not use a numeric slogan or invent promises about results. Keep the existing accurate privacy/limitations statement accessible as subordinate prose without leading the page with several caution paragraphs.
- Use the existing search implementation, not an imagined natural-language tool router. `src/component/common/ToolSearch.tsx` currently trims/lowercases the query and tests a substring against `name + description + category + tags`. Search labels and placeholders must describe those actual supported fields. Do not label it `describe a task`, `ask AI`, semantic search, or intelligent matching. Retain the current search behavior and accessibility.

### Visual character and responsive composition

The reference is design 03 Colorfield from the 2026-10-28 design exploration. Its useful ingredients are a dark deep-teal header, a slim pale-sage category-chip strip, warm ivory page ground, a salmon introduction, and large distinctly pastel-tinted category panels with light/near-white icon-name-description tool cards. **Adapt those ingredients inside the current site rather than reproducing the prototype's separate header, navigation system or its large numeric hero callout.**

For the default original palette in Light mode, the approved approximate visual targets are: ivory page `#f8f3e9`; deep teal `#183937` as a reference to the existing header surface (do not override global header ownership); warm salmon hero `#f5a592` with dark teal text `#173637`; pale-sage category-chip vicinity `#dce8d4`; PDF category board `#e4eee5`; image `#f8d8c7`; text `#f1ecc0`; converter `#dbe1ff`; developer `#e7dce9`; math `#cce3e2`; time `#f5dfd8`; and pale solid card interiors near `#fffdf6`. These are **reference colors for the original/light homepage**, not an authorization to overwrite the existing shared theme colors or hardcode this palette across Dark/System/One Dark and the other palettes.

Introduce only homepage-scoped presentation variables/classes as needed in the established styling owners (`src/app/global.css` and, when defining appearance values, `src/style/theme.css`). Derive or specify accessible variants through the existing palette and theme mechanism; all supported modes must retain their own meaningful appearance. Use the existing `data-category`, `--category-color`, `--category-soft` and semantic text/surface/focus roles. Do not introduce a new palette ID, a second theme registry, global card redesign, a graphics dependency or site-wide header/footer changes. The homepage must look noticeably colorful in the default Light scheme and not collapse into an almost-white collection of indistinguishable islands.

A category board has a category-specific pastel background and border, a clear heading, the existing canonical category description from `src/module/tool/category.ts`, and a responsive grid of solid readable tool cards. Each tool card has an individual decorative line icon, name, and description all visible without hover, plus an unambiguous link hit target. Icons must be supplied from a project-owned, deterministic presentation mapping keyed by existing tool identity; do not alter canonical tool names/descriptions or add a dependency solely for icons. Icon semantics for the present registry: merge-pdf stacked pages; split-pdf separated pages; images-to-pdf image in document; pdf-to-image document to picture; compress-pdf inward/compression arrows; slugify link; html-text-extractor markup/text; word-character-counter text with count; calculator keypad; length-converter ruler; weight-converter scale; time-arithmetic clock; image-resizer resize handles; image-compressor image with compression arrows; image-converter bidirectional format arrows; heic-converter picture/file; json-formatter braces; qr-code-generator QR matrix. Icons are aria-hidden because each card already has a readable name.

Use a comfortable three-column card grid when space permits, two columns at medium widths and one at mobile; use existing content-width limits. Category chips wrap or scroll accessibly as needed, without creating horizontal page overflow. No new fixed sidebar, separate scroll container, enormous hero, animated tile system or horizontal tool carousel. Maintain visible focus, contrast, reduced-motion support, and working anchor clearance under the fixed header.

### Ownership, preserved contracts, and acceptance

- `src/app/page.tsx`: Server Component composition, intro copy and ordering; featured and task-guide records remain resolved through their existing data owners.
- `src/app/HomeClient.tsx`: the existing client presentation/search/category catalog; preserve registry-provided tool inputs and the shared `ToolSearch` matching owner. A homepage-scoped category wrapper may color each existing `SectionIsland` without altering global SectionIsland behavior.
- `src/module/tool/registry.ts`, `metadata.ts`, `category.ts`: unchanged canonical identities/categories/descriptions and queries, except a justified, contract-preserving metadata read needed for presentation.
- `src/component/common/ToolSearch.tsx`, `SectionIsland.tsx`: preserve functional and shared contracts; prefer homepage-scoped styling over global changes. Existing other pages and catalog consumers must not visually regress.
- `src/app/page.test.tsx`, `HomeClient.test.tsx`, and focused browser tests: update old homepage order/count-copy assertions to the approved new behavior while keeping internal catalog completeness, uniqueness, real hrefs, all category coverage, search-field semantics, task-guide link coverage, and canonical metadata assertions.
- Browser verification: inspect at **1440×900** and **390×844** in original Light and Dark and One Dark; also verify at least one additional named palette. Confirm visually distinct category panels, readable descriptions, working search/category links, no horizontal overflow, no clipped icons or cards, no content hidden by the header, and no visible total/category tool numbers. Test keyboard focus and a no-results query. Prefer canonical my-frontend-observer project-aware runtime capture/check when available; do not misreport review-required evidence as PASS.
- This is a homepage redesign only. No new tool implementation, public API, database, ads activation, analytics schema, search engine, sitemap policy, release/tag/merge/deployment operation, registry reorganization, or future-roadmap assignment. Update or add tests and directly affected component documentation; production functionality remains the existing registered tools and guides.


### Screenshot-reviewed typography, secondary-section and dark-color correction — 2026-10-28

Status: APPROVED CORRECTION FOR THE IN-PROGRESS LOCAL COLORFIELD CANDIDATE; visual acceptance and GitHub implementation evidence are not yet established. Eight supplied screenshots show the catalog using colorful icon/name/description cards while the five featured examples and four task-guide cards continue to use plain beige/white cards and underlined links. The screenshots' root backgrounds match Amber & Graphite Dark (#1B201E) and Cobalt & Terracotta Dark (#111A29), respectively, while the document-category panel looks identically plum (#392333) in both; this is evidence of a category fill that does not harmonize with the active palette. Both show muddy brown/mauve hero fills and competing bright accents. The One Dark screenshot was not supplied, so it still requires its own verification. This correction supersedes only the corresponding typography, visual-continuity and dark-homepage colors in the first Colorfield contract above. It does not undo the approved catalog-first sequence, tool descriptions, real search, theme identities, or historical plans.

**Typography contract:** Use DM Sans as the one intentional primary public-site interface typeface, including Header/Footer and all homepage elements (intro, search, category board headings, card names/descriptions, featured examples, guides). Use the existing bundled `next/font/google` integration from `src/app/layout.tsx` to self-host a variable DM Sans family with `display: "swap"`, `subsets: ["latin"]`, and one CSS variable such as `--site-font-dm-sans`; set the current `--font-sans` and any actively consumed public sans role to that font with a system fallback. No browser runtime calls to Google Fonts, no external `@import`, no second font library and no bundled font files committed manually. Keep `--font-mono` for code and technical values. Do not introduce different heading/body font families on the homepage. Main headings use 700 with roughly 1.15–1.25 line-height, cards use 600–650 with 1.35–1.45, and body descriptions use 400–500 at a comfortable ~14–16px and 1.45–1.6 line-height. Maintain actual font rendering/fallback in screenshots, not merely an unused font variable. Test after font load and fallback for clipping and layout shift.

**Continuity of the entire homepage:** After the seven colored catalog boards, render the existing five featured tasks and four practical guide links in the **same** visual language: coordinated softly colored section backdrops, the same solid card material, radius, border, icon/title alignment, type scale, readable muted descriptions, hover/focus treatment and consistent vertical rhythm. Preserve the actual verified task, outcome, limitation and guide copy. Keep one real link per task/guide card; a whole-card link is preferred over bare underlined link text for the presentation, with proper visible keyboard focus. Retain section headings and semantics and the existing data attributes and link targets. Secondary content remains subordinate to the full catalog, not a second hero or repetitive tool catalog. Avoid a sharp change from pastel category boards to generic gray/beige rectangular lists.

**Dark appearance color model:** Dark surfaces are not light pastels darkened independently. Use a neutral, palette-compatible progression of canvas → slightly lighter, softly category-tinted board → distinct elevated card; use limited chroma for background fills and let icons/chips retain recognizable but restrained category accents. Do not mix plum boards with green-gray cards and muddy brown hero treatments. Keep icon/card titles readable and category distinguishability beyond color alone. Homepage-specific CSS variables/rules must be scoped to the homepage and key off the existing `data-theme` / `data-palette` attributes; do not replace global application or dashboard palette values.

For the original palette in Dark mode, the explicit design anchors are:
- homepage canvas: the existing original-Dark `--background` (`#1A1D23` at the documented baseline), not an unrelated blue override
- neutral category-board base: `#222B35`, with 10–14% category tint
- card: `#2A3140` (original Dark elevated neutral); borders: `#465367`
- primary text: `#F3F7F8`; secondary text: `#C5CCDA`
- hero: warm coral `#E7A28F` with dark foreground `#172A2E` and secondary foreground `#314347`; no brown/gray-mauve hero
- each category board: approximately 86–90% of the neutral board base plus 10–14% of that category's current registered accent color, with accessible border/foreground; keep individual cards neutral rather than fully saturated.

For One Dark, preserve its established theme identity and fixed-dark selection behavior but use a separate homepage-specific harmony:
- homepage canvas: existing One Dark `--background` (`#282C34` at the documented baseline); neutral category-board base: `#2B303A`
- elevated card: `#363E4A`; border: `#526072`
- primary text: `#F4F5F7`; secondary text: `#C6CDD6`
- hero: intentional lavender `#B6A1D8` with dark foreground `#211F2B`, instead of muted brown
- category board tint: approximately 88–90% neutral board and 10–12% category accent. No extra glass blur/neomorphic layers inside Colorfield cards.

For Mineral, Oxblood, Signal, Cobalt and Amber Dark modes, **do not reuse the original Dark blues or a fixed plum board**. Retain the active palette's base canvas and choose a neutral board from a mix of that palette's `--background` and `--surface`; add only 10–14% of the current `--category-color` for recognizable category identity. Cards use the same palette's `--surface-alt` or a tested, visibly elevated neutral, not a clashing hue from a different palette. The seven explicit Dark-mode hero reference fills and dark-text colors are:
- original: fill `#E7A28F`, foreground `#172A2E`;
- mineral: fill `#91C8B7`, foreground `#14231F`;
- oxblood: fill `#E6A6B7`, foreground `#291E23`;
- signal: fill `#BCE08C`, foreground `#1A2618`;
- cobalt: fill `#E7A184`, foreground `#1A2432`;
- amber: fill `#E8C482`, foreground `#26231A`;
- onedark: fill `#B6A1D8`, foreground `#211F2B`.

The specified hero foregrounds all exceed 4.5:1 contrast against their paired fills, before any later blending. Do not recolor the entire site's global palette or change palette IDs, persistence, theme geometry or unrelated pages.

**Quantitative and visual checks:** For each category and secondary card, normal text/background contrast must be at least 4.5:1; large text and meaningful boundaries/icons should satisfy 3:1 where applicable. Test actual computed colors, not token values alone, across original Light, original Dark, One Dark and all five other named palettes in Dark, at 1440×900 and 390×844. Review whole-page screenshots with catalog, featured tasks and guide links in the same capture. Test keyboard focus, search/no-match, no horizontal overflow, no cut-off text, proper header clearance, unchanged tool links and no visible count labels. The candidate may not report visual PASS from test status alone; inspect the screenshots and correct misaligned surface/font/card styling.

Implementation (local candidate, 2026-10-28): DM Sans is loaded by `next/font/google` in `src/app/layout.tsx` (variable `--site-font-dm-sans` on the root html element) and `--font-sans` in `src/style/theme.css` resolves to it before system fallbacks; `--font-mono` is unchanged. Homepage roles `--home-hero-bg/fg/muted-fg`, `--home-board-neutral`, `--home-card-bg/border/fg/muted` and `--home-support-panel-bg/border` live in `theme.css`; in Dark modes each board is the palette neutral (mix of `--background` and `--surface`) plus 13% of a darkened category colour, cards use `--surface-alt` (original and One Dark use the documented anchors). Featured tasks and workflow guides are `.home-support` panels of whole-card `.home-card` links (aria-labelledby on the heading) scoped under `.home-page`; `SectionIsland`, the registry and search are unchanged.


## Sitewide navigation and catalog-only Home (Prompt 2 of 9) - 2026-10-29

Status: CURRENT on the local candidate `feature/homepage-colorfield-refresh` (unreleased, uncommitted). Verified by unit tests and headless Chromium at 320 to 1440 CSS px; see `test/e2e/sitewide-navigation.spec.ts`, `fixed-header.spec.ts`, `responsive-shell.spec.ts` and `brand-assets.spec.ts`. This section supersedes, for the header and Home only, the older "Current site chrome" header description, the "Approved homepage Colorfield adaptation" Home order (featured tasks and workflow guides after the catalog), its slogan-plus-note hero copy and its per-tool decorative icon mapping. Palette colors and the `--home-*` tokens are unchanged (Prompt 3 owns the visual material).

- Primary navigation, in order: Home (/), All tools (/discover), Workflows (/workflows), Guides (/guide). Exactly four primary links; there is no second primary /discover link. About (/about) is a footer link (with Contact and Privacy), not a primary header link. Items live in `src/app/navData.ts`; categories are not listed there and appear in the Categories disclosure.
- Categories disclosure: the seven populated categories in canonical definition order (document, text, math, converter, time, image, developer) linking to /category/<id>, labelled with `getToolCategoryDefinition(id).title` (PDF Tools, Text Tools, Math Tools, Converters, Time Tools, Image Tools, Developer Tools). `layout.tsx` derives them from `getAvailableCategory()`; `getToolCategoryLabel` now returns the canonical title. AUD-010 stays assigned to Prompt 8 for its complete audit.
- Search is a utility button, not a primary link. It goes to /discover#tool-search and focuses the labelled search input; on /discover it focuses in place. Plain /discover never steals focus. Themes keeps using ThemeToggle and ThemeProvider.
- Desktop (1024 CSS px and wider): one persistent header row with brand, five links, Categories disclosure, Search and Themes; no second navigation row. Mobile (390 x 844): collapsed header at most 72 px tall; brand, Menu, Search and Themes controls of at least 44 x 44 px. Menu opens one overlay that is out of flow (it does not enlarge the measured header footprint), lists all five primary links and all seven categories without a nested disclosure, and may scroll inside a viewport-bounded area. Escape closes it and returns focus to the Menu button; outside click and route change close it. aria-expanded and aria-controls are real.
- The one semantic header, `HeaderViewportControl` footprint and `--header-height`, the no-JavaScript ordinary-flow fallback and the normal-flow footer are unchanged.
- Home order: one H1 with at most one short factual sentence about the browser utilities and browser-local file handling, the existing ToolSearch, seven canonical category links, then the registry-driven catalog grouped by category with exactly one whole-card link per registered tool (18 today; a test assertion, never visitor copy). The "Start with a common task" and "Practical file workflows" Home sections are removed; the guide modules, value examples and /guide routes are untouched. Cards are `UtilityCard` (presentation-only whole-card Link: href, title, description, categoryId, categoryTitle), take category identity from the existing category role variables and carry no decorative per-tool icon. At 390 x 844 a tool card is visible in the first viewport.
- Implementation notes: the Menu below 1024 px and the Categories dropdown from 1024 px are one DOM list shown or hidden with CSS (no duplicated focusable links); the open Menu is a fixed overlay under the header. ThemeToggle keeps its markup and `global.css` raises its header trigger to 44 px. Without JavaScript the `<noscript>` rule shows every destination inline and lets the header row wrap. The unused `.home-hero-note` and `p.home-card-task` rules were removed after a source search found no other reference; `.home-support` selector alternatives remain because other ds-panel consumers share them. `src/app/HomeToolIcon.tsx` is no longer used by Home but is still used by the category route, so it is retained.
- /workflows is a Server Component that lists the four workflows from `src/module/workflow/registry.ts`. All four (Prepare an Image for Upload, HEIC Photos to PDF, Assemble a PDF Packet, PDF Pages for Slides) are links to their operational detail routes; the "Coming soon" section renders only if the registry ever holds a workflow that is not operational, and none does now. The hub was the 35 to 36 sitemap addition; the four live workflow detail URLs make 40 (see "Workflow route: prepare-image-for-upload" and "Workflow routes: HEIC photos, PDF packet and slides").

## Palette, semantic materials and design-system foundations (Prompt 3 of 9) - 2026-10-29

Status: CURRENT on the local candidate (unreleased, uncommitted); proven by `test/e2e/sitewide-palette-foundation.spec.ts` and a 54-screenshot headless review. One Dark persistence: selecting One Dark stores palette `onedark` and keeps the previously chosen ordinary mode (system, light or dark) in the existing theme key; One Dark always renders fixed dark, the Light/Dark/System radios are disabled while it is active, and leaving it restores that mode, including after reloads. Legacy `theme=onedark` data loads as One Dark with a conservative dark mode. Dark category values for text, math, time, developer and document were retuned (and document, math, developer, time for One Dark) so dark sections separate by at least 20 RGB and labels reach 4.5:1 on every dark panel. Scope is the shared role layer only. The interiors of the 18 tools (controls, previews, statuses, outputs) are applied by Prompt 4 and are not changed here.

- Appearances: exactly thirteen resolved appearances (original, mineral, oxblood, signal, cobalt, amber, each Light and Dark, plus the fixed-dark One Dark). Palette ids, names, default preference, storage keys and the pre-paint initializer are unchanged.
- Role hierarchy (one token map, no second family): canvas (--background, --text, --text-muted); section/panel (--panel-bg, --panel-border); card (--card-bg, --card-border, --card-hover-bg); editable control (--input-bg, --input-border); preview (--preview-*); result (--result-*); primary action (--accent, --accent-hover, --contrast); secondary action (--secondary-action-*); feedback (--success, --warning, --danger, --danger-soft); focus (--focus-ring); category (--category-<id>, --category-<id>-soft); chrome (header, navigation, search, footer roles). The --home-* and board roles are expressions of these roles, not alternatives.
- Hero (light): --accent 20% over --surface, border --accent 45% over --surface, text --text. Supporting panels start from --panel-bg and --panel-border and never copy the hero tint. Violet & Graphite anchors its hero on its violet role so the name stays truthful.
- Category boards: light = --category-color 18% over --panel-bg, chips use --category-<id>-soft; dark = --category-color 24% over --panel-bg with a restrained 4 px category edge, and cards keep a distinct neutral tier with a visible border. A category id computes to the same accent on every route in a given appearance.
- Dark category separation: Text/Math and Time/Developer section surfaces differ by an RGB distance of at least 20 in all seven dark appearances.
- Contrast: normal text at least 4.5:1 against the composited actual background (Discover result descriptions, Choosing a tool, Keep in mind, guide summaries, PDF section labels in every appearance); non-text boundaries at least 3:1 where they identify controls or focus.
- Theme picker: each palette choice carries an aria-hidden hero / section / action swatch whose colours are declared in theme.css (no second colour list in TypeScript); the original choice is marked Default; selecting One Dark shows "One Dark uses a fixed dark appearance; color mode does not apply." and the Light/Dark/System radios are disabled while the stored mode preference is kept.
- Deferred: Prompt 4 interiors, Prompt 7 interactive Guides, Prompt 8 search placeholder, repeated Home card category text and raw category-id pills.

## Tool interiors and cross-route presentation (Prompt 4 of 9) - 2026-10-29

Status: implemented and browser-validated in this worktree (see the Prompt 4 report); not committed.

- All 18 tool interiors consume the P3 semantic roles through one shared set of hooks in global.css: tool-control (text, number, select, textarea), tool-file-input, tool-action-primary, tool-action-secondary, tool-preview, tool-result and tool-feedback (with data-tone success, warning or error). No tool owns a private hexadecimal or violet/teal/gray color.
- ToolSurface (src/component/tool/ToolSurface.tsx) is a presentation-only section with kind work, preview, result or feedback and tone neutral, success, warning or error. It never fetches, reads files or imports the registry.
- Category hue identifies the tool category only; primary actions use accent roles and severity uses success, warning and danger roles.
- Quality is shown only when the selected encoding uses it; PNG output states that it has no quality setting.
- Hooks consume tokens only: the former undefined error-* utilities in the five document tools are replaced by tool-feedback data-tone=error. Disabled actions are transparent with a dashed secondary border and muted text, so they never resemble an enabled accent button. Hover switches a primary action to the accent-hover role.
- Tool pages use PageHeader with the canonical category cue (data-category-cue, same --category-color as the category page); the guide hub and task guides use the same PageHeader. Category pages list Available tools before the Choosing-a-tool guidance so the first card is inside the first 390x844 viewport.
- Length and weight converters place Value, From and To on one aligned row from the sm breakpoint.
- ImageSourcePanel (shared by the resizer, compressor and converter) renders its section on the work-panel role through toolSurfaceClassName and its file selector through tool-file-input (input roles). The HEIC converter keeps its own source section (it is not migrated to ImageSourcePanel) but renders it on the same work-panel role as its adjacent Conversion settings panel.
- Slugify shows no result surface for an empty input. A generated slug appears under a visible "Generated slug" label in an output bound to the Text input; a non-empty input that yields no slug (for example only punctuation or non-ASCII characters) shows neutral status feedback instead of an empty success result. Clearing the input removes both.

## Current site chrome — 2026-10-24

Header (the five-link, Categories, Search and Menu composition is superseded by the 2026-10-29 section above; the fixed placement and measurement below remain current): one semantic `<header>` is fixed to the top of the viewport (`fixed inset-x-0 top-0 z-50`) and stays visible while the document scrolls. It holds the branding, the single primary navigation, the Search utility and the Themes control, never wraps (a single row of at most 72 px) and has no show/hide control. `HeaderViewportControl` (client, `src/component/layout/`) only measures the rendered header with a `ResizeObserver`, sizes one in-flow footprint to match (so wrapped navigation never covers content) and publishes the height as `--header-height`, which `global.css` uses for `scroll-padding-top` so anchors and the skip link land clear of the header. Without JavaScript a `<noscript>` rule returns the header to ordinary flow.

Footer: one semantic `<footer>` in ordinary document flow, rendered by `AppShell` after the main content and the optional footer advertising slot. `AppShell` is a `flex min-h-screen flex-col` container whose content region grows, so a short page ends with the footer at the bottom of the viewport and a long page reaches the footer only by scrolling to the end. The footer is never fixed or sticky, has no spacer, no `--footer-clearance` variable, no viewport tracking and no software-keyboard handling. Copyright, Contact Us, Privacy Policy and the conditional Report Issues trigger remain. The links form one horizontal row on the trailing side, like the header, and wrap in order only when the width requires it, so the footer stays one line tall on desktop.

Browser tab title: each page uses its unbranded title plus the single suffix " - iworkhere" (`buildBrowserTitle` in `src/lib/seo.ts`), for example "Merge PDF Files Online - iworkhere". Descriptions, canonical URLs, robots rules and page-specific Open Graph and Twitter titles remain present. Historical: the October 24 implementation used the uniform title `iworkhere` (`BROWSER_TITLE`) on every page; v0.4.4 Batch 1 replaced it. Primary navigation at that date was Home, All tools, populated categories, then About; the current set is in the 2026-10-29 section.

Superseded history: the retractable header (Show navigation / Hide navigation), the fixed collapsible footer, `FooterViewportControl` and `--footer-clearance` described in the v0.4.2 and v0.4.3 sections below record behavior at release time and are no longer current.

Slugify uses a visible Text label explicitly associated with `slugify-input`. Its input follows existing semantic input tokens, full-width responsive sizing and a visible keyboard focus outline. This applies the existing form convention without adding tokens or changing the page template.

This document is the canonical authority for product visual design, styling, interaction presentation, responsive behavior, and accessibility-oriented visual rules. It combines accepted design intent with current repository architecture and behavior. Architecture and code-ownership rules remain in `docs/architecture.md`, `AGENTS.md`, and `CLAUDE.md`.

The UI/discovery revision is defined in [UI, discovery, and measured growth](plans/ui-discovery-growth-plan.md). The user approved Delivery 1 (homepage, compact navigation, Image Resizer, and current theme/material behavior) on 2026-10-03. Delivery 2 image-family rollout and search foundation was implemented, validated, merged, and publicly deployed on 2026-10-04. The visual/layout acceptance remains recorded in the plan and launch evidence; no new design-system scope was added.

## Planned v0.4.4 quality and guide presentation — 2026-10-26

Status: planned; no application styling or content change is claimed by this
documentation update. The [implementation plan](plans/v0.4.4-implementation-plan.md)
defines exact requirements and path ownership.

Restore distinct browser titles through the existing SEO owner with the
single suffix " - iworkhere"; the merge page must be titled
"Merge PDF Files Online - iworkhere". Preserve page-specific social metadata,
canonicals and robots. This is the approved replacement for the uniform-title
rule, not a header/logo redesign.

Add Guides after All tools in primary navigation; retain populated categories
in order and About last. The home workflow section follows the existing five
featured tasks and precedes the catalog. Keep those five tasks stable even
when the example collection grows. Tool pages continue to put the functioning
tool before worked examples and guidance; relevant task-guide links follow
that guidance.

The guide hub and four detail pages use current semantic text, panel, link,
focus and spacing tokens. Detail pages present starting material, expected
outcome, ordered steps, measured example, verification and limitations in a
readable article. All content is server-visible; downloads and tool handoffs
are explicit visitor actions. No new palette, independent scrolling surface,
hero illustration, animation, CMS or processing UI is added. Pages remain
ad-free. Preserve the fixed header, normal-flow footer and approved About copy.

Verify mobile/desktop reading order, reachable controls, visible keyboard
focus and header clearance for anchors. Do not restore historical retractable
footer behavior when extending examples or links.

## Diagnostic details

The operational dashboard retains its compact server-rendered style. Diagnostic
messages wrap within the existing panel; native details/summary disclose stacks,
causes and runtime context. Code regions have bounded height and internal
scrolling. Diagnostic strings use normal React escaping, never HTML rendering.
Geometry is unchanged across light/system/dark and at mobile widths. Legacy
metric failures explicitly state that detailed diagnostics are unavailable.

## Separate operational dashboard

The independent `dashboard/` app uses compact server-rendered cards, accessible
tables, ordinary range links and inline SVG usage charts. It uses system
light/dark media preference, existing semantic token names and no persistent
theme state. Dashboard CSS defines its own palette with those roles; it does
not import public layout/theme code. Geometry stays identical across preferences.
No chart/UI framework, animation, advertising or marketing surface is added.
The viewport-class label means CSS viewport width, never hardware identity.
Tables scroll horizontally on narrow screens; keyboard focus and active range
remain visible. Empty measurements show “No data yet”, never invented samples.

## Product direction

The interface is utility-first, modern, polished, calm, technically precise, trustworthy, efficient, and product-grade. Prefer solid semantic surfaces, restrained elevation, system sans-serif typography, and predictable spacing and shape scales. Clarity outranks cleverness; use explicit, composable UI and keep data flow visible.

Plain Light/Dark (including System) use solid restrained materials. Only expressive One Dark may selectively use glassmorphism and restrained neomorphic depth. Do not introduce neon styling, decorative multicolor gradients, giant display typography, fake metrics, testimonials, invented marketing copy, decorative illustration systems, gamer/cyberpunk styling, or a generic SaaS landing-page appearance.

## Color and themes

### Six-palette appearance extension (2026-10-09)

The public app separates palette identity from color mode through the existing
theme module and header control. Violet & Graphite (`original`, default with
System mode), Mineral Research (`mineral`), Oxblood Atelier (`oxblood`), Signal
Green (`signal`), Cobalt & Terracotta (`cobalt`), and Amber & Graphite (`amber`)
each support Light, Dark, and System. Palette values are maintained in the
existing theme registry and CSS. The recorded design reference was established
at source commit `0c713001369bbfc76c416126877811a8888df07b`.

The header keeps the approved Le mark and wordmark; its L is navy in Light and
white in Dark and One Dark so the mark stays distinct on each header surface.

One Dark remains an additional legacy palette with its original fixed dark
colors and expressive materials. It is not one of the twelve documented schemes.
Selecting it disables color-mode controls; selecting another palette restores
ordinary mode selection. Existing stored `theme: "onedark"` values retain that
appearance. Other existing mode choices keep their preference and default to
Violet & Graphite when no palette has been saved. Invalid settings fall back independently.

Exact reference color values and aliases are declared as `--palette-*` in the
existing theme stylesheet to avoid collisions with Tailwind's `--color-*` wiring.
One shared mapping connects them to existing header, navigation, card, panel,
preview, result, action, input and focus roles. Functional cyan supplies readable
Violet & Graphite text and primary-action fill; brand cyan remains the focus role.
The reference typography, radii, large shadows and decorative card treatments
are not applied to app geometry. Existing system typography, restrained shadows,
category identity, tool behavior and layout remain authoritative. All six new
palettes use solid materials; no effects preference is introduced.

The Themes button opens a named nonmodal appearance dialog with native palette
and color-mode radio groups. Escape/Close return focus; outside press or focus
leaving dismisses it. The panel is bounded to the mobile viewport and can scroll.
The storage adapter retains JSON-serialized `theme` and adds JSON-serialized
`palette`. The existing pre-paint initializer mirrors those reads before hydration.
For documented palettes, `data-theme` is effective light/dark, `.dark` agrees,
and `data-theme-preference` stores the mode. Legacy One Dark retains its existing
`data-theme="onedark"` hook. System follows later OS changes through the provider.

The previous four-choice rules below describe the retained pre-extension baseline;
this extension supersedes their exact-choice and System-attribute restrictions.

Themes define palette; components consume shared semantic visual roles. Category colors provide catalog identity. The retained mode IDs are exactly `system`, `light`, `dark`, and `onedark`. System selects Light or Dark through CSS `prefers-color-scheme`. Invalid modes fall back to System and invalid palettes fall back to Violet & Graphite before paint and after hydration. Civic Light and Spectrum were rejected; their historical evidence remains historical.

Light uses a dark navy header, clean white category-marked cards, a cool search surface, slate settings and preview, and mint completed output. Dark uses a deeper shell, cool slate panels, inset preview and restrained dark green results. One Dark uses its purple, blue, cyan, yellow, green and red families. Geometry, typography, spacing, navigation and processing remain theme-independent.

Shared visual-role tokens are header-bg/text/muted; nav-hover-bg/active-bg/active-text; search-bg/border; card-bg/border/hover-bg; panel-bg/border; preview-bg/border; result-bg/border; secondary-action-bg/border; footer-bg. Inputs and danger-soft have shared role tokens. Category image/text/math/time/converter/document/developer colors and soft tints live in the canonical theme CSS, with no independent palette registry. Small category chips and card edges carry identity; broad saturated tiles are forbidden. Primary actions use accent/contrast, secondary actions use their own surface/border, and result/error states also retain headings, metrics and actionable messages.

Theme values remain in `src/style/theme.css`, wired through Tailwind v4 in `global.css`. All text combinations target AA; focus retains its ring and contrast support. This component-color candidate remains approved for Delivery 1 by the user on 2026-10-03.

## Typography, spacing, and shape

The public privacy page uses the existing AppShell, a readable `max-w-3xl`
article, one H1 and H2 section headings with ordinary document scrolling.
Policy links in the page body are underlined with visible semantic focus rings.
The footer's Privacy Policy and Contact Us links are not permanently underlined
(see "v0.4.3 footer navigation" below); they keep a visible focus ring.
No new palette or material is introduced.

The v0.4.3 About (`/about`) and Contact (`/contact`) pages use the same pattern:
the existing AppShell, a readable `max-w-3xl` article, one H1, H2 sections, no
advertising frame and no new palette or material. The Contact form reuses the
SupportDialog control vocabulary (`rounded-lg` inputs on `input-bg`/`input-border`,
`material-primary` submit, secondary-action Clear message, `danger` for errors).

Use one system sans-serif family for interface text and the existing monospace role for code. Establish hierarchy through size and weight, not display faces, decorative tracking, or excessive letter spacing. Keep spacing predictable and content comfortable without wasting workspace. Use consistent, slightly rounded shapes and subtle borders. Shadows separate surfaces; they do not decorate them.

Use a consistent spacing rhythm instead of dense layouts or per-tool pixel tuning. Use size and weight for title, section, body, and caption hierarchy. Keep shadows subtle in every theme. Motion is optional; use only short, purposeful hover or focus transitions that do not move layout geometry. Avoid bounce, scale effects on primary layout, giant blur halos and decorative shadows. Expressive material shadows are bounded, directional and never the sole boundary.

The shared conceptual color tokens are background, surface, surface-alt, border, text, text-muted, accent, accent-hover, accent-secondary, accent-warm, accent-cool, accent-soft, contrast, danger, success, warning, and focus-ring. Add or change a token only when the system requires it and update this contract. Keep base tokens in `src/app/global.css` and theme overrides in `src/style/theme.css`; do not put random colors in tool code.

## Application layout and scrolling

The active pilot changes navigation and Resizer allocation while preserving AppShell, the single main landmark, skip-link target and natural document flow. The Delivery 1 implementation is visually approved.

`AppShell` owns the shared page layout. Compact `VerticalNav` links are in the upper application header and do not reserve a desktop side column. The optional right advertising rail is a stable 176px at xl (1280px), hidden narrower; active top/right slots exist only with the explicit production ad flag. Main content receives the available width through a flexible track and remains capped near 1280px. The Image Resizer pilot uses a 280–320px source/settings column beside a flexible preview/result stage when space permits.

Mobile stays a single column with about 20px page padding. Compact navigation wraps. The Image Resizer stacks source, preview, settings, and result actions in a usable reading order. No drawer, hamburger, or modal navigation system is used.

The browser document owns primary vertical scrolling. Let long workspaces grow naturally. Do not trap the shell at viewport height, hide overflow at the shell, or make a middle workspace the primary independent scrollbar. The site footer is a single semantic region fixed to the bottom of the viewport (v0.4.2, released 2026-10-20; see "v0.4.2 viewport chrome and reporting"); document scrolling stays natural and shell-level bottom clearance keeps the last content reachable. The footer banner slot remains available but root supplies none, and it stays in ordinary document flow outside the fixed footer.

## Shared controls and page composition

The image family shares only source presentation through `ImageSourcePanel`:
source heading, file input, helper/status, display-ready source information and
preview. This preserves the existing three-tool markup, tokens and layout.
Tool owners retain all state, validation, URL lifecycle, controls and results.

Extend current component and route owners. Buttons should have clear primary and secondary hierarchy, visible disabled state, and visible keyboard focus. Inputs need an accessible label, a clear border, and a strong focus indication; placeholder text is not a label. Links use the theme accent with a restrained hover state. Cards use semantic surfaces, consistent padding, and subtle separation.

Destructive button styling uses the danger token only for destructive actions. Inputs use consistent padding and restrained danger styling for errors. Reusable components keep consistent patterns; avoid one-off tool button styles, inline styles, and per-page custom CSS when existing Tailwind utilities and shared tokens express the design.

Home remains a utility-first entry point. Discover remains a utility catalog. Category pages remain concise work and navigation pages. Tool pages keep the tool workspace dominant. Do not replace existing product content with invented promotional copy, metrics, or testimonials.

The theme trigger label is exactly `Themes`, remains a compact secondary control, and has no palette icon in the trigger. Preserve all six documented palettes, Light/Dark/System modes, fixed-dark One Dark compatibility, persistence and the existing runtime mechanism. Footer identity text is exactly:

> © 2026 iworkhere.space created by dailephd LLC

## Accessibility and motion

Keep a working skip link to `#main-content` and exactly one main landmark. Interactive controls must be keyboard accessible and have visible focus in all themes. Label inputs; use semantic headings; never convey important state by color alone. Maintain sufficient contrast, avoid unintended horizontal document scrolling, and respect reduced-motion preferences. Avoid surprise, attention-grabbing, bouncing, or layout-shifting animation.

## Performance and implementation

Assume mobile devices and slow networks. Prefer the system font stack and minimal JavaScript. Do not add animation libraries, icon packages solely for visual polish, WebGL, canvas effects, large background imagery, client-side visual frameworks, or styling frameworks. Do not turn Server Components into Client Components just to style them. Do not add a runtime dependency solely for visual modernization.

All analytics go through the existing `track()` abstraction and declared event names. Persistent state continues through the existing storage abstraction. Treat inputs as untrusted, prefer current client-side processing, and do not add dynamic execution. These implementation boundaries are governed by the architecture and retrieval-first instructions; design work does not authorize changes to them.

## Accepted workspace-first pilot (historical rollout specification)

Status: Delivery 1 is implemented and user-approved. Delivery 2 is implemented, validated, merged, and publicly deployed. The Delivery 1 approved visual baseline remains unchanged. The planner-authored [UI/discovery plan](plans/ui-discovery-growth-plan.md) owns scope, research, rollout, and search requirements.

The accepted implementation changed the working composition: compact top navigation in place of the permanent left navigation rail; a functional search entry point rather than the inactive header search field; and compact image settings beside a larger preview/result stage. Mobile uses a logical stacked workspace and compact wrapping navigation, not a new drawer or modal system. Existing route identities and AppShell ownership remain.

The homepage is a compact launcher with one working search surface, populated categories, real linked tool cards, and a curated image-tool group. It must not become a full-screen promotional hero. Do not describe curated tools as popular without usage evidence.

Pilot values are approximately 280–320px for the desktop settings column and 28–32px for tool titles, with a flexible preview stage, the existing near-1280px content maximum, and existing semantic tokens. These are accepted local workspace targets, not new global CSS requirements. Preserve the appearance system, accessible focus, error quality, actual image aspect ratios, truthful result metrics, and natural document scrolling.

Production integration supersedes placeholder restrictions: root supplies real top/right AdSense slots only when explicitly enabled. No fake footer or right banner is visible; left remains absent.

The completed Delivery 1 visual review covered the homepage and Image Resizer at 1440×900 and 390×844, light and dark, including empty, selected, successful-result, and error states before the Delivery 2 image-family rollout. Functional or Observer evidence is not a substitute for visual approval. The current-layout and affected component contracts describe the pilot implementation with the Delivery 1 visual direction approved.

## Change and documentation rules

Batch 2–6 document tools use existing solid raised panels and semantic source,
input, action, result and error tokens. Ordered source controls and split groups
wrap/stack naturally with min-width-zero children; no theme geometry changes,
drag/drop, animation, new palette or shared UI framework. Result headings receive
programmatic focus, errors remain local alerts, and downloads are explicit links.
Compress PDF uses one structural mode, stacked responsive size/savings metrics,
and a neutral headed NO REDUCTION ACHIEVED panel distinct from the error alert.
Each document action/settings form has a task-specific accessible name. Source,
settings/action and guide regions remain independently navigable landmarks;
document Observer acceptance checks their order, containment and natural scrolling
at 1440×900 and 390×844 without changing homepage or image baselines.

The complete five-tool document family shipped with v0.3.0. Merge
and Images to PDF keep ordered source lists; Split keeps independently edited
page groups; PDF to JPG / PNG has page/format/DPI and conditional JPEG settings;
Compress PDF retains its single structural action and truthful no-reduction
state. These task-specific differences are not a universal workspace contract.
Server guides and category-aware related document links use the existing page
template. Batch 6 document Observer acceptance passed all ten desktop/mobile
lanes, with homepage and image baseline hashes preserved. Loaded states,
downloads, errors and focus remain covered by operation browser tests.

Before changing a design or styling contract, update this document and then apply the decision consistently through the current owners. Architecture changes are documented in `docs/architecture.md`; project state belongs in `docs/project-status.md`; new abstractions require updating agent guidance. Use fresh source retrieval before proposing cross-cutting changes, and update affected component/module specifications. See `docs/doc_index.md` for the documentation map.

## Component-color review contract

The historical component-color review covered five visual contexts: system-light, system-dark, light, dark, and One Dark. Its category mapping used the former `everyday` category; current category tokens use `converter` with the same preserved values. Developer tokens: Light `--category-developer: #c2410c` / soft `#fff0e8`; Dark (system-dark and explicit) `#fb923c` / `#3b2418`; One Dark `#d19a66` / `#3a3027`, mapped through `[data-category="developer"]` like the other categories. Contrast references: Light ~5.18:1 on white and ~4.66:1 on its soft tint; Dark ~8.53:1 and ~6.39:1; One Dark ~6.25:1 and ~5.22:1. Secondary accents do not replace status meaning. Functional evidence does not grant visual approval.

## Peer islands and expressive material pilot

The homepage has one SectionIsland for each populated registry category, in canonical category order, with the shared styling used across all sections. SectionIsland remains presentation-only: it accepts a heading, optional description and children and owns no tool, category, search or routing logic. HomeClient renders registry-derived membership, exactly one card per tool, and the direct All tools link. Section and card geometry is validated at desktop and mobile sizes.

Light/Dark use opaque lightly tinted islands, solid child cards and restrained elevation, no glass blur or neomorphic shadow pair. One Dark uses purple/slate structural glass on islands, preview/result and theme popover, with 12px blur/120% saturation and high-opacity backgrounds. Cards, settings and secondary actions use restrained paired directional shadows; primary actions remain solid with visible hover/pressed treatment. Search stays solid and bordered. Header/footer/banner remain solid and quiet.

Material tokens: island-bg/border/shadow, card-shadow/hover-shadow, raised-shadow, primary-shadow, pressed-shadow, glass-filter and glass-highlight. Canonical theme CSS defines values; shared material utilities consume them. Fallbacks are opaque without backdrop-filter; prefers-reduced-transparency and forced-colors disable glass/depth. Themes never change grid, dimensions, spacing, order, DOM or breakpoints. Verify actual alpha-composited text and control boundaries, not shadow contrast. This scoped permission supersedes the earlier global glass prohibition. The user approved this Delivery 1 material direction on 2026-10-03.

## Production advertising placement

Explicit production AdSense opt-in supplies only top and right AppShell slots. Disabled ads supply no placeholder. Top reserves 100px mobile / 90px desktop without clipping or maximum height. Right track is stable 176px at xl (1280px), hidden below. Quiet Advertisement labels and neutral surfaces distinguish Google content from controls; no glass/category tint. Footer slot capability remains, with no fake root footer banner. This supersedes earlier placeholder/112px restrictions.

## Isolated reconciliation (2026-10-11)

Violet & Graphite / System is intentionally the utility default. The existing theme owners remain the only appearance system. Homepage sections follow populated category registry order and preserve every tool card and the All tools route. Native radio controls retain keyboard selection, focus return and Escape. Preview swatches and a separate pre-palette option are deferred to keep this integration bounded.

## Post-release converter category migration — 2026-10-11

The public `everyday` category becomes `converter`, titled **Converters**.
Its category foreground/soft tokens are renamed without changing any value,
across the six palette Light/Dark modes, System and fixed-dark One Dark.
Existing semantic roles, geometry and appearance provider remain unchanged.
QR Code Generator uses the existing developer identity. Homepage sections,
navigation and breadcrumbs resolve the converter label from category.ts;
related-tool headings continue to describe their related entries.
The v0.4 release decision is historical and remains intact.


## Historical v0.4.2 viewport chrome and reporting — 2026-10-14

Status: INCLUDED IN THE v0.4.2 GITHUB RELEASE (2026-10-20). The notes below describe the released footer and header behavior, which supersedes the earlier normal-flow footer-placement rule, not the document-owned scroll model. Vercel production deployment and support activation are verified separately. The report entry is shown only when the build-time flag `NEXT_PUBLIC_SUPPORT_ENABLED=true` is set (default off), so a normal public build renders the fixed footer and retractable header but no report entry. The paragraphs that follow keep the approved plan wording; the labeled implementation notes record what was built.

Header: keep normal-flow Header and a single primary navigation landmark at the page top. When its original sentinel is entirely above/outside the viewport, display a small anchored top "Show navigation" control. On activation, expose the existing Header as a temporary top-fixed, dismissible overlay, never as a second mounted navigation tree and never by resetting page scroll. Hide the substitute control on return to the actual in-flow header. Close on Escape/navigation; restore meaningful focus. Preserve header layout space and avoid scroll anchoring/jump. Respect the header banner/ad slot as separate normal-flow content.

Batch 2 implementation note (2026-10-19): the header behavior above is implemented. `HeaderViewportControl` (client, `src/component/layout/`) wraps the single server-rendered `<header>` in a footprint element observed with `IntersectionObserver`; the control appears only when that element is fully outside the viewport. Expanding switches the same header element to `fixed inset-x-0 top-0 z-50` and pins the footprint to the measured header height so the document does not jump; while expanded, a `ResizeObserver` on the header keeps that height current after responsive resizing. The control (`aria-expanded`, `aria-controls` the header id) is `z-40`, so the header's theme popover stays above it, and relabels to "Hide navigation" under the overlay. The header, footer and AppShell remain Server Components rendered inside the client wrappers; no second navigation tree is mounted. Escape, a navigation link click, a route change and returning to the top close the overlay; Escape is left to an open modal `dialog` or an open header popover such as the theme selector. Native modal dialogs render in the top layer above the overlay. No transitions are used, so reduced-motion needs no special case. Verified in headless Chromium at desktop and mobile sizes; physical-device behavior was not tested.

Footer: change the semantic site Footer itself to a compact viewport-fixed bottom region with current copyright and privacy link, plus a site-wide reporting trigger. Default is expanded on the first visit. Provide an accessible "Hide footer" action and a minimal anchored collapsed state containing separate "Show footer" and "Report" actions. Use the existing storage adapter to remember explicit preference across navigation/reload without first-paint flash. Do not fix or hide the optional footer advertising banner slot; it stays in ordinary document flow. Ensure natural document scroll, visible focused input/actions, last-result/download reachability, bottom clearance, safe-area insets, virtual keyboard support and bounded mobile viewport occupation. The viewport can be smaller than the document; no nested main scrollpane.

Batch 3 implementation note (2026-10-19): the footer behavior above is implemented. `FooterViewportControl` (client, `src/component/layout/`) wraps the single existing `Footer` in one `<footer>` fixed to the bottom of the viewport (`fixed inset-x-0 bottom-0 z-30`, below the header overlay `z-50`, its control `z-40` and the native report dialog in the top layer) with `max(0.5rem, env(safe-area-inset-bottom))` bottom padding. Expanded is the default; "Hide footer" collapses it and "Show footer" restores it, with `aria-expanded` and `aria-controls` pointing at the element that holds the footer content. Collapsed hides only the copyright and the Privacy Policy link; the existing reporting trigger stays visible beside the toggle and shows the compact visible label "Report" (accessible name "Report a problem or suggestion"; see the Batch 4 corrections below). Expanded height measured at 51px by full width on desktop and 113px by full width on a 390px phone; the layout is held to at most a fifth of the viewport. The preference is the string `collapsed` or `expanded` under the `footer-preference` key of the storage adapter; any other value, or unavailable storage, means expanded. A pre-paint script in the root layout sets `data-footer="collapsed"` on the document element, and CSS keyed on that attribute draws the collapsed state before hydration, so there is no expanded-to-collapsed flash; the attribute is the single runtime source of truth that React reads. One shell mechanism provides clearance: `--footer-clearance` has CSS fallbacks in `global.css` and is replaced by the footer's measured height through a `ResizeObserver`. An in-flow spacer of that height ends the document, and `scroll-padding-bottom` uses the same value so focused controls and anchors stop above the footer. The footer advertising banner slot stays in ordinary flow before the footer. Without JavaScript, a `noscript` rule returns the footer to normal flow and hides the toggle and spacer. Software-keyboard handling is described in item (4) of the Batch 4 corrections below; physical iOS and Android keyboard behavior was not independently verified.

Batch 4 integration corrections (2026-10-19), which refine the collapsed label, collapsed geometry and keyboard handling of the Batch 3 note and describe the final released behavior: (1) The collapsed footer is a compact tab at the trailing edge (`left: auto`, reduced padding and toggle padding) instead of a full-width bar, measured at about 35px high and 182px wide at both 1280px and 390px, against 51px by full width on desktop and 113px by full width on a phone when expanded; it still exposes the report action and the toggle as targets of at least 24px, and the shell clearance follows its measured height. (2) The support trigger keeps the accessible name "Report a problem or suggestion" (`aria-label`) and renders two text spans; global CSS keyed on `data-footer` shows the full text when expanded and "Report" when collapsed, so one trigger and one dialog remain. (3) When the footer height changes while the reader is at the end of the document, `FooterViewportControl` scrolls to the new end so the last control is not left beneath a taller footer; collapsing at the end can only move content by the height the footer gives back, and mid-page positions are untouched. (4) The footer follows the visual viewport: when an unzoomed visual viewport leaves the bottom of the layout viewport hidden (a software keyboard), the footer is translated up by that amount, and a focused field it would cover is scrolled above it using `visualViewport` `resize`/`scroll` and `focusin` events only (no polling). Pinch-zoom is not treated as a keyboard. `viewport-fit=cover` is not set, so safe-area insets stay at their browser defaults. This behavior is verified in Chromium against a scriptable `visualViewport` stand-in and real page scaling; behavior on physical iOS and Android keyboards is not verified. (5) `scroll-padding-top` of 3rem keeps focus targets and anchors clear of the fixed "Show navigation" control.

Reporting: provide one consistent dialog on every public route, including while footer is collapsed. Category and expected/observed fields adapt predictably; tool context is visible and user-correctable. Prevent duplicate requests, show clear pending, success receipt, field validation, retry and unavailable states. The content and contact field are voluntary and must not be automatically copied into analytics or diagnostics. Do not offer upload/screenshot controls in v0.4.2. Confirmation is granted only after durable server persistence.

Layer order must preserve reachable skip-to-content, anchored top control, anchored footer and modal focus. Dialog is above fixed chrome; fixed chrome is above ordinary page content. Both chrome controls and report dialog work at keyboard-only and touch widths, within every existing theme/palette and reduced-motion settings. Never introduce large floating promotional surfaces, full-screen nav replacements, ad overlap or a new scroll-owner framework. Exact detailed contract and test responsibility: [v0.4.2 implementation plan](plans/v0.4.2-implementation-plan.md).

### Batch 1 implementation note — reporting dialog (2026-10-19)

The reporting portion of the plan above is included in v0.4.2, as are the header and footer retraction
implemented in Batches 2 and 3 (see their notes above). The single "Report a problem or suggestion" button is rendered through
the generic `AppShell.footerActionSlot` / `Footer.action` presentation slot; Batch 1 placed it in the then in-flow footer and Batch 3
kept the same trigger and dialog inside the fixed footer, in both the expanded and collapsed states.

The dialog is a native modal `<dialog>` (focus containment, inert page, Escape) portaled to `document.body`, titled by its heading,
using only existing tokens (`bg-surface`, `border-border`, `bg-input-bg`, `border-input-border`, `text-danger`, `bg-accent`, the focus
ring). It is at most `40rem` wide and `90dvh` tall, scrolls internally and never causes horizontal page scroll. Fields have visible
labels, `aria-invalid` and `aria-describedby` error text; the form is a `fieldset` disabled while submitting; failures use
`role="alert"` and keep the draft; the receipt uses `role="status"` with the opaque reference. Focus returns to the originating
trigger on close. Native controls only; no animation. The dialog sits above ordinary content, and the fixed header overlay and footer stay below it (the native modal dialog renders in the top layer).

## v0.4.3 task-first discovery and evidence presentation — 2026-10-18

Status: The v0.4.3 implementation is complete and committed on `feature/v0.4.3-utility-value`; its initial implementation SHA `7a470957956100554d8e96d1aaa15b023b5acdeb` passed all eight required hosted workflows and nine jobs. Each later candidate SHA requires its own exact-SHA validation. v0.4.3 remains unreleased, and production deployment is tracked separately. This dated section records its approved design intent and preserves the existing viewport chrome and reporting controls.

The homepage introduces practical tasks with honest, outcome-focused entry points to five *existing* file-processing utilities; it retains all registry-based category browsing, search and registered tool links. These are editorially chosen examples, never labeled as popularity or personalized recommendations without measured evidence. Category pages have genuinely different explanations grounded in present registered tools; minimal/one-tool categories do not receive repeated keyword filler.

A shared ToolExamplePanel shows original verified inputs/outputs, reproduction steps, measured relevant results, limitations and links to the functioning tool. Preserve original aspect ratios, contrast, mobile geometry, semantic captions/alt text, source-download choice and accessible keyboard order. No autoplay, surprise download, fake before/after effect, external embed, chart claiming nonexistent analytics, new file-processing runtime or copied third-party assets. The normal tool UI remains the primary interaction; the example is explanatory, not a replacement.

About/Contact present operator-approved identity and support channels. Do not invent personal contact details, a tracking form or a second reporting backend. New routes must preserve title/meta, keyboard navigation and responsive layout; links and sitemap/robots behavior must be verified. No changes to existing palette tokens or independent scroll owners. Ad slots stay subject to F-02 eligibility, including privacy/error-page exclusions. Full page/content acceptance belongs to the [v0.4.3 plan](plans/v0.4.3-implementation-plan.md).

v0.4.3 footer navigation (Batch 4, implemented): the existing single fixed, retractable footer keeps the exact copyright line and the separate Hide/Show footer toggle. In the expanded footer one compact group sits on the trailing side at desktop widths (stacked and safe to wrap on mobile), in **vertical DOM and visual order**: `Contact Us` (real link to `/contact`, always shown), `Report Issues` (the existing `Footer.action` slot holding the existing `SupportCoordinator` button; rendered only when `NEXT_PUBLIC_SUPPORT_ENABLED=true`) and `Privacy Policy` (link to `/privacy`). Both links use quiet link styling without a permanent underline (underline on hover only) and keep the visible focus ring. The report trigger's visible text is `Report Issues` expanded and `Report` collapsed; its accessible name is `Report Issues — report a problem or suggestion`, so the visible words are contained in the name (label-in-name). The dialog title and every other report behavior are unchanged. With support disabled the group holds Contact Us and Privacy Policy only. Collapsed: Contact Us, Privacy Policy and the copyright carry `data-footer-detail` and are hidden; the report button (when enabled) and Show footer remain, and the compact tab and the `footer-preference` key are unchanged. Without JavaScript the footer returns to normal flow and the contact/privacy anchors remain. Clearance is still the measured `--footer-clearance` (ResizeObserver); the pre-paint CSS fallbacks are enlarged to approximate the taller expanded footer. Measured heights are recorded in the Batch 4 test evidence (`docs/TESTING.md`).

## Workflow route: prepare-image-for-upload

Status: IMPLEMENTED on the local candidate (Prompt 5, unreleased, uncommitted). Prompt 6 added the other three operational workflows, described in the next section; this workflow's presentation is unchanged.

- The route /workflows/prepare-image-for-upload is composed by a Server Component (PageHeader, breadcrumb, manual-guide link) around the client `WorkflowClient`. Processing is browser-local and in memory; nothing is uploaded or persisted.
- Layout: one column on mobile, form beside progress from the lg breakpoint. The form uses the existing `tool-work` surface and `tool-control`, `tool-action-primary` and `tool-action-secondary` roles; progress uses `StageStepper`, a presentation-only ordered list; success uses the `tool-result` surface with `data-tone="success"`; failure uses the existing `tool-feedback` error role with `role="alert"`.
- Inputs: one source image, an explicit output format select (JPEG, PNG or WebP; never changed silently), maximum width and height in pixels, and a maximum file size labelled in bytes. The starting values 800, 600 and 100000 are illustrative and say so.
- Stages in fixed order: validate, inspect, convert, resize, compress, verify, complete. Each stage always shows its state as text (Pending, In progress, Passed, Skipped, Failed, Cancelled) with a description; skipped stages give a reason. State never relies on color alone. A polite `role="status"` line names the current stage and the finished count. Before Process every stage reads Pending and "Nothing has run yet".
- Process runs once; while a run is active the fields, file input and Reset are disabled, Process shows "Processing..." and a Cancel button appears. Editing any field or choosing a file after a run clears the result and releases its object URL.
- Result: a before and after table, a preview, every observed verification check (name, expected, observed) and exactly one download link. A failed or unmet run shows the specific reason, the unmet checks and "No file is offered for download."; it never shows a success surface.
- Control boundaries: the workflow's own inputs and select set their border to the existing `--text-muted` token (danger token when invalid) so the field boundary is at least 3:1 in every appearance. The shared `--input-border` token in One Dark measures 2.98:1 against the tool surface; that shared token is unchanged and the same shortfall remains on the established tool pages.
- Verified with Playwright at 1280x720 and 390x844 in original Light, original Dark and One Dark (initial, busy, success, unmet) and with computed WCAG contrast in all 13 appearances.

## Workflow routes: HEIC photos, PDF packet and slides

Status: IMPLEMENTED on the local candidate (Prompt 6, unreleased, uncommitted). The registry now holds four operational workflows and `/workflows/heic-photos-to-pdf`, `/workflows/assemble-pdf-packet` and `/workflows/pdf-pages-for-slides` are real routes composed exactly like the first (Server Component with PageHeader, breadcrumb and a manual-guide link around the client `WorkflowClient`). The manual Guides are unchanged and are not redirected. This section was written after the implementation, not before it; it records what is built and was reconciled against the captured screenshots.

- Presentation is shared with the first workflow and introduces no new color, shadow, animation or token: `tool-work` form surface, `tool-control`, `tool-action-primary` and `tool-action-secondary`, `StageStepper`, `tool-result` with `data-tone="success"`, `tool-feedback` for failures. Controls set their border to the existing `--text-muted` token (danger token when invalid), as the first workflow does. One column on mobile; form beside progress from the lg breakpoint.
- Every input is chosen before the single Process action. Each form owns only its fields, ordering and request construction; the client owns running, cancelling and downloads. The Process button stays disabled, with a visible hint tied to it by `aria-describedby`, until the request is complete and valid. Nothing runs, and no success surface exists, before a real Process.
- HEIC photos to PDF: a multiple-file input that appends in batches, an ordered list (page number, file name, size) with Move up, Move down and Remove per photo, a format select (JPEG or PNG) and a JPEG quality slider from 10 to 100 in steps of 5 that is not rendered for PNG. At most 20 photos, 25 MiB each and in total. Result: one `heic-photos.pdf` with its page count and size, the observed checks and one Download PDF link.
- Assemble a PDF packet: a multiple-file input for PDFs and JPEG or PNG images (each file gets a stable local id, `source-N`, independent of its name), a source list with Remove file, an "Add pages from" select plus a "Pages to add" field (for example `2-4, 7`; an image adds page 1) with Add page, and an ordered packet-page list with Move up, Move down and Remove. The same page may be added again to repeat it. A "Try lossless compression" checkbox is off by default. Result: `assembled-packet.pdf` and its checks; the compress stage reads Skipped with a reason when it is not requested or the packet is over 10 MiB, and an honest "did not make the PDF smaller" when compression ran without a saving.
- PDF pages for slides: one PDF input, a "Pages to add" field with Add page and an ordered list (each page once, up to 20), PNG or JPEG, 72, 150 or 300 DPI (150 is the starting value), a JPEG quality percent from 50 to 100 shown only for JPEG (85 starts; it is converted to the 0.50 to 1.00 fraction at the form boundary) and an optional largest-image size in bytes. Result: one thumbnail, caption (slide number, source page, pixel size, bytes) and Download link per image in the requested order, plus the checks. A missed byte limit shows every failing slide and offers no image.
- States in fixed order on each route: initial (all stages Pending, "Nothing has run yet"), busy (Process disabled and reading "Processing...", Cancel shown, Reset and all inputs disabled, a polite status line naming the stage and finished count), success, and failure or unmet requirement (`role="alert"`, stage, reason code, unmet checks, "No file is offered for download."). Cancelling shows a warning status and no output.
- Accessibility: every control has an associated label, every invalid value has a specific message tied by `aria-describedby` and `aria-invalid`, list actions carry the item in their accessible name, buttons and download links are at least 44px tall, focus is visible, and nothing overflows horizontally at 390x844 or 1280x720.
- Verified with Playwright at 1280x720 and 390x844: initial, busy, success and failure captured in original Light, original Dark and One Dark for each route, and computed WCAG contrast measured in all 13 appearances. The inherited One Dark `--input-border` shortfall (2.98:1) is outside this work and is avoided only by the `--text-muted` border override described above.

## Interactive Guide finder and legacy Guide redirects

Status: IMPLEMENTED on the local candidate (Prompt 7, unreleased, uncommitted). Written before implementation and reconciled below with what the browser run proved. Nothing here changes color, shadow, animation or any token.

- /guide becomes a deterministic "Which tool or workflow should I use?" finder under the unbranded title "Find the Right Tool or Workflow". One H1 comes from the existing PageHeader. The Server Component renders the H1, the introduction, plain /discover and /workflows links that work without JavaScript, and the initial root choice group.
- Flow: choose one of seven task families (Image, PDF, Text, Converters, Developer, Math, Time). Families with several distinct outcomes ask exactly one more question; Math and Time recommend their single tool immediately. A recommendation shows the real name, one sentence of rationale and one "Open <name>" link to the canonical /tool/* or /workflows/* path. Nothing navigates automatically.
- The authored graph lives in src/module/content/toolFinder.ts and stores only ToolId and WorkflowSlug references plus questions, choice labels and rationales. Names and paths are resolved by the Server Component from the tool and workflow registries and passed to the client as plain data.
- Choices are real buttons (tool-action-secondary family, full width, left aligned, at least 44px tall) inside a tool-work panel; the recommendation uses a tool-result panel and a tool-action-primary link. A button never contains a link and a link never contains a button. Choice cards are visually distinct from catalog tool cards and from workflow stage lists.
- State is one in-memory path stack starting at "start". Back pops one level, Start over resets it. No URL query, storage, upload, network call, ranking or AI is involved. After each change focus moves to the new question or recommendation heading (tabIndex -1), and a polite status region announces the recommendation.
- Layout stays one column at 320, 390 and 768 pixels and wraps long labels; the fixed header and footer stay in document flow.
- Legacy: /guide/prepare-image-for-upload, /guide/heic-photos-to-pdf, /guide/assemble-pdf-packet and /guide/pdf-pages-for-slides answer with a permanent redirect (HTTP 308) to the same slug under /workflows. Unknown slugs stay 404. The redirecting URLs leave the sitemap (40 to 36 URLs); /guide, /workflows and the four /workflows/<slug> pages stay. Tool and category pages link directly to the workflow routes so no internal link takes a redirect hop; the category heading reads "Automated workflows".
- The authored manual data (taskGuide.ts, TaskGuidePage.tsx, example assets) is kept unchanged as historical source data; its public HTML route is superseded.
- Known inherited limit, not changed here: the One Dark --input-border contrast (2.98:1) belongs to Prompt 8. The finder avoids input tokens and uses the secondary-action boundary.
- Reconciled after verification: the choice buttons, Back, Start over and the Open link carry an explicit visible focus ring (focus-visible outline, 2px, focus-ring token); headings are focus targets with scroll-mt-24 so the fixed header never covers a focused heading; the Open link sets prefetch off so choosing never requests the 22 destination pages. The recommendation panel reuses the existing tool-result role (it is solid in Light and Dark and green-tinted in One Dark; it states no output was made). Because the global .tool-action-secondary rule outranks the justify-start utility, single-line choice labels are centered while wrapped labels are left aligned on narrow screens.
- Verified in Chromium at 1280x720 and 390x844 plus 320 and 768 reading widths: 36 captures per viewport (12 states x original Light, original Dark, One Dark) were opened individually, and computed contrast of the root, question and recommendation states was measured in all 13 appearances (lowest text 4.61:1, lowest control boundary 3.12:1). The inherited One Dark --input-border value is not used by the finder and remains Prompt 8 work.

## Search, content quality and One Dark input border (Prompt 8 of 9) - 2026-10-30

Status: SPECIFIED before implementation; reconciled below after verification.

- Search is one client-local owner, ToolSearch, backed by a pure matcher (src/component/common/toolSearchMatch.ts). It indexes only real fields of the server projection (name, slug, description, canonical category label, category id, registered tags). No second tool list, no server call, no stored or transmitted query.
- Matching: tokens are lower-cased, stripped of combining marks and punctuation, hyphenated slugs and phrases are split. A short fixed list of plural and verb forms is normalized (images to image, resizer/resizing to resize, and so on). Filler words are ignored unless the query is only filler. Every remaining token must match a field of the same tool (AND, order independent). Rank: name 4, slug 4, tag 3, description 2, category 1 per token, plus 10 for the ordered phrase in the name or slug; ties keep registry order.
- Controls: a visible "Search" label, a short placeholder ("Search tools or tasks"), one native select "Filter by tag" (All tags plus sorted registered tags) replacing 37 tag buttons, and a stable polite atomic status region ("N tools found", "1 tool found", "No tools found. Try a different name or task."). Category badges show canonical titles from category.ts, never raw ids. Result descriptions are not line-clamped.
- Home: blank query keeps the seven category entries and the 18 catalog cards. A non-blank query replaces both with one filtered result list; clearing restores them. /discover: search and result list come first, one list only, filtered in place; the category overview follows the results.
- Tool page order: header, tool, compact "How to use", "Worked example", deeper reference and limits, "Related tools" (neutral heading for every category) and workflow links. Explanatory prose is limited to about 75ch; tool inputs and results are not.
- Supporting pages: Contact points only at controls that are actually visible; Privacy gets an "On this page" list linking the nine existing sections (scroll-mt below the fixed header). Messages: quoted UI strings, calm no-reduction compression note, "Enter HTML to extract text." for empty HTML, "1 PDF verified" / "1 image verified", and Time Arithmetic field errors with aria-invalid, aria-describedby and one live error region.
- Workflow pages link to the /guide finder ("Find another tool or workflow") instead of their own redirecting legacy /guide URL; the hub speaks of four operational workflows, not manual guides.
- One Dark: only --input-border changes (#718096 to #8392a8). Measured against the surfaces it borders: input 4.87, panel 3.79, card 4.56, card-hover 3.66, result 3.88 (all at least 3:1; the old value was 2.98 on the panel). Geometry, other palettes and the 13 appearances are untouched.

## Theme variation rule (8V closeout, 2026-10-31)

Theme ownership stays with `src/style/theme.css` (palette tokens and art-direction variables) and `src/app/global.css` (shared presentation). Themes may vary color, typography, spacing, shape, materials, decorative graphics and nonessential motion through those owners and the existing shared components. They must preserve content and control order, route and processing contracts, theme persistence, responsive usability and all required accessibility checks. Theme changes must not steal focus, clear input/results or obscure controls. Identical geometry across different artistic themes is not required. This supersedes the earlier "theme switch changes color only" rule. At 390x844 the first catalog card on Home must lie fully inside the first viewport in all 13 appearances (asserted in `test/e2e/sitewide-theme-art-direction.spec.ts`).
