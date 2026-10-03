# Module: Analytics

**Kind:** Module

## Production provider

`networkProvider.ts` implements the existing AnalyticProvider interface with fail-silent, same-origin validated metrics. Early explicit opt-in selects it; default local counters remain unchanged. Identify is a no-op, and transport projects only typed event/tool ID/slug, omitting mode/user content. See [OBSERVABILITY](../OBSERVABILITY.md).
**Scope:** Multi-file logical unit (3 source files)
**Group:** src/module

<!-- section-id: representative-file -->
## Representative File

`src/module/analytics/index.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/module/analytics/index.ts` [barrel] *(representative)*
- `src/module/analytics/provider.ts` [implementation]
- `src/module/analytics/type.ts` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Logical unit spanning 3 source files (module).
- Representative file: src/module/analytics/index.ts
- Merge signals: barrel-export, co-located-index-and-implementation
- file-role: barrel
- filename: index.ts
- file-role: utility
- default-classification: utility
- Derived from multi-file merged unit "Analytics" (3 member files).

<!-- section-id: merge-context -->
## Merge Context

This logical unit was identified by the following merge signals:

- barrel-export
- co-located-index-and-implementation

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.
