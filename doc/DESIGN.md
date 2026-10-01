# Design system

This document is the canonical authority for product visual design, styling, interaction presentation, responsive behavior, and accessibility-oriented visual rules. It combines accepted design intent with current repository architecture and behavior. Architecture and code-ownership rules remain in `doc/architecture.md`, `AGENTS.md`, and `CLAUDE.md`.

## Product direction

The interface is utility-first, modern, polished, calm, technically precise, trustworthy, efficient, and product-grade. Prefer solid semantic surfaces, restrained elevation, system sans-serif typography, and predictable spacing and shape scales. Clarity outranks cleverness; use explicit, composable UI and keep data flow visible.

Do not introduce glassmorphism, neon styling, decorative multicolor gradients, giant display typography, fake metrics, testimonials, invented marketing copy, decorative illustration systems, gamer/cyberpunk styling, or a generic SaaS landing-page appearance.

## Color and themes

Violet owns primary actions, selection, important active navigation, and emphasized product links. Cyan owns focus, informational emphasis, and limited technical highlighting. Existing semantic success, warning, and danger colors remain distinct and meaningful. Do not add a third decorative accent.

The supported theme IDs are exactly `system`, `light`, `dark`, `onedark`, `vscode-modern`, `dracula`, `amethyst-haze`, and `mercury-fog`. The registry is in `src/module/theme/themeRegistry.ts`; runtime behavior is in `src/module/theme/themeRuntime.client.ts`; persistence uses the `theme` key through `src/module/theme/themeStorage.ts`. `system` follows `prefers-color-scheme` without setting a theme attribute. Theme selection changes color only, never markup, layout, component structure, spacing, or typography.

Base tokens live in `src/app/global.css`, and theme values live in `src/style/theme.css`. Use semantic CSS variables and existing Tailwind 4 conventions; do not duplicate token engines or add theme-specific markup/layout hacks. Keep contrast readable across every theme, including muted text and active navigation.

## Typography, spacing, and shape

Use one system sans-serif family for interface text and the existing monospace role for code. Establish hierarchy through size and weight, not display faces, decorative tracking, or excessive letter spacing. Keep spacing predictable and content comfortable without wasting workspace. Use consistent, slightly rounded shapes and subtle borders. Shadows separate surfaces; they do not decorate them.

Use a consistent spacing rhythm instead of dense layouts or per-tool pixel tuning. Use size and weight for title, section, body, and caption hierarchy. Keep shadows subtle in every theme. Motion is optional; use only short, purposeful hover or focus transitions that do not move layout geometry. Avoid bounce, scale effects on primary layout, layered shadow, and large blur.

The shared conceptual color tokens are background, surface, surface-alt, border, text, text-muted, accent, accent-hover, danger, success, warning, and focus-ring. Add or change a token only when the system requires it and update this contract. Keep base tokens in `src/app/global.css` and theme overrides in `src/style/theme.css`; do not put random colors in tool code.

## Application layout and scrolling

`AppShell` owns the shared page layout. The header target is about 64px. Desktop `VerticalNav` targets 176px, with an acceptable range of roughly 168–184px. Optional advertising rails target 112px and must not exceed 120px each; the active application supplies only the right rail. The main workspace receives the remaining width through a flexible `minmax(0, 1fr)`-equivalent track. Main content is capped near 1280px; when the viewport permits, tool workspaces should generally have 800–1040px available.

Mobile stays a single column with about 20px page padding. Preserve the current navigation mechanism; do not add a drawer, hamburger, or modal navigation system.

The browser document owns primary vertical scrolling. Let long workspaces grow naturally. Do not trap the shell at viewport height, hide overflow at the shell, or make a middle workspace the primary independent scrollbar. Footer advertising and Footer follow the complete workspace in normal document flow.

## Shared controls and page composition

The image family shares only source presentation through `ImageSourcePanel`:
source heading, file input, helper/status, display-ready source information and
preview. This preserves the existing three-tool markup, tokens and layout.
Tool owners retain all state, validation, URL lifecycle, controls and results.

Extend current component and route owners. Buttons should have clear primary and secondary hierarchy, visible disabled state, and visible keyboard focus. Inputs need an accessible label, a clear border, and a strong focus indication; placeholder text is not a label. Links use the primary violet with a restrained hover state. Cards use semantic surfaces, consistent padding, and subtle separation.

Destructive button styling uses the danger token only for destructive actions. Inputs use consistent padding and restrained danger styling for errors. Reusable components keep consistent patterns; avoid one-off tool button styles, inline styles, and per-page custom CSS when existing Tailwind utilities and shared tokens express the design.

Home remains a utility-first entry point. Discover remains a utility catalog. Category pages remain concise work and navigation pages. Tool pages keep the tool workspace dominant. Do not replace existing product content with invented promotional copy, metrics, or testimonials.

The theme trigger label is exactly `Themes`, remains a compact secondary control, and has no palette icon in the trigger. Preserve the picker, all eight choices, theme persistence, and existing runtime mechanism. Footer identity text is exactly:

> © 2026 iworkhere.space created by dailephd LLC

## Accessibility and motion

Keep a working skip link to `#main-content` and exactly one main landmark. Interactive controls must be keyboard accessible and have visible focus in all themes. Label inputs; use semantic headings; never convey important state by color alone. Maintain sufficient contrast, avoid unintended horizontal document scrolling, and respect reduced-motion preferences. Avoid surprise, attention-grabbing, bouncing, or layout-shifting animation.

## Performance and implementation

Assume mobile devices and slow networks. Prefer the system font stack and minimal JavaScript. Do not add animation libraries, icon packages solely for visual polish, WebGL, canvas effects, large background imagery, client-side visual frameworks, or styling frameworks. Do not turn Server Components into Client Components just to style them. Do not add a runtime dependency solely for visual modernization.

All analytics go through the existing `track()` abstraction and declared event names. Persistent state continues through the existing storage abstraction. Treat inputs as untrusted, prefer current client-side processing, and do not add dynamic execution. These implementation boundaries are governed by the architecture and retrieval-first instructions; design work does not authorize changes to them.

## Change and documentation rules

Before changing a design or styling contract, update this document and then apply the decision consistently through the current owners. Architecture changes are documented in `doc/architecture.md`; project state belongs in `doc/project-status.md`; new abstractions require updating agent guidance. Use fresh source retrieval before proposing cross-cutting changes, and update affected component/module specifications. See `doc/doc_index.md` for the documentation map.
