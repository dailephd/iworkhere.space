# Design system

This document is the canonical authority for product visual design, styling, interaction presentation, responsive behavior, and accessibility-oriented visual rules. It combines accepted design intent with current repository architecture and behavior. Architecture and code-ownership rules remain in `docs/architecture.md`, `AGENTS.md`, and `CLAUDE.md`.

The UI/discovery revision is defined in [UI, discovery, and measured growth](plans/ui-discovery-growth-plan.md). The user approved Delivery 1 (homepage, compact navigation, Image Resizer, and current theme/material behavior) on 2026-10-03. Delivery 2 image-family rollout and search foundation is implemented and validated on the dedicated feature branch. This is not a public launch or deployment.

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

Themes define palette; components consume shared semantic visual roles. Category colors provide catalog identity. The supported IDs are exactly `system`, `light`, `dark`, and `onedark`. System selects Light or Dark only through CSS `prefers-color-scheme`, without `data-theme`. All retired/unknown stored IDs are removed and fall back to System before paint and after hydration. Civic Light and Spectrum were rejected; their historical evidence remains historical.

Light uses a dark navy header, clean white category-marked cards, a cool search surface, slate settings and preview, and mint completed output. Dark uses a deeper shell, cool slate panels, inset preview and restrained dark green results. One Dark uses its purple, blue, cyan, yellow, green and red families. Geometry, typography, spacing, navigation and processing remain theme-independent.

Shared visual-role tokens are header-bg/text/muted; nav-hover-bg/active-bg/active-text; search-bg/border; card-bg/border/hover-bg; panel-bg/border; preview-bg/border; result-bg/border; secondary-action-bg/border; footer-bg. Inputs and danger-soft have shared role tokens. Category image/text/math/time/everyday/document colors and soft tints live in the canonical theme CSS, with no independent palette registry. Small category chips and card edges carry identity; broad saturated tiles are forbidden. Primary actions use accent/contrast, secondary actions use their own surface/border, and result/error states also retain headings, metrics and actionable messages.

Theme values remain in `src/style/theme.css`, wired through Tailwind v4 in `global.css`. All text combinations target AA; focus retains its ring and contrast support. This component-color candidate remains approved for Delivery 1 by the user on 2026-10-03.

## Typography, spacing, and shape

Use one system sans-serif family for interface text and the existing monospace role for code. Establish hierarchy through size and weight, not display faces, decorative tracking, or excessive letter spacing. Keep spacing predictable and content comfortable without wasting workspace. Use consistent, slightly rounded shapes and subtle borders. Shadows separate surfaces; they do not decorate them.

Use a consistent spacing rhythm instead of dense layouts or per-tool pixel tuning. Use size and weight for title, section, body, and caption hierarchy. Keep shadows subtle in every theme. Motion is optional; use only short, purposeful hover or focus transitions that do not move layout geometry. Avoid bounce, scale effects on primary layout, giant blur halos and decorative shadows. Expressive material shadows are bounded, directional and never the sole boundary.

The shared conceptual color tokens are background, surface, surface-alt, border, text, text-muted, accent, accent-hover, accent-secondary, accent-warm, accent-cool, accent-soft, contrast, danger, success, warning, and focus-ring. Add or change a token only when the system requires it and update this contract. Keep base tokens in `src/app/global.css` and theme overrides in `src/style/theme.css`; do not put random colors in tool code.

## Application layout and scrolling

The active pilot changes navigation and Resizer allocation while preserving AppShell, the single main landmark, skip-link target and natural document flow. The Delivery 1 implementation is visually approved.

`AppShell` owns the shared page layout. Compact `VerticalNav` links are in the upper application header and do not reserve a desktop side column. The optional right advertising rail is a stable 176px at xl (1280px), hidden narrower; active top/right slots exist only with the explicit production ad flag. Main content receives the available width through a flexible track and remains capped near 1280px. The Image Resizer pilot uses a 280–320px source/settings column beside a flexible preview/result stage when space permits.

Mobile stays a single column with about 20px page padding. Compact navigation wraps. The Image Resizer stacks source, preview, settings, and result actions in a usable reading order. No drawer, hamburger, or modal navigation system is used.

The browser document owns primary vertical scrolling. Let long workspaces grow naturally. Do not trap the shell at viewport height, hide overflow at the shell, or make a middle workspace the primary independent scrollbar. Footer follows the complete workspace in normal document flow. The footer banner slot remains available but root supplies none.

## Shared controls and page composition

The image family shares only source presentation through `ImageSourcePanel`:
source heading, file input, helper/status, display-ready source information and
preview. This preserves the existing three-tool markup, tokens and layout.
Tool owners retain all state, validation, URL lifecycle, controls and results.

Extend current component and route owners. Buttons should have clear primary and secondary hierarchy, visible disabled state, and visible keyboard focus. Inputs need an accessible label, a clear border, and a strong focus indication; placeholder text is not a label. Links use the theme accent with a restrained hover state. Cards use semantic surfaces, consistent padding, and subtle separation.

Destructive button styling uses the danger token only for destructive actions. Inputs use consistent padding and restrained danger styling for errors. Reusable components keep consistent patterns; avoid one-off tool button styles, inline styles, and per-page custom CSS when existing Tailwind utilities and shared tokens express the design.

Home remains a utility-first entry point. Discover remains a utility catalog. Category pages remain concise work and navigation pages. Tool pages keep the tool workspace dominant. Do not replace existing product content with invented promotional copy, metrics, or testimonials.

The theme trigger label is exactly `Themes`, remains a compact secondary control, and has no palette icon in the trigger. Preserve the picker, all four choices, theme persistence, and existing runtime mechanism. Footer identity text is exactly:

> © 2026 iworkhere.space created by dailephd LLC

## Accessibility and motion

Keep a working skip link to `#main-content` and exactly one main landmark. Interactive controls must be keyboard accessible and have visible focus in all themes. Label inputs; use semantic headings; never convey important state by color alone. Maintain sufficient contrast, avoid unintended horizontal document scrolling, and respect reduced-motion preferences. Avoid surprise, attention-grabbing, bouncing, or layout-shifting animation.

## Performance and implementation

Assume mobile devices and slow networks. Prefer the system font stack and minimal JavaScript. Do not add animation libraries, icon packages solely for visual polish, WebGL, canvas effects, large background imagery, client-side visual frameworks, or styling frameworks. Do not turn Server Components into Client Components just to style them. Do not add a runtime dependency solely for visual modernization.

All analytics go through the existing `track()` abstraction and declared event names. Persistent state continues through the existing storage abstraction. Treat inputs as untrusted, prefer current client-side processing, and do not add dynamic execution. These implementation boundaries are governed by the architecture and retrieval-first instructions; design work does not authorize changes to them.

## Planned workspace-first pilot

Status: Delivery 1 implemented and visually approved; Delivery 2 authorized. The planner-authored [UI/discovery plan](plans/ui-discovery-growth-plan.md) owns scope, research, rollout, and search requirements. This approval gate applies only to the homepage/navigation/Resizer pilot.

The candidate changes the working composition: compact top navigation in place of the permanent left navigation rail; a functional search entry point rather than the inactive header search field; and compact image settings beside a larger preview/result stage. Mobile uses a logical stacked workspace and compact wrapping navigation, not a new drawer or modal system. Existing route identities and AppShell ownership remain.

The homepage becomes a compact launcher with one working search surface, populated categories, real linked tool cards, and a curated image-tool group. It must not become a full-screen promotional hero. Do not describe curated tools as popular without usage evidence.

Pilot values are approximately 280–320px for the desktop settings column and 28–32px for tool titles, with a flexible preview stage, the existing near-1280px content maximum, and existing semantic tokens. These are accepted local workspace targets, not new global CSS requirements. Preserve all four themes, accessible focus, error quality, actual image aspect ratios, truthful result metrics, and natural document scrolling.

Production integration supersedes placeholder restrictions: root supplies real top/right AdSense slots only when explicitly enabled. No fake footer or right banner is visible; left remains absent.

Review the homepage and Image Resizer at 1440×900 and 390×844, light and dark, including empty, selected, successful-result, and error states before rolling the pattern to the other image tools. Functional or Observer evidence is not a substitute for visual approval. The current-layout and affected component contracts describe the pilot implementation with the Delivery 1 visual direction approved.

## Change and documentation rules

Before changing a design or styling contract, update this document and then apply the decision consistently through the current owners. Architecture changes are documented in `docs/architecture.md`; project state belongs in `docs/project-status.md`; new abstractions require updating agent guidance. Use fresh source retrieval before proposing cross-cutting changes, and update affected component/module specifications. See `docs/doc_index.md` for the documentation map.

## Component-color review contract

Five visual contexts cover four choices: system-light, system-dark, light, dark, onedark. Review the focused 17-image homepage/success/error matrix. Category mapping is image cyan, text indigo/One Dark blue, math violet/purple, time amber/yellow, everyday green, document rose/red. Secondary accents do not replace status meaning. Functional evidence does not grant visual approval.

## Peer islands and expressive material pilot

Homepage Image tools and All other tools are peer SectionIsland regions: identical radius, padding, heading spacing, border and elevation. This narrow presentation-only component accepts heading, optional description and children; it owns no tool/category/search/routing logic. Existing grids and metadata remain in HomeClient. The shared island padding is the only intended homepage geometry refinement, identical across themes.

Light/Dark use opaque lightly tinted islands, solid child cards and restrained elevation, no glass blur or neomorphic shadow pair. One Dark uses purple/slate structural glass on islands, preview/result and theme popover, with 12px blur/120% saturation and high-opacity backgrounds. Cards, settings and secondary actions use restrained paired directional shadows; primary actions remain solid with visible hover/pressed treatment. Search stays solid and bordered. Header/footer/banner remain solid and quiet.

Material tokens: island-bg/border/shadow, card-shadow/hover-shadow, raised-shadow, primary-shadow, pressed-shadow, glass-filter and glass-highlight. Canonical theme CSS defines values; shared material utilities consume them. Fallbacks are opaque without backdrop-filter; prefers-reduced-transparency and forced-colors disable glass/depth. Themes never change grid, dimensions, spacing, order, DOM or breakpoints. Verify actual alpha-composited text and control boundaries, not shadow contrast. This scoped permission supersedes the earlier global glass prohibition. The user approved this Delivery 1 material direction on 2026-10-03.

## Production advertising placement

Explicit production AdSense opt-in supplies only top and right AppShell slots. Disabled ads supply no placeholder. Top reserves 100px mobile / 90px desktop without clipping or maximum height. Right track is stable 176px at xl (1280px), hidden below. Quiet Advertisement labels and neutral surfaces distinguish Google content from controls; no glass/category tint. Footer slot capability remains, with no fake root footer banner. This supersedes earlier placeholder/112px restrictions.
