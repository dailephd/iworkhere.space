# Component: VerticalNav

## Purpose and ownership

`src/component/layout/VerticalNav.tsx` owns rendering and active-state presentation for supplied `NavItem` values.

## Public contract

`VerticalNav` receives `item: NavItem[]` and `ariaLabel: string`. Items with usable `href` values render as Next.js links; disabled or non-route items render as non-interactive spans.

## Current behavior

`usePathname()` determines active state. Home matches exactly and other routes match by prefix.

## Visual and responsive role

The component is the existing desktop navigation owner within AppShell's canonical 97px column. Labels remain readable, item hit targets remain at least 40–44px high, and items use solid semantic states, 10px control radii, restrained horizontal spacing, and no decorative motion.

## Accessibility and theme interaction

The navigation retains its accessible label, `aria-current="page"`, disabled semantics, and cyan focus treatment. Theme changes affect tokens only.

## Invariants

Do not change route matching, item data, link behavior, disabled behavior, or introduce another navigation architecture.

## Design requirements

Follow `doc/DESIGN.md` sections 15, 16, 23–25, and 28.
