# Module: Category Page

## Purpose and ownership

`src/app/category/[category]/page.tsx` owns category route validation, registry-backed selection, category metadata composition, and category-page presentation.

## Public contract and behavior

The page receives asynchronous route params, accepts only existing `ToolCategory` values, uses `notFound()` for invalid categories, and preserves registry order and tool links.

## Visual and responsive role

The route uses a concise existing category heading/description and a responsive solid-card tool grid without a decorative hero.

## Accessibility and theme interaction

The page maintains one page heading, semantic list/link structure, visible focus, and semantic theme tokens.

## Invariants

Do not change category values, descriptions, metadata generation, registry queries, route behavior, tool content, or add destinations.

## Design requirements

Follow `doc/DESIGN.md` sections 17, 21, and 23–25.
