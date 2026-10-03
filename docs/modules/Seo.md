# Module: Seo

**Kind:** Module
**Scope:** Multi-file logical unit (2 source files)
**Group:** src/lib

<!-- section-id: representative-file -->
## Representative File

`src/lib/seo.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: contract -->
## Contract (added 2026-08-07 reconciliation)

```typescript
function buildToolMetadata(seo: { title, description, canonicalPath }): Metadata
function buildCategoryMetadata(slug: string, title: string, description: string): Metadata
```

- Both functions build a Next.js `Metadata` object: `title` suffixed with
  " — iworkhere.space", `description`, `alternates.canonical` (absolute URL
  under `https://iworkhere.space`), and an `openGraph` block
  (`title`/`description`/`url`/`siteName`/`type: "website"`).
- `buildToolMetadata` takes a `ToolSeo`-shaped object and resolves its
  canonical URL from `canonicalPath` (e.g. `/tool/slugify`).
- `buildCategoryMetadata` resolves its canonical URL as
  `/category/<slug>`, independent of the registry.
- No hardcoded SEO belongs in page files — tool and category pages must call
  these via `generateMetadata`.

<!-- section-id: member-files -->
## Member Files

- `src/lib/seo.test.ts` [test-companion]
- `src/lib/seo.ts` [implementation] *(representative)*

<!-- section-id: inferred-role -->
## Inferred Role

- Logical unit spanning 2 source files (module).
- Representative file: src/lib/seo.ts
- Merge signals: shared-name-prefix
- file-role: utility
- default-classification: utility
- Derived from multi-file merged unit "Seo" (2 member files).

<!-- section-id: merge-context -->
## Merge Context

This logical unit was identified by the following merge signals:

- shared-name-prefix

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.
