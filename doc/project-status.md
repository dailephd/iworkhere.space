# PROJECT STATUS

## Current Phase
v0.1.1 development hardening is implemented on
`feature/v0.1.1-validation-hardening` and remains unreleased. The implementation
candidate `36deca6d7212830b09a87a324b5458647b2c212f` passed the four required
pull-request CI jobs on 2026-09-22. Any later reconciliation commit on PR #2
must receive new exact-head CI before merge.

The earlier design-system modernization work remains open as PR #1 on
`feature/design-system-modernization`. That branch diverges from PR #2; its
current head passed build, typecheck, and test but failed lint, and it predates
the v0.1.1 retirement of the repository-local orchestrator. Do not merge PR #1
as-is after v0.1.1. Preserve its intended design changes through a fresh
reconciliation from the accepted v0.1.1 base so obsolete validation or
orchestration behavior is not reintroduced.

The architecture has been reassessed and is suitable for continued catalog
growth with incremental evolution. The next concrete product track is the
Priority A+B utility catalog defined in `doc/ROADMAP.md`. Before v0.2.0
implementation begins, establish one accepted post-v0.1.1 + design baseline,
then create the version-specific implementation plan from fresh repository
evidence.

---

## Completed

- Folder structure defined (four-layer: app, module, component, lib)
- Next.js 16 App Router with React 19, TypeScript 5, Tailwind CSS v4
- PWA icons created
- manifest.webmanifest created
- Tool registry pattern established (`src/module/tool/registry.ts`)
- Tool type system (`src/module/tool/type.ts`)
- Tool metadata index layer (`src/module/tool/metadata.ts`)
- ToolPageTemplate and ToolClientFrame scaffolded
- ToolErrorBoundary with automatic `captureError()` integration
- Slug-based routing (`/tool/[slug]`)
- Category pages (`/category/[category]`)
- Tool discovery page (`/discover`) with category grouping and search
- Home page with client-side tool search and status panel
- Logging module (`src/module/log/`) with ConsoleProvider and RustLogProvider
- Observability facade (`src/module/observability/`) unifying analytics and
  logging
- Analytics abstraction (`src/module/analytics/`) with swappable provider
- Persistent state abstraction (`src/lib/storage.ts`)
- SEO automation (`src/lib/seo.ts`) with `generateMetadata` on tool and
  category pages
- AppShell layout with header, footer, vertical navigation, and ad banner slots
- Reusable UI components (Button, Input, StatusPanel, ToolSearch, ThemeToggle)
- Navigation data (`src/app/navData.ts`) wired to real routes via Link
- CSS custom property theming (`src/app/global.css`, `src/style/theme.css`)
- Multi-theme registry (`src/module/theme/`): `ThemeId` union of eight themes
  (system, light, dark, onedark, vscode-modern, dracula, amethyst-haze,
  mercury-fog), storage persistence, and system preference fallback for
  `"system"`
- Recently used tool tracking module (`src/module/tool/recentlyUsed.ts`)
- Navigation items wired to routes (Home, Discover) via VerticalNav with
  `usePathname()`
- Service worker (`public/sw.js`) with offline caching (network-first
  navigation, cache-first assets)
- ServiceWorkerRegister client component for SW registration
- `/api/log` endpoint for RustLogProvider log ingestion
- `/api/health` health check endpoint
- CI/CD pipeline — separate GitHub Actions workflows (typecheck, lint, test,
  build)
- Test infrastructure with Vitest and unique report generation
  (`test-report/<RUN_ID>/`)
- Aggregate local validation runner (`script/verify.ts`) with shared RUN_ID,
  command logs, and Vitest reports
- Project documentation updated (architecture, styling, design, code generation
  guidelines)

### Tools implemented
- **Slugify Text** (`/tool/slugify`) — text category
- **HTML Text Extractor** (`/tool/html-text-extractor`) — text category
- **Calculator** (`/tool/calculator`) — math category
- **Length Converter** (`/tool/length-converter`) — everyday category
- **Weight Converter** (`/tool/weight-converter`) — everyday category
- **Time Arithmetic** (`/tool/time-arithmetic`) — time category

### Test coverage
(counts as of `npm run test` on 2026-09-21; 12 test files, 183 tests, all
passing)
- `src/module/theme/themeRegistry.test.ts` — 30 tests
- `src/app/api/log/route.test.ts` — 9 tests
- `src/lib/storage.test.ts` — 12 tests
- `src/module/analytics/analytics.test.ts` — 10 tests
- `src/module/tool/metadata.test.ts` — 17 tests
- `src/module/tool/time/timeArithmetic.test.ts` — 31 tests
- `src/module/tool/recentlyUsed.test.ts` — 10 tests
- `src/module/tool/registry.test.ts` — 11 tests
- `script/verify.test.ts` — focused validation-runner tests
- `src/lib/seo.test.ts` — 9 tests
- `src/module/tool/text/extractHtmlText.test.ts` — 21 tests
- `src/module/theme/themeRuntime.client.test.ts` — 18 tests
- Total: 183 tests, all passing

---

## Design Constraints (Do Not Change)

- Next.js App Router
- Registry-driven tool discovery
- Server pages + client tool UI split
- Explicit imports only
- No magic auto-registration
- Analytics through abstraction layer only
- Persistence through storage abstraction only
- Logging through log module only
- Error capture through observability facade only

---

## Open Decisions

- v0.2.0 browser E2E implementation details and ownership
- v0.2.0 HEIC decoding approach and dependency/runtime cost
- v0.4.0/v0.5.0 canonical category model for developer-oriented utilities
- Auth (not needed for the Priority A+B catalog)
- Payments (future)
- Analytics provider swap (GA, Plausible, etc.)
- Ad provider (future)
- Server-side storage backend (future)
- RustLogProvider activation (endpoint exists at `/api/log`, provider swap not
  yet wired at startup)
- Recently-used product/UI ownership
- Metadata/discovery enrichment semantics
- About-page content and placement

---

## Next Steps

1. Require all four CI jobs on the exact final PR #2 head, then merge v0.1.1
   validation hardening into `master`.
2. From the updated `master`, create a fresh design-reconciliation branch and
   port only the intended product/design changes from PR #1. Do not merge the
   stale PR #1 branch as-is, and do not reintroduce its obsolete lint,
   non-blocking validation, or `script/orchestrator.ts` state.
3. Run typecheck, lint, test, and build on that reconciled design candidate,
   merge it when green, and close or supersede PR #1. The resulting `master`
   commit is the accepted base for new product work.
4. Start v0.2.0 planning from that exact base:
   - refresh my-dev-kit evidence;
   - resolve the v0.2.0 open planning decisions;
   - create and freeze `doc/plans/v0.2.0-implementation-plan.md`.
5. Implement v0.2.0 — Image Utility Foundation:
   - Image Resizer
   - Image Compressor
   - JPG / PNG / WebP Converter
   - HEIC → JPG / PNG Converter
6. Continue the product sequence defined in `doc/ROADMAP.md`:
   - v0.3.0 — PDF & Document Essentials
   - v0.4.0 — Core Text, Data & Sharing Utilities
   - v0.5.0 — Developer & Text Utility Suite
   - v0.6.0 — Time & Everyday Calculators
7. Keep security headers, recently-used integration, metadata/discovery
   enrichment, RustLogProvider activation, About, analytics provider, ads,
   server storage, authentication, and payments under Version TBD until an
   explicit planning decision assigns them.

---

## Notes for LLM

- Do not refactor architecture without permission
- Do not optimize prematurely
- Do not introduce frameworks or libraries unless requested
- Read existing files before writing code
- Follow registry-first policy for tool data
- Use analytics abstraction for all tracking
- Use storage abstraction for all persistence
- Use observability facade for error capture
- Use log module for system debugging
