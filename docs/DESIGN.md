# Design system

Slugify uses a visible Text label explicitly associated with `slugify-input`. Its input follows existing semantic input tokens, full-width responsive sizing and a visible keyboard focus outline. This applies the existing form convention without adding tokens or changing the page template.

This document is the canonical authority for product visual design, styling, interaction presentation, responsive behavior, and accessibility-oriented visual rules. It combines accepted design intent with current repository architecture and behavior. Architecture and code-ownership rules remain in `docs/architecture.md`, `AGENTS.md`, and `CLAUDE.md`.

The UI/discovery revision is defined in [UI, discovery, and measured growth](plans/ui-discovery-growth-plan.md). The user approved Delivery 1 (homepage, compact navigation, Image Resizer, and current theme/material behavior) on 2026-10-03. Delivery 2 image-family rollout and search foundation was implemented, validated, merged, and publicly deployed on 2026-10-04. The visual/layout acceptance remains recorded in the plan and launch evidence; no new design-system scope was added.

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
Policy and footer links are underlined with visible semantic focus rings.
The existing footer keeps its copyright and wraps the Privacy Policy link
onto a separate line on small screens. No new palette or material is introduced.

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


## v0.4.2 viewport chrome and reporting — 2026-10-14

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

## Planned v0.4.3 task-first discovery and evidence presentation — 2026-10-18

Status: PLANNED, NOT IMPLEMENTED. The published v0.4.2 homepage and tool pages remain the implemented design until a separately authorized v0.4.3 release. The new version builds on rather than replaces current UI, and must preserve the released v0.4.2 viewport chrome and reporting controls.

The homepage introduces practical tasks with honest, outcome-focused entry points to five *existing* file-processing utilities; it retains all registry-based category browsing, search and registered tool links. These are editorially chosen examples, never labeled as popularity or personalized recommendations without measured evidence. Category pages have genuinely different explanations grounded in present registered tools; minimal/one-tool categories do not receive repeated keyword filler.

A shared ToolExamplePanel shows original verified inputs/outputs, reproduction steps, measured relevant results, limitations and links to the functioning tool. Preserve original aspect ratios, contrast, mobile geometry, semantic captions/alt text, source-download choice and accessible keyboard order. No autoplay, surprise download, fake before/after effect, external embed, chart claiming nonexistent analytics, new file-processing runtime or copied third-party assets. The normal tool UI remains the primary interaction; the example is explanatory, not a replacement.

About/Contact present operator-approved identity and support channels. Do not invent personal contact details, a tracking form or a second reporting backend. New routes must preserve title/meta, keyboard navigation and responsive layout; links and sitemap/robots behavior must be verified. No changes to existing palette tokens or independent scroll owners. Ad slots stay subject to F-02 eligibility, including privacy/error-page exclusions. Full page/content acceptance belongs to the [v0.4.3 plan](plans/v0.4.3-implementation-plan.md).

Planned v0.4.3 footer navigation (NOT IMPLEMENTED in v0.4.2): keep the existing single fixed, retractable footer, exact copyright line, and separate Hide/Show footer toggle. In the expanded footer, group the three actions in **vertical DOM/visual order**: `Contact Us` (link to `/contact`), `Report Issues` (visible text of the existing support button only when support is enabled), and `Privacy Policy` (link to `/privacy`). This compact group aligns on the trailing side at desktop widths and wraps/stacks safely on mobile. Do not build a conventional oversized multi-column footer. Remove the current always-on underline from **Privacy Policy** only, while retaining semantic link and visible keyboard focus; Contact Us should use the same quiet link treatment. The report trigger's full accessible name remains `Report a problem or suggestion`, and its collapsed visible text remains `Report`. With support disabled, omit the report row rather than show a dead action; the expanded group then contains Contact Us and Privacy Policy. In collapsed mode keep Contact Us, Privacy Policy and copyright hidden and the same report (when available) and Show footer controls visible; do not expand the compact tab or change persistence. The non-JavaScript flow keeps the usable contact/privacy anchors in the ordinary-flow footer. Re-measure footer height/clearance and verify last-action visibility, short/mobile viewports, on-screen keyboard, modal focus, document-end settling, and both flag states. This is a planned UI change, not a retroactive claim about the released v0.4.2 footer.
