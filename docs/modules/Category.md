# Module: Category

## Contract

`src/module/tool/category.ts` is the single runtime owner of canonical tool
category definitions. It is a static, explicit module: no reflection, no dynamic
registration, no auto-discovery.

It owns, for every category:

- `id`;
- page `title`;
- page `description`;
- canonical order (the order of the `as const` definition list).

Canonical order: `document, text, math, everyday, time, image, developer`. This
equals the pre-v0.4 observable order (registry first appearance) for the six
existing categories; `developer` is last. Reordering is a product decision
outside this module's change scope.

Exports (names fixed by the implementation and covered by tests):

- the canonical definition list (typed `as const`);
- `ToolCategory` — derived as the union of the definition `id` values and
  re-exported by `src/module/tool/type.ts`;
- `isToolCategory(value: string): value is ToolCategory`;
- a definition lookup by id.

Existing six titles/descriptions are moved verbatim from the former route-local
switches. `developer`: title "Developer Tool", description "Format, validate,
transform, and inspect developer data."

## Boundaries

- The registry (`registry.ts`) remains the authority for registered tools and
  therefore for which categories are populated. This module never lists tools.
- `getAvailableCategory()` (`metadata.ts`) intersects registry population with
  this module's order. It is not an identity source.
- The category route consumes this module and holds no category list.
- Nav, home chips and breadcrumb labels are derived from the id by
  capitalization and are not owned here.
- Category colors are theme tokens (`src/style/theme.css`, DESIGN.md).
- `category.ts` imports nothing from the registry, routes or components, so no
  runtime import cycle exists with `type.ts` (type-only re-export).

## Tests

Unique ids; non-empty title/description for every definition; exact legacy
titles/descriptions; pinned canonical order; `developer` valid, unknown invalid;
every registered tool category canonical; unpopulated canonical category omitted
from `getAvailableCategory()`.
