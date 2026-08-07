# Component: Footer

## Purpose and ownership

`src/component/layout/Footer.tsx` owns the existing copyright and client-side-processing statements in the shared shell.

## Public contract

`Footer()` accepts no props and renders only the established copy.

## Visual and responsive role

The footer uses a quiet solid surface and compact secondary text, stacking on narrow screens and aligning horizontally when space permits.

## Accessibility and theme interaction

Text remains readable at the secondary-body scale and uses semantic secondary or muted text tokens.

## Invariants

Do not add destinations, promotional copy, product claims, or behavior.

## Design requirements

Follow `doc/DESIGN.md` sections 11, 12, 15, 24, and 27.
