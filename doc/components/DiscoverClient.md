# Component: DiscoverClient

## Purpose and ownership

`src/app/discover/DiscoverClient.tsx` owns the existing discover-page query and tag filtering, category grouping, and tool-opening interaction.

## Public contract

`DiscoverClientProp` accepts `item: ToolSearchItem[]`.

## Current behavior

Filtering matches existing name, description, category, and tag data. Selecting a result navigates to `/tool/<slug>`. Categories are derived from filtered results.

## Visual and responsive role

The search/filter surface precedes a responsive one-, two-, or three-column catalog. Tool cards use the shared solid-card family and existing metadata only.

## Accessibility and theme interaction

The search input has a real label. Tag buttons expose pressed state, tool controls have visible focus, and empty results are announced with readable text. Markup is theme-independent.

## Invariants

Do not change filter semantics, tag values, grouping, result ordering, routes, or add discovery behavior.

## Design requirements

Follow `doc/DESIGN.md` sections 17, 20, and 23–25.
