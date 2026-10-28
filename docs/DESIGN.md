# Design system

## Approved homepage Colorfield adaptation — 2026-10-28

Status: APPROVED DESIGN DIRECTION; NOT YET IMPLEMENTED. This is a post-v0.4.4 homepage presentation decision, not an amendment to the released v0.4.3/v0.4.4 implementation history, a new utility release, or a change to the frozen v0.5.0/v0.6.0 catalogs. This section supersedes older homepage layout/order and restrained-category-fill preferences **for the next homepage implementation only**. Historical descriptions below remain historical. The approved direction is a colorful adaptation of the current category-based homepage, not a new website shell or a copy of the standalone prototype.

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

Status: APPROVED CORRECTION FOR THE IN-PROGRESS LOCAL COLORFIELD CANDIDATE; visual acceptance and GitHub implementation evidence are not yet established. Eight supplied screenshots show the catalog using colorful icon/name/description cards while the five featured examples and four task-guide cards continue to use plain beige/white cards and underlined links. They also show original Dark and One Dark with muddy brown/mauve heroes, purple-red category board fills that clash with neutral blue/green cards, and bright competing accents. This correction supersedes only the corresponding typography, visual-continuity and dark-homepage colors in the first Colorfield contract above. It does not undo the approved catalog-first sequence, tool descriptions, real search, theme identities, or historical plans.

**Typography contract:** Use DM Sans as the one intentional primary public-site interface typeface, including Header/Footer and all homepage elements (intro, search, category board headings, card names/descriptions, featured examples, guides). Use the existing bundled `next/font/google` integration from `src/app/layout.tsx` to self-host a variable DM Sans family with `display: "swap"`, `subsets: ["latin"]`, and one CSS variable such as `--site-font-dm-sans`; set the current `--font-sans` and any actively consumed public sans role to that font with a system fallback. No browser runtime calls to Google Fonts, no external `@import`, no second font library and no bundled font files committed manually. Keep `--font-mono` for code and technical values. Do not introduce different heading/body font families on the homepage. Main headings use 700 with roughly 1.15–1.25 line-height, cards use 600–650 with 1.35–1.45, and body descriptions use 400–500 at a comfortable ~14–16px and 1.45–1.6 line-height. Maintain actual font rendering/fallback in screenshots, not merely an unused font variable. Test after font load and fallback for clipping and layout shift.

**Continuity of the entire homepage:** After the seven colored catalog boards, render the existing five featured tasks and four practical guide links in the **same** visual language: coordinated softly colored section backdrops, the same solid card material, radius, border, icon/title alignment, type scale, readable muted descriptions, hover/focus treatment and consistent vertical rhythm. Preserve the actual verified task, outcome, limitation and guide copy. Keep one real link per task/guide card; a whole-card link is preferred over bare underlined link text for the presentation, with proper visible keyboard focus. Retain section headings and semantics and the existing data attributes and link targets. Secondary content remains subordinate to the full catalog, not a second hero or repetitive tool catalog. Avoid a sharp change from pastel category boards to generic gray/beige rectangular lists.

**Dark appearance color model:** Dark surfaces are not light pastels darkened independently. Use a neutral, palette-compatible progression of canvas → slightly lighter, softly category-tinted board → distinct elevated card; use limited chroma for background fills and let icons/chips retain recognizable but restrained category accents. Do not mix plum boards with green-gray cards and muddy brown hero treatments. Keep icon/card titles readable and category distinguishability beyond color alone. Homepage-specific CSS variables/rules must be scoped to the homepage and key off the existing `data-theme` / `data-palette` attributes; do not replace global application or dashboard palette values.

For the original palette in Dark mode, the explicit design anchors are:
- homepage canvas: `#111B28`
- neutral category-board base: `#1B2B36`
- card: `#273946`; borders: `#425565`
- primary text: `#F3F7F8`; secondary text: `#C2CFD4`
- hero: warm coral `#E7A28F` with dark foreground `#172A2E` and secondary foreground `#314347`; no brown/gray-mauve hero
- each category board: approximately 86% of the neutral board base plus 14% of that category's current registered accent color, with accessible border/foreground; keep individual cards neutral rather than fully saturated.

For One Dark, preserve its established theme identity and fixed-dark selection behavior but use a separate homepage-specific harmony:
- homepage canvas: `#232831`; neutral category-board base: `#2B303A`
- elevated card: `#363E4A`; border: `#526072`
- primary text: `#F4F5F7`; secondary text: `#C6CDD6`
- hero: the same coordinated warm coral `#E7A28F` with dark foreground `#172A2E`, instead of muted brown
- category board tint: approximately 88–90% neutral board and 10–12% category accent. No extra glass blur/neomorphic layers inside Colorfield cards.

For Mineral, Oxblood, Signal, Cobalt and Amber Dark modes, preserve each palette's underlying canvas and accent identity, but derive the same three-level homepage hierarchy from its existing `--background`, `--surface`, `--card-bg`, `--border`, `--text` and `--category-color` roles. Dark category boards receive modest (approximately 10–14%) category tint, not full-saturation paint; elevated cards must differ visibly from boards. Do not force original-specific blues across all palettes or change the palette registry.

**Quantitative and visual checks:** For each category and secondary card, normal text/background contrast must be at least 4.5:1; large text and meaningful boundaries/icons should satisfy 3:1 where applicable. Test actual computed colors, not token values alone, across original Light, original Dark, One Dark and all five other named palettes in Dark, at 1440×900 and 390×844. Review whole-page screenshots with catalog, featured tasks and guide links in the same capture. Test keyboard focus, search/no-match, no horizontal overflow, no cut-off text, proper header clearance, unchanged tool links and no visible count labels. The candidate may not report visual PASS from test status alone; inspect the screenshots and correct misaligned surface/font/card styling.

## Current site chrome — 2026-10-24

Header: one semantic `<header>` is fixed to the top of the viewport (`fixed inset-x-0 top-0 z-50`) and stays visible while the document scrolls. It holds the branding, the single primary navigation, the Search tools link and the Themes control, wraps responsively and has no show/hide control. `HeaderViewportControl` (client, `src/component/layout/`) only measures the rendered header with a `ResizeObserver`, sizes one in-flow footprint to match (so wrapped navigation never covers content) and publishes the height as `--header-height`, which `global.css` uses for `scroll-padding-top` so anchors and the skip link land clear of the header. Without JavaScript a `<noscript>` rule returns the header to ordinary flow.

Footer: one semantic `<footer>` in ordinary document flow, rendered by `AppShell` after the main content and the optional footer advertising slot. `AppShell` is a `flex min-h-screen flex-col` container whose content region grows, so a short page ends with the footer at the bottom of the viewport and a long page reaches the footer only by scrolling to the end. The footer is never fixed or sticky, has no spacer, no `--footer-clearance` variable, no viewport tracking and no software-keyboard handling. Copyright, Contact Us, Privacy Policy and the conditional Report Issues trigger remain. The links form one horizontal row on the trailing side, like the header, and wrap in order only when the width requires it, so the footer stays one line tall on desktop.

Browser tab title: each page uses its unbranded title plus the single suffix " - iworkhere" (`buildBrowserTitle` in `src/lib/seo.ts`), for example "Merge PDF Files Online - iworkhere". Descriptions, canonical URLs, robots rules and page-specific Open Graph and Twitter titles remain present. Historical: the October 24 implementation used the uniform title `iworkhere` (`BROWSER_TITLE`) on every page; v0.4.4 Batch 1 replaced it. Current primary navigation is Home, All tools, populated categories, then About.

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
