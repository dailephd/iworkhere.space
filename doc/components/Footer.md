# Component: Footer

## Purpose and ownership

`src/component/layout/Footer.tsx` owns the established copyright and creator identity line in the shared shell.

## Public contract

`Footer()` accepts no props and renders exactly `© 2026 iworkhere.space created by dailephd LLC`.

## Visual and responsive role

The footer uses a quiet solid surface and compact centered secondary text. AppShell places it after the footer advertising area in normal document flow.

## Accessibility and theme interaction

Text remains readable at the secondary-body scale and uses semantic secondary or muted text tokens.

## Invariants

Do not add destinations, promotional copy, product claims, or behavior.

## Design requirements

Follow `doc/DESIGN.md` sections 11, 12, 15, 24, and 27.
