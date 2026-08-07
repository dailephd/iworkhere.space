# Component: HomeClient

## Purpose and ownership

`src/app/HomeClient.tsx` owns the homepage client-side tool-opening interaction and composes the shared `ToolSearch` catalog.

## Public contract

`HomeClientProps` accepts `toolItem: ToolSearchItem[]` and optional `children`.

## Current behavior

Selecting a tool navigates to `/tool/<slug>` through the existing router. Children render after the catalog.

## Visual and responsive role

The component spaces the shared discovery surface and supporting content within the homepage hierarchy. Tool-card responsiveness belongs to `ToolSearch`.

## Accessibility and theme interaction

It introduces no alternate interaction or theme markup and relies on accessible shared controls.

## Invariants

Do not change routing, tool data, ordering, search behavior, or child behavior.

## Design requirements

Follow `doc/DESIGN.md` sections 17, 19, 24, and 25.
