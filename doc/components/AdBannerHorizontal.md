# Component: AdBannerHorizontal

## Purpose and ownership

`src/component/layout/AdBannerHorizontal.tsx` owns horizontal advertising-slot presentation without implementing an advertising provider.

## Public contract

Props are `label`, optional `children`, and optional `isPlaceholder`. Placeholder mode renders explicit reserved-space copy; otherwise children render unchanged.

## Visual, responsive, accessibility, and theme role

The slot is a low-priority solid bordered panel with a 14px radius and reserved horizontal height. Its `<aside>` keeps the supplied accessible label and uses semantic tokens in every theme. The footer slot follows the complete main workspace in normal document flow and is never fixed or sticky.

## Invariants

Do not fetch ads, masquerade as content, add provider behavior, or compete visually with tools.

## Design requirements

Follow `doc/DESIGN.md` sections 14, 17, 24, 25, and 30.
