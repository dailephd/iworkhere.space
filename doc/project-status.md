# PROJECT STATUS

## Current Phase
v0.1.1 development-validation hardening is integrated into `master` and is the
accepted validation/development baseline. The package metadata remains at
`0.1.0`; this integration does not perform a package-version release. The
obsolete local repository orchestrator is retired. v0.2.0 Image Utility Foundation
is in progress. Batch 1 implements a separate production Chromium browser gate,
fixture provenance policy and image lifecycle specification. CI now defines
Typecheck, Lint, Test, Build and E2E; hosted E2E execution is pending the final
version PR. The package remains `0.1.0` and the six product tools are unchanged.

The approved design-system modernization intent from historical PR #1 has been reconciled onto this accepted baseline through the fresh design-reconciliation branch. PR #1 was not merged as-is because its branch was stale and divergent; it is superseded after replacement integration. `doc/DESIGN.md` is now the canonical visual authority and the current shell, theme controls, footer, and route composition follow it.

The planner-owned Batch 1 execution packet governs this foundation. After planner
review of its report, the next action is Batch 2 — Image Resizer. No image utility
or generic file-processing framework is implemented in Batch 1.
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
  build, e2e)
- Test infrastructure with Vitest and unique report generation
  (`test-report/<RUN_ID>/`)
- Aggregate local validation runner (`script/verify.ts`) with shared RUN_ID,
  command logs, and Vitest reports
- Separate Playwright `test:e2e` command, desktop/mobile Chromium production
  regression suite, diagnostic gate and reports under `test-report/e2e/<RUN_ID>/`
- Image fixture provenance convention and `modules/ImageFileProcessing.md`
- Ignored `heic-to@1.5.2` technical loading proof: CSP entry, lazy import and worker
  entry pass. Functional HEIC conversion and final registry route isolation are
  not claimed; LGPL-3.0 production license approval is required.
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
(latest local validation on 2026-09-30: 18 Vitest files, 199 tests, all passing;
36 browser tests passing, 18 per Chromium project)
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
- `src/component/layout/ServiceWorkerRegister.test.tsx` — 5 tests
- `script/e2eDiagnostic.test.ts` — 6 tests
- Total: 199 tests, all passing across 18 discovered Vitest files; original 188
  tests retained. Production E2E passes 36 tests across both required viewports.

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

- v0.2.0 HEIC production license approval, functional conversion and final
  application dependency/runtime isolation acceptance
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

Proceed to v0.2.0 Batch 2 — Image Resizer only after planner review of the Batch 1
report. Preserve the shared feature branch and the planner-owned execution scope.

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
