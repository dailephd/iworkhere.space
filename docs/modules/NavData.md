# Module: NavData

**Kind:** Module

<!-- section-id: representative-file -->
## Representative File

`src/app/navData.ts`

This is the primary anchor file for the logical unit. It is the canonical reference for retrieval and context-pack consumers.

<!-- section-id: member-files -->
## Member Files

- `src/app/navData.ts` [implementation]

<!-- section-id: inferred-role -->
## Inferred Role

- Representative file: src/app/navData.ts
- file-role: utility
- default-classification: utility
- Derived from single-file merged unit "NavData".
- Merge signals: single-file-unit

<!-- section-id: notes -->
## Notes

This document was generated from the Milestone 12 merged-unit ingestion pass.
It describes a logical unit that may span multiple source files. File-level detail is preserved in the member list above.
Manual review and updates are encouraged to add implementation details.

### v0.4.3 Batch 4

`defaultNavItem` is now Home (`/`), All tools (`/discover`) and About (`/about`); the root layout appends one entry per available
category. Contact Us is deliberately not a navigation item: it lives in the footer action group.

## v0.4.4 Batch 5 primary navigation order

`defaultNavItem` is Home (`/`), All tools (`/discover`), Workflows (`/workflows`) and Guides (`/guide`). `src/app/layout.tsx` builds the registry-populated categories (document, text, math, converter, time, image, developer) into the separate Categories disclosure. There is no `aboutNavItem`: About (`/about`) is a footer link next to Contact and Privacy (`src/component/layout/Footer.tsx`).
