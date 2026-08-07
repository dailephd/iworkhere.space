# STYLE

This document defines the styling rules of the project.
All UI code must comply.

If any instruction conflicts with ARCHITECTURE or other repo docs, STOP and ask.

## Goal

- Pretty, modern, calm
- High clarity, low visual noise
- Consistent across tool, page, and component
- Fast on mobile and slow network

Avoid decoration-first UI. Prefer utility-first UI.

## Theme

The app must support a Light theme and a Dark theme, with a user toggle.

**Implementation note (2026-08-07 reconciliation):** the shipped theme system
(`src/module/theme/themeRegistry.ts`) already exposes eight selectable
`ThemeId` values — `system`, `light`, `dark`, `onedark`, `vscode-modern`,
`dracula`, `amethyst-haze`, `mercury-fog` — not just Light/Dark. The rules
below (single accent hue, color-only switching, persistence) still govern
every theme, including the six added beyond Light/Dark. This section
describes the original two-theme policy; it has not been rewritten into a
full per-theme token specification because no such specification exists yet
in any tracked document — that is a documentation gap, not an implementation
gap. See `doc/architecture.md` "Theme module" for the current module
structure.

Rules:
- Theme switch changes color only, not layout
- No theme-specific layout hacks
- Use the same spacing, typography, and component shape across all themes
- Theme choice must persist for the user (local storage is fine)
- Default theme is `"system"`, which follows OS preference via
  `prefers-color-scheme` (no `data-theme` attribute set)

## Color

Use a small, predictable set of tokens. Do not invent new color names.

Token set (conceptual):
- background
- surface
- surfaceAlt
- border
- text
- textMuted
- accent
- accentHover
- danger
- success
- warning

Light theme intent:
- background: near white, not pure white
- surface: slightly elevated neutral
- border: subtle neutral
- text: near black, not pure black
- accent: single accent only

Dark theme intent:
- background: near black, not pure black
- surface: elevated dark neutral
- border: subtle dark neutral
- text: near white, not pure white
- accent: same accent hue as Light theme

Hard rule:
- One accent hue only
- No rainbow palettes
- No decorative gradients
- No neon glow
- Avoid heavy shadow

## Type

- One font family for all UI
- Prefer system font stack for speed and consistency
- Use weight and size for hierarchy, not font family changes

Type scale intent:
- Title: larger, semibold
- Section: medium, semibold
- Body: normal, regular
- Caption: small, muted

Do not:
- Mix font families
- Use display fonts
- Use excessive letter spacing

## Space

Use a consistent spacing rhythm across the app.

Rules:
- Prefer simple vertical flow
- Use generous padding in card and section
- Avoid dense layouts
- Avoid pixel-perfect micromanagement per tool

## Shape

- Use a consistent radius across components
- Default shape is calm and slightly rounded
- Do not vary radius per component unless it is a deliberate system choice

## Shadow

- Subtle only
- Shadow is for separation, not decoration
- Dark theme shadow must remain subtle

Avoid:
- Large blur shadow
- Multiple layered shadow

## Motion

Motion is optional.

Rules:
- No attention-grab motion
- No bounce
- No scale-on-hover for primary layout
- Use short, subtle transition for hover and focus only

If motion is added:
- It must have a clear purpose
- It must not change layout geometry

## Accessibility

Mandatory:
- Keyboard navigation must work
- Focus ring must be visible in Light and Dark
- Contrast must remain readable in both themes
- Inputs must have label or aria-label

Avoid:
- Placeholder as label
- Low-contrast textMuted for critical info

## Component rule

All reusable UI must follow a consistent pattern.

Button:
- Primary uses accent
- Secondary uses surface and border
- Destructive uses danger only when semantically required
- Disabled state must be obvious and non-interactive

Input:
- Clear border
- Strong focus ring
- Consistent padding
- Error state uses danger with restraint

Card:
- Surface background
- Subtle border
- Optional subtle shadow
- Consistent padding

Link:
- Use accent color
- Hover state is subtle

## Implementation rule

- Use Tailwind class for styling
- Avoid inline style
- Avoid per-page custom CSS
- Shared tokens live in global.css as CSS variable
- Do not create new styling system

Theme method:
- Use CSS variable for color token
- Switch theme by toggling a single attribute or class at root

Do not:
- Use different component markup for Light and Dark
- Override random colors inside tool code

## Do not list

Do not introduce:
- New color token without updating this file
- New accent hue
- Decorative gradient background
- Surprise animation
- Inconsistent spacing pattern
- One-off button style inside a tool

## Change rule

Any change to style system must:
- Update this document first
- Apply consistently across the app
