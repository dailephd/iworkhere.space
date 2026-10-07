# Component: ToolPageTemplate

**Kind:** Component

<!-- section-id: representative-file -->
## Representative File

`src/component/tool/ToolPageTemplate.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/component/tool/ToolPageTemplate.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/component/tool/ToolPageTemplate.tsx
- file-role: component
- extension: .tsx
- filename: PascalCase (ToolPageTemplate)
- path-segment: components
- Derived from single-file merged unit "ToolPageTemplate".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

## Delivery 2 server presentation contract

The shared server template renders compact truthful breadcrumbs before the title and optional guide sections after the interactive workspace. Its route supplies display-ready breadcrumb items, guide data, and resolved related tool definitions. Ancestor links use canonical public paths. Guides render in server HTML for every tool that has guide data; tools without guide data receive breadcrumbs only. No structured-data family is introduced.

### Related-tools heading

The related-tools heading is derived from the actual related tools, never from the source tool's own category. When the resolved related set is non-empty and every related tool has the same category, the heading is `Related <that category> tools` (for example the JSON Formatter, a `developer` tool, shows `Related text tools` above its two text-tool links). When the related tools span more than one category, or the set is empty, the heading is the neutral `Related tools`. The template adds no category-label registry and no per-guide heading string.
