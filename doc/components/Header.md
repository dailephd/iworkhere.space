# Component: Header

## Purpose and ownership

`src/component/layout/Header.tsx` owns the shared product identity row, existing search control presentation, and `ThemeToggle` placement.

## Public contract

`Header()` accepts no props and renders the existing home link, search control, and theme picker.

## Current behavior

The product name links to `/`; the search field remains presentation-only; theme selection is delegated to `ThemeToggle`.

## Visual and responsive role

The header targets 64px height with restrained solid chrome. It preserves compact mobile density and only shows the existing search control where current responsive behavior allows.

## Accessibility and theme interaction

The search control has an associated programmatic label, the home link and picker have visible focus states, and all color comes from semantic tokens.

## Invariants

Do not add search behavior, navigation destinations, providers, storage access, or a mobile navigation mechanism.

## Design requirements

Follow `doc/DESIGN.md` sections 15–17, 24, 25, and 27.
