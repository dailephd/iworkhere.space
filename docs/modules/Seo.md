# Module: Seo

**Kind:** Module
**Scope:** Multi-file logical unit (2 source files)
**Group:** src/lib

<!-- section-id: representative-file -->
## Representative File

`src/lib/seo.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: contract -->
## Current contract at the 2026-10-26 inspection

```typescript
function buildPageMetadata(seo: { title, description, canonicalPath }): Metadata
function buildToolMetadata(seo: { title, description, canonicalPath }): Metadata
function buildCategoryMetadata(slug: string, title: string, description: string): Metadata
```

- The helpers build a Next.js `Metadata` object with the browser title
  `buildBrowserTitle(input title)` (the unbranded input title plus the single
  suffix " - iworkhere"), `description`, `alternates.canonical` (absolute URL
  under `https://iworkhere.space`), and an `openGraph` block
  (`title`/`description`/`url`/`siteName`/`type: "website"`).
- Descriptive Open Graph/Twitter titles currently use the input title plus
  " — iworkhere.space". The uniform `iworkhere` HTML title of the October 24
  implementation is historical; v0.4.4 Batch 1 replaced it (see below).
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

This document originated in the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

## Delivery 2 crawl and metadata contract

The existing SITE_URL is the single canonical origin and is exported for root metadata, sitemap and robots. Generic metadata helpers build apex HTTPS canonicals, Open Graph and Twitter summary fields without importing tool guide data. `isIndexable` is true for Vercel production, false for Vercel preview/development/unknown environments, and true for generic NODE_ENV=production without Vercel metadata. Root metadata applies the corresponding robots directive. Production robots permits ordinary public crawling and advertises the canonical sitemap; previews block crawling and advertise no sitemap. No GPTBot-specific training policy is added.

## v0.4.4 title recovery

Status: implemented in v0.4.4 Batch 1 on the local feature branch (uncommitted,
unreleased). The 2026-10-26 user instruction requires descriptive HTML titles; [the implementation plan](../plans/v0.4.4-implementation-plan.md)
owns the exact route titles and acceptance criteria.

The existing buildPageMetadata owner produces each input title plus the
single suffix " - iworkhere". Registry SEO input stays unbranded; do not add
another title registry, duplicate root suffix or client document.title effect.
The merge route must emit "Merge PDF Files Online - iworkhere". Category
titles remain derived from category.ts; fixed pages and four authored guides
use their own truthful metadata input. Not-found routes use
"Page Not Found - iworkhere", preserve 404/noindex and remain outside the sitemap.

Preserve canonical query/hash removal, environment indexability, descriptions
and descriptive social metadata. Verify initial HTML and final DOM for every
public route, direct/client/back-forward navigation, reload and error routes.
Because the social titles derive from the same unbranded input, they now read
the descriptive title plus " — iworkhere.space" (for example "Merge PDF Files
Online — iworkhere.space"). The not-found page builds its title with
`buildBrowserTitle` and keeps its own noindex robots.
Tests that required the uniform title were replaced with exact expected titles.
The five planned guide URLs extend the current 30-route sitemap to 35; this
is planned inventory and is not a claim about current deployment.
