# PROJECT STATUS

## Current Phase
v0.1.1 development-validation hardening is integrated into `master` and is the
accepted validation/development baseline. The package metadata remains at
`0.1.0`; this integration does not perform a package-version release. The
obsolete local repository orchestrator is retired. The four active CI jobs are
Typecheck, Lint, Test, and Build. Browser E2E remains planned for v0.2.0 and is
not currently implemented.

The approved design-system modernization intent from historical PR #1 has been reconciled onto this accepted baseline through the fresh design-reconciliation branch. PR #1 was not merged as-is because its branch was stale and divergent; it is superseded after replacement integration. `doc/DESIGN.md` is now the canonical visual authority and the current shell, theme controls, footer, and route composition follow it.

The next project action is to prepare and freeze the v0.2.0 implementation plan from the accepted reconciled `master` using fresh repository evidence. Do not begin v0.2 implementation until that plan is complete.
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
- Project documentation updated (architecture, canonical design, code generation
  guidelines)

### Tools implemented
- **Slugify Text** (`/tool/slugify`) — text category
- **HTML Text Extractor** (`/tool/html-text-extractor`) — text category
- **Calculator** (`/tool/calculator`) — math category
- **Length Converter** (`/tool/length-converter`) — everyday category
- **Weight Converter** (`/tool/weight-converter`) — everyday category
- **Time Arithmetic** (`/tool/time-arithmetic`) — time category

### Test coverage
(latest local validation on 2026-09-29: 16 test files, 188 tests, all passing)
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
- `src/app/category/[category]/page.test.ts` — 1 test
- `src/component/common/ThemeToggle.test.tsx` — 2 tests
- `src/component/layout/AppShell.test.tsx` — 1 test
- `src/component/layout/VerticalNav.test.tsx` — 1 test
- Total: 188 tests, all passing across 16 discovered files

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

Prepare and freeze `doc/plans/v0.2.0-implementation-plan.md` from the accepted
reconciled `master` using fresh repository evidence. Do not implement v0.2
until that plan is complete.

Other unassigned scope remains under Version TBD until an explicit planning
decision assigns it: security headers, recently-used integration,
metadata/discovery enrichment, RustLogProvider activation, About, analytics
provider, ads, server storage, authentication, and payments.

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
