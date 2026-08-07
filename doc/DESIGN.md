# iworkhere.space Design System

## 1. Purpose and authority

This document is the single canonical authority for product design, visual styling, interaction presentation, responsive behavior, and accessibility at iworkhere.space. It supersedes the former split design and styling authorities. Architecture and data contracts remain governed by their own canonical documents. A visual implementation that conflicts with this document must be corrected here before code changes continue.

## 2. Product identity

iworkhere.space is a browser-based utility-tool product. It should feel fast, trustworthy, practical, polished, and useful rather than promotional. The product helps people reach and operate small focused tools with minimal delay.

## 3. Design intent

The interface prioritizes direct access to tools, clear input and output states, consistent navigation, and quiet confidence. Visual polish comes from disciplined tokens, typography, spacing, and component consistency rather than decoration.

## 4. Required visual impression

The product must feel modern, polished, premium, calm, technically precise, trustworthy, efficient, and product-grade.

## 5. Forbidden visual impression

The product must not resemble a generic SaaS landing page, startup marketing template, developer demo, student project, cyberpunk or gamer interface, playful cartoon, visually noisy dashboard, excessively sparse shell, or overly corporate portal. Glassmorphism, neon, decorative multi-color gradients, giant display typography, fake metrics, testimonials, and invented promotional content are forbidden.

## 6. Engineering design principles

- Clarity over cleverness; explicit over implicit; readability over brevity.
- Composition over abstraction and separation of concerns.
- Prefer straight-line logic, named types, minimal indirection, and predictable UI.
- Avoid meta-programming, auto-discovery, speculative abstractions, and unnecessary dependencies.
- Assume mobile devices and slow networks. Keep JavaScript minimal and preserve Server Components.
- Accessibility is the default, not a later enhancement.

## 7. Application structural constraints relevant to UI

`src/app` owns route composition, `src/component` owns reusable presentation, `src/module` owns domain behavior and tools, and `src/lib` owns non-UI helpers. `AppShell` retains the shared layout and slot model. Pages remain Server Components unless existing behavior requires a client owner. Visual work must not duplicate routing, tool, navigation, theme, storage, analytics, logging, or observability systems.

## 8. Core visual system

The visual system uses solid semantic surfaces, controlled violet and cyan accents, visible neutral borders, restrained elevation, a system sans-serif stack, and a fixed spacing and shape scale. Theme changes affect color only. Component structure, spacing, typography, layout, and interaction remain shared.

## 9. Theme model

The canonical `ThemeId` values remain `system`, `light`, `dark`, `onedark`, `vscode-modern`, `dracula`, `amethyst-haze`, and `mercury-fog`. `system` retains operating-system preference behavior. Light and dark define the default brand identity. The six named presets retain their existing color identities while adopting the shared component and layout system. Themes must not change markup or layout.

## 10. Semantic color tokens

### Canonical light

- Background `#EDEFF3`; surface `#F5F6F8`; card `#F1F3F6`; elevated `#FAFAFB`.
- Primary text `#111827`; secondary text `#4B5563`; muted text `#6B7280`; border `#D1D5DB`.
- Primary violet `#7C3AED`; hover `#6D28D9`; active `#5B21B6`.
- Secondary cyan `#087F9A`; hover `#0E7490`; focus `#0891B2`.

### Canonical dark

- Background `#1A1D23`; surface `#20242C`; card `#262B35`; elevated `#2D3340`.
- Primary text `#F3F4F6`; secondary text `#CBD5E1`; muted text `#94A3B8`; border `#3A4150`.
- Primary violet `#A78BFA`; hover `#C4B5FD`; active `#8B5CF6`.
- Secondary cyan `#22D3EE`; hover `#67E8F9`; focus `#22D3EE`.

Violet owns primary actions, selected states, important active navigation, and emphasized product links. Cyan owns focus, informational emphasis, and limited technical highlights. They are not interchangeable. Existing success, warning, and danger values remain unless contrast requires an explicit documented correction. No third decorative accent is allowed.

## 11. Typography

Use one existing system sans-serif stack and no downloaded web font. Page titles are 32/40px on mobile and 40/48px on desktop at semibold or bold weight. Section headings are 28/36px semibold; subsection and card headings 20/28px semibold; body 16/24px; secondary body 14/20px; labels and metadata 12/16px medium or semibold. Readable prose should generally remain within 72 characters per line. Do not use giant headlines, display fonts, excessive uppercase, excessive tracking, or tiny body text.

## 12. Spacing

Use only the shared scale when practical: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, and 96px. Page horizontal padding is 20px mobile, 32px small/tablet, and 40px desktop. Main content is at most 1280px wide. Normal section gaps are 48px mobile and 64px desktop. Cards use 20px mobile and 24px desktop padding. Form fields use 16px vertical gaps; compact metadata uses 8px gaps.

## 13. Shape and borders

Controls use 10px radii, normal cards and panels 14px, and large feature surfaces 18px. Pills are limited to compact status, category/tag metadata, and established toggles. Default borders are one pixel using the semantic border token. Normal buttons are rounded rectangles, not pills.

## 14. Elevation and shadows

Cards use solid backgrounds, subtle visible borders, and restrained shadows. Light normal shadow: `0 1px 2px rgba(17, 24, 39, 0.04), 0 8px 24px rgba(17, 24, 39, 0.06)`. Dark normal shadow: `0 1px 2px rgba(0, 0, 0, 0.24), 0 8px 24px rgba(0, 0, 0, 0.18)`. Giant blur, decorative shadow stacks, glow, and normal-surface backdrop blur are forbidden.

## 15. Layout system

`AppShell` remains the layout owner. The header targets 64px height. Desktop keeps the existing vertical navigation at approximately 224–240px and gives remaining space to the main region. Main content is centered within 1280px. Mobile remains single-column with 20px safe edge padding and preserves current navigation behavior. Major layout must not depend on transforms, fragile absolute positioning, or fixed card widths that create horizontal scrolling.

## 16. Navigation

Navigation is visually clear but subordinate to tools. `VerticalNav` remains the desktop navigation owner and uses existing route data and active-state behavior. Do not introduce a drawer, modal, hamburger, destination, or parallel navigation model. Active navigation uses primary emphasis; links retain visible hover and focus states.

## 17. Shared component rules

### Buttons

Primary buttons use violet with high-contrast text, a 40–44px height, 10px radius, and medium or semibold label. Secondary buttons use a solid surface and border. Ghost buttons are transparent and low emphasis. Destructive buttons use the existing danger semantic only for destructive actions. Buttons never scale.

### Inputs

Inputs use a solid surface, semantic border, 10px radius, high-contrast text, restrained placeholders, and a comfortable minimum 44px height. A real visible or programmatic label is required. Focus uses a cyan 3px ring or visual equivalent.

### Cards

Cards share solid card tokens, 14px radius, subtle border and shadow, and 20–24px padding. Interactive cards may translate upward by at most 2px and must not scale.

### Links

Links are recognizable, use semantic emphasis, and provide visible hover and focus states. Navigation and card links retain meaningful accessible names.

### Tool cards

Tool cards prioritize tool name, concise purpose, existing category or metadata, and existing navigation behavior. Decorative illustration, oversized iconography, glass, and gradient-filled bodies are not allowed.

### Status and metadata labels

Labels use the 12/16px scale and may use pill shape only when compact. State must not rely on color alone.

### Empty, loading, and error states

States use a solid bounded surface, clear heading or message, and an action only when an existing recovery path exists. They remain concise and accessible.

### Ad placeholders

Advertising placeholders stay low priority, reserve clear layout space, and identify themselves as placeholders. They must not resemble real advertising or compete with tools.

## 18. Tool-workspace design

The workspace is a solid elevated surface with a clear boundary, useful maximum width, and 20–24px padding. Inputs, actions, and results are grouped clearly. Outputs remain visually primary. Decorative workspace backgrounds and per-tool visual systems are forbidden. Calculation, parsing, validation, URL state, storage, observability, and error behavior must not change.

## 19. Homepage design

The homepage is utility-first: a compact introduction, an existing discovery action, current useful tool/category content, and existing supporting sections. It must immediately communicate useful browser-based tools and quick access. No full-screen hero, giant headline, fake metric, testimonial, or invented marketing claim is permitted. A subtle static introductory atmosphere may be used without reducing contrast.

## 20. Discover-page design

The discover page is a polished utility catalog. Its hierarchy is title/context, existing search and filters, tool results, then category/metadata context. It uses a clean search surface, responsive tool-card grid, and strong no-result state without adding ranking, filtering, or discovery behavior.

## 21. Category-page design

Category pages use a concise header, only existing descriptive content, and a responsive tool grid. They are navigation/work pages, not decorative marketing pages.

## 22. Tool-page design

Tool identity and existing description precede the workspace; existing secondary content follows. The workspace dominates the page. The route, SEO, registry, lifecycle, query state, analytics, error, and persistence contracts remain unchanged.

## 23. Motion and interaction

The default transition duration is 180ms and applies only to color, background, border, shadow, and small hover movement. Interactive cards may use `translateY(-2px)` maximum. No scale, bounce, spring, floating, parallax, cursor, particle, continuous, or page-geometry animation is allowed.

## 24. Responsive design

Use existing Tailwind breakpoints. Tool/card grids are one column on narrow mobile, two where space permits, and three on large desktop only when readable. Every main surface must work at narrow mobile, mobile, tablet, laptop, desktop, and large desktop without unintended horizontal page scrolling.

## 25. Accessibility

Interactive elements must be keyboard accessible and semantic. Inputs require labels. Focus is clearly visible. Contrast must be sufficient, state cannot rely on color alone, headings must be meaningful, and information cannot be hover-only. `AppShell` provides a skip link targeting `#main-content` and exactly one main landmark. Reduced-motion preferences remove hover translation, non-essential transitions, and animated scrolling.

## 26. Performance constraints

Do not add visual dependencies, animation libraries, icon packages, WebGL, canvas effects, large background images, or client-side visual frameworks. Prefer CSS, Tailwind, semantic variables, existing React components, and static pseudo-elements. Do not convert Server Components merely for styling.

## 27. Content and copy style

Copy is concise, practical, and accurate. Prefer action-specific labels and plain language. Preserve current product content unless correction is required for clarity or accessibility. Do not invent destinations, tools, data, promotional claims, testimonials, statistics, or supporting content for visual balance.

## 28. Theme implementation rules

`ThemeRegistry`, `ThemeStorage`, `ThemeRuntime`, `ThemeProvider`, and `ThemeToggle` remain authoritative. Theme IDs and the `theme` persistence key do not change. Semantic variables are refactored in the existing token files rather than duplicated. Alternate presets retain their existing palette identity and inherit new shared brand variables when they do not explicitly own them. Theme-specific markup, layout, or component structure is forbidden.

## 29. Tailwind and CSS implementation rules

Use Tailwind CSS 4 and semantic CSS variables. Reusable component classes or components are preferred over inconsistent one-off class lists. Avoid inline styles except existing runtime necessity. Do not hardcode light/dark colors in tool components when a semantic token exists. Do not add a styling system, breakpoint system, arbitrary physical units, or theme-specific markup.

## 30. Architecture-adjacent UI constraints

Analytics must use the established abstraction; UI and tools do not import providers. Persistence must use `src/lib/storage.ts` and never add a direct `localStorage` path. Observability must use the facade. Theme code must use the established registry/storage/runtime path. Visual work cannot alter tool registration, metadata semantics, routing, API behavior, service-worker behavior, or SEO ownership.

## 31. AI and coding-agent UI rules

Read the owning source and specification before editing. Complete a stub specification before materially changing its unit. Reuse established owners and semantic tokens. Do not invent behavior or content, create parallel systems, change business logic, or broaden the roadmap. Update this document before changing the visual contract.

## 32. Design review checklist

- The interface is utility-first, solid-surface, calm, and product-grade.
- Light is soft grey; dark is charcoal; primary emphasis is violet; cyan is reserved for focus/system use.
- Typography, spacing, radii, borders, elevation, and motion follow this contract.
- Tool workspaces dominate tool pages; cards and controls share one family resemblance.
- All eight themes, existing routes, tools, storage, observability, SEO, and behavior remain intact.
- Focus, labels, keyboard use, heading hierarchy, reduced motion, responsive flow, and overflow are verified.
- No glass, decorative gradient, new dependency, new feature, invented content, or parallel architecture is present.

## 33. Change-control rule

Any change to the visual system must update this document first, identify affected component/module specifications, preserve architecture and behavior contracts, and pass typecheck, tests, build, diff checks, and proportionate visual/accessibility review. Product roadmap decisions remain outside this document.
