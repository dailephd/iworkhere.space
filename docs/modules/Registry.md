# Module: Registry

**Kind:** Module
**Scope:** Multi-file logical unit (2 source files)
**Group:** src/module

<!-- section-id: representative-file -->
## Representative File

`src/module/tool/registry.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: contract -->
## Contract (added 2026-08-07 reconciliation)

The single source of truth for tool data — `tool_definition_list`, an array
of `ToolDefinition` (`src/module/tool/type.ts`). Batch 5 registers ten
tools: `slugify`, `calculator`, `length-converter`, `html-text-extractor`,
`weight-converter`, `time-arithmetic`, `image-resizer`, `image-compressor`, `image-converter`, `heic-converter`.
There are four image tools. The dedicated HEIC worker contract and separate release-license gate are specified in `HeicConverter.md`.

The preceding ten-tool count records the historical image Batch 5 baseline.
Current v0.3 feature-branch implementation adds `merge-pdf`, `split-pdf`,
`images-to-pdf`, `pdf-to-image` and `compress-pdf`, all in `document`, bringing
the registry to 15 tools and six populated categories. The v0.4.0 candidate
adds `json-formatter` in the canonical `developer` category, `word-character-
counter` in `text` and `qr-code-generator` in `everyday`, for 18 tools and
seven populated categories; the registry remains the authority on population
while `category.ts` owns category definitions. Each has explicit
component, SEO metadata, client-only/offline capability, no persistent state
and no shareable query. Implementation does not imply release or deployment.

```typescript
function getToolBySlug(slug: string): ToolDefinition | undefined
function getToolByCategory(category: string): ToolDefinition[]
```

- `ToolDefinition` fields (see `docs/SCHEMA.md` §2 for the corrected table):
  `id`, `slug`, `name`, `description`, `category`, `seo`, `capability`
  (singular), optional `tag`, optional `popularity`, optional `statePolicy`,
  `Component` (capital `C`).
- Every tool is explicitly imported and listed — no dynamic/reflection-based
  registration.
- `getToolByCategory`/`getToolBySlug` are used directly by route handlers
  (`app/tool/[slug]/page.tsx`, `app/category/[category]/page.tsx`); broader
  queries (tags, popularity, SEO listing) go through `metadata.ts`
  (`docs/modules/Metadata.md`), which wraps this module and must not duplicate
  its data.

<!-- section-id: member-files -->
## Member Files

- `src/module/tool/registry.test.ts` [test-companion]
- `src/module/tool/registry.ts` [implementation] *(representative)*

<!-- section-id: inferred-role -->
## Inferred Role

- Logical unit spanning 2 source files (module).
- Representative file: src/module/tool/registry.ts
- Merge signals: shared-name-prefix
- file-role: utility
- default-classification: utility
- Derived from multi-file merged unit "Registry" (2 member files).

<!-- section-id: merge-context -->
## Merge Context

This logical unit was identified by the following merge signals:

- shared-name-prefix

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.
