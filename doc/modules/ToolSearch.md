# Module: ToolSearch

## Purpose and ownership

`src/component/common/ToolSearch.tsx` owns reusable client-side tool filtering and compact catalog presentation.

## Public contract

`ToolSearchItem` contains `slug`, `name`, `description`, `category`, and optional `tag`. `ToolSearchProps` contains `item`, `onOpen`, and optional `emptyLabel`.

## Current behavior

Search is case-insensitive across name, description, and category. Results preserve input order and delegate opening to `onOpen`.

## Visual and responsive role

The labeled search field precedes a responsive tool-card grid. Cards prioritize name, purpose, and category using the shared solid-card family.

## Accessibility and theme interaction

Input labeling, keyboard-operable result buttons, visible focus, and a readable empty state are required. Theme changes use semantic tokens only.

## Invariants

Do not change matching, ordering, item contracts, or opening behavior.

## Design requirements

Follow `doc/DESIGN.md` sections 17, 19, 23–25, and 28.
