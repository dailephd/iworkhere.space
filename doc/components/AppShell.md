# Component: AppShell

## Purpose and ownership

`src/component/layout/AppShell.tsx` owns the shared application frame, the single main landmark, desktop navigation placement, banner slots, document-flow composition, header, and footer composition.

## Public contract

`AppShellProps` accepts `children`, optional `NavItem[]`, and optional header, footer, left, and right banner slots. It does not own route data or banner content.

## Current behavior

The shell grows from a `100dvh` minimum height and leaves primary vertical scrolling to the browser document. `VerticalNav` appears at the existing desktop breakpoint; optional banner slots preserve their positions, with the footer banner and Footer following the complete main region in normal flow.

## Visual and responsive role

The shell uses solid semantic surfaces, a 64px header, a 176px desktop navigation column, 112px desktop advertising columns, and a fluid `minmax(0, 1fr)` main column whose content remains no wider than 1280px. Navigation may range only from 168–184px and advertising columns never exceed 120px. Mobile remains single-column with 20px edge padding and does not introduce a new navigation mechanism.

## Accessibility and theme interaction

The shell provides a keyboard-visible skip link to `#main-content`, exactly one `<main>` landmark, and theme-independent markup. Focus, surfaces, borders, and text use semantic tokens from `doc/DESIGN.md`.

## Invariants

Slot ownership, navigation ownership, routes, banner semantics, and child rendering must not change. The main region must not become an independent page-level scroll container, and Footer or footer advertising must not be fixed or sticky. No parallel layout or navigation system may be introduced.

## Design requirements

Follow `doc/DESIGN.md` sections 15, 16, 24, 25, 28, and 30.
