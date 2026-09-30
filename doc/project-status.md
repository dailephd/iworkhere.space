# PROJECT STATUS

## Current Phase
v0.1.1 development-validation hardening is integrated into `master` and is the
accepted validation/development baseline. The package metadata remains at
`0.1.0`; this integration does not perform a package-version release. The
obsolete local repository orchestrator is retired. v0.2.0 Image Utility Foundation
is in progress. Batch 1 implements a separate production Chromium browser gate,
fixture provenance policy and image lifecycle specification. CI now defines
Typecheck, Lint, Test, Build and E2E; hosted E2E execution is pending the final
version PR. The package remains `0.1.0`. Batch 2 adds Image Resizer;
Batch 3 adds Image Compressor as the eighth registered tool. Batch 4 adds
JPG / PNG / WebP Converter as the ninth registered tool. Registered tools = 9;
image tools = 3. Existing tool behavior remains protected.

The approved design-system modernization intent from historical PR #1 has been reconciled onto this accepted baseline through the fresh design-reconciliation branch. PR #1 was not merged as-is because its branch was stale and divergent; it is superseded after replacement integration. `doc/DESIGN.md` is now the canonical visual authority and the current shell, theme controls, footer, and route composition follow it.

The accepted Batch 1 foundation supports the planner-owned Batch 2 Image Resizer
vertical slice: browser-native JPEG/PNG/WebP resizing with local selection,
validation, previews and downloads. No generic file-processing framework is
implemented. Batch 3 independently proves browser-native compression and shares
only the ten equivalent source-file primitives through ImageFile. Batch 4 shares
only identical source presentation through ImageSourcePanel;
state, object URLs, results/actions and operation encoding remain local. Batch 4
protects existing Compressor structure through the project-aware Observer lane
and proves natural document scrolling in the actual completed mobile Converter
state through Playwright. Feature result PASS; ecosystem result DEGRADED because
the first Batch 4 planner packet incorrectly required scroll ownership from a
non-scrollable baseline and required a corrected planner prompt. The prior
Batch 3 workflow gap remains historical evidence.
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
- **Image Resizer** (`/tool/image-resizer`) — image category
- **Image Compressor** (`/tool/image-compressor`) — image category; actual JPEG,
  PNG and WebP byte reduction, with truthful no-reduction outcomes

- **JPG / PNG / WebP Converter** (`/tool/image-converter`) — image category;
  all six distinct conversion pairs, exact dimensions/MIME, JPEG white flattening,
  PNG/WebP alpha preservation and canonical downloads

### Test coverage
(latest local validation on 2026-09-30: 27 Vitest files, 356 tests, all passing;
126 browser tests passing, 63 per Chromium project)
- `src/module/theme/themeRegistry.test.ts` — 30 tests
- `src/app/api/log/route.test.ts` — 9 tests
- `src/lib/storage.test.ts` — 12 tests
- `src/module/analytics/analytics.test.ts` — 10 tests
- `src/module/tool/metadata.test.ts` — 20 tests
- `src/module/tool/time/timeArithmetic.test.ts` — 31 tests
- `src/module/tool/recentlyUsed.test.ts` — 10 tests
- `src/module/tool/registry.test.ts` — 14 tests
- `script/verify.test.ts` — focused validation-runner tests
- `src/lib/seo.test.ts` — 9 tests
- `src/module/tool/text/extractHtmlText.test.ts` — 21 tests
- `src/module/theme/themeRuntime.client.test.ts` — 18 tests
- `src/app/category/[category]/page.test.ts` — 2 tests
- `src/component/common/ThemeToggle.test.tsx` — 2 tests
- `src/component/layout/AppShell.test.tsx` — 1 test
- `src/component/layout/VerticalNav.test.tsx` — 1 test
- `src/component/layout/ServiceWorkerRegister.test.tsx` — 5 tests
- `script/e2eDiagnostic.test.ts` — 6 tests
- `src/module/tool/image/imageResizer.test.ts` — 40 pure rule tests
- `src/module/tool/image/ImageResizerTool.test.tsx` — 3 local lifecycle/telemetry tests
- `src/module/tool/image/imageCompressor.test.ts` — 46 pure rule tests
- `src/module/tool/image/ImageCompressorTool.test.tsx` — 5 lifecycle/telemetry tests
- `src/module/tool/image/imageFile.client.test.ts` — 7 boundary/cleanup tests
- `src/module/tool/image/imageConverter.test.ts` — 30 pure rule tests
- `src/module/tool/image/imageConverter.client.test.ts` — 11 encoding/cleanup tests
- `src/module/tool/image/ImageConverterTool.test.tsx` — 7 lifecycle/telemetry tests
- `src/component/tool/image/ImageSourcePanel.test.tsx` — 1 presentation/delegation test
- Total: 356 tests, all passing across 27 discovered Vitest files; all inherited
  305 tests retained. Production E2E passes 126 tests across both viewports,
  including all 94 inherited browser cases and 32 Converter cases.
- Completed mobile Converter: document height 1,986px > 844px viewport, document
  scrolling element HTML, main/workspace overflow visible, window scrollY 1,142px,
  footer reachable. No horizontal overflow at either required viewport.
- Frozen Compressor project-aware Observer check PASS; acceptance configuration
  restored byte-for-byte. Supplementary Observer scroll lane NOT_REQUIRED.
- Static JavaScript: 620,482 bytes / 13 chunks (+7,424 bytes); existing representative
  route transfer delta +1,056 bytes each. No dependency or package-version change.

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

Next action: Batch 5 — HEIC → JPG / PNG Converter, only after planner review.
Return the Batch 4 report to the planner. Do not begin Batch 5 until the planner
reviews all six conversion directions, alpha/white-flatten semantics, real
completed-state scroll behavior, shared presentation evidence, Observer result
and bundle impact. HEIC is not implemented. Preserve the shared feature branch.

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
