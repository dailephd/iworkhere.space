# Component: AppShell

## Purpose and ownership

`src/component/layout/AppShell.tsx` owns the shared application frame, the single main landmark, desktop navigation placement, banner slots, scrolling region, header, and footer composition.

## Public contract

`AppShellProps` accepts `children`, optional `NavItem[]`, and optional header, footer, left, and right banner slots. It does not own route data or banner content.

## Current behavior

The shell uses a fixed viewport frame with an independently scrolling main region. `VerticalNav` appears at the existing desktop breakpoint; optional banner slots preserve their positions.

## Visual and responsive role

The shell uses solid semantic surfaces, a 64px header, a 224–240px desktop navigation zone, and a centered main content container no wider than 1280px. Mobile remains single-column with 20px edge padding and does not introduce a new navigation mechanism.

## Accessibility and theme interaction

The shell provides a keyboard-visible skip link to `#main-content`, exactly one `<main>` landmark, and theme-independent markup. Focus, surfaces, borders, and text use semantic tokens from `doc/DESIGN.md`.

## Invariants

Slot ownership, scrolling behavior, navigation ownership, routes, banner semantics, and child rendering must not change. No parallel layout or navigation system may be introduced.

## Design requirements

Follow `doc/DESIGN.md` sections 15, 16, 24, 25, 28, and 30.
