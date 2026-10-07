# Module: Metadata

**Kind:** Module
**Scope:** Multi-file logical unit (2 source files)
**Group:** src/module

<!-- section-id: representative-file -->
## Representative File

`src/module/tool/metadata.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: contract -->
## Contract (added 2026-08-07 reconciliation)

Higher-level query layer wrapping `registry.ts`; consumers should prefer
these over reaching into `tool_definition_list` directly.

```typescript
function getAllTool(): ToolDefinition[]
function getToolSeoBySlug(slug: string): ToolSeo | undefined
function getAllToolSeo(): ToolSeo[]
function getAvailableCategory(): ToolCategory[]
function getToolCount(): number
function getAllTag(): string[]
function getToolByTag(tag: string): ToolDefinition[]
function getToolByPopularity(): ToolDefinition[]
```

- `getAvailableCategory()` derives which categories occur in
  `tool_definition_list`, then returns the canonical category ids from
  `category.ts` that are populated, in canonical order. A canonical category
  with no registered tool is omitted. It is not a category identity source.
- Does not duplicate registry data — every function reads
  `tool_definition_list` from `registry.ts` at call time.
- `getToolBySlug`/`getToolByCategory` are **not** exported here; they remain
  `registry.ts`-level exports (a prior version of `docs/API.md` incorrectly
  listed them under this module — corrected in this pass).
- New cross-cutting query functions belong here, not in `registry.ts`.

<!-- section-id: member-files -->
## Member Files

- `src/module/tool/metadata.test.ts` [test-companion]
- `src/module/tool/metadata.ts` [implementation] *(representative)*

<!-- section-id: inferred-role -->
## Inferred Role

- Logical unit spanning 2 source files (module).
- Representative file: src/module/tool/metadata.ts
- Merge signals: shared-name-prefix
- file-role: utility
- default-classification: utility
- Derived from multi-file merged unit "Metadata" (2 member files).

<!-- section-id: merge-context -->
## Merge Context

This logical unit was identified by the following merge signals:

- shared-name-prefix

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

## Delivery 2 derived-query contract

`getToolByIdList(id: ToolId[])` resolves ordered canonical IDs, omits unknown IDs and duplicate IDs, and returns registry definitions. Guide prose is not imported here. `getToolBreadcrumb(tool)` derives Home → populated Category → current Tool display items from the registered tool. The registry remains the sole identity source.
