# Component: ToolClientFrame

**Kind:** Component

<!-- section-id: representative-file -->
## Representative File

`src/component/tool/ToolClientFrame.tsx`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/component/tool/ToolClientFrame.tsx` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/component/tool/ToolClientFrame.tsx
- file-role: component
- extension: .tsx
- filename: PascalCase (ToolClientFrame)
- path-segment: components
- Derived from single-file merged unit "ToolClientFrame".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

The runtime `setQuery(next, { sameDocument: true })` opt-in replaces the current
history URL through Next.js's native History API integration, without server
navigation. Calculator uses it so edits work offline. `useSearchParams` continues
to supply shared-URL and history state. Omitting the option retains the existing
`router.replace` behavior for other tools. Both paths retain identity-only
execution telemetry and safe error capture. The frame owns page-open telemetry.

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.
