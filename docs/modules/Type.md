# Module: Type

**Kind:** Module

<!-- section-id: representative-file -->
## Representative File

`src/module/tool/type.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/module/tool/type.ts` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/module/tool/type.ts
- file-role: utility
- default-classification: utility
- Derived from single-file merged unit "Type".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Contract (v0.4.0 Batch 1)

`ToolCategory` is derived from the canonical category-definition list in
`src/module/tool/category.ts` and re-exported from `type.ts` so existing
`import type { ToolCategory } from "./type"` sites remain valid. `type.ts`
holds no category id list. `ToolId`/`ToolSlug` remain plain strings.
`ToolDefinition.category` is a `ToolCategory`.

## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.
