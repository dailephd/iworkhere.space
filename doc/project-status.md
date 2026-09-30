# PROJECT STATUS

## Current implementation state

v0.2.0 implementation is complete on the shared feature branch. The registry
contains **10 tools / 4 image tools**. Package metadata remains **0.1.0**.
All four image tools enforce 25 MiB / 30 MP limits and process locally.
Real HEIC conversion, short-lived Worker lifecycle and application decoder
isolation PASS. Error feedback now identifies stages, local constraints and
realistic recovery actions; cancellations show no errors.

Batch 6 integrated completeness: PASS. Final local validation: **31 Vitest
files / 423 tests**, **170 E2E cases (85 desktop / 85 mobile)**, Typecheck,
Lint, Build, protected project-aware Observer and final impact review PASS.
All inherited 396 unit and 146 browser tests are retained. Evidence is in
`.my-dev-kit-context/reports/batch-6/final-report.md`.

V0_2_IMPLEMENTATION_COMPLETE=YES; TECHNICAL_RELEASE_CANDIDATE_READY=YES.
V0_2_RELEASE_READY=NO; HEIC_RELEASE_LICENSE_APPROVAL=REQUIRED;
HEIC_RELEASE_READY=NO; HOSTED_E2E_FINAL_VERSION_PR=PENDING. Technical acceptance
does not supply legal approval, release authorization or hosted final-PR proof.

## Current architecture and validation

The accepted v0.1.1 development-validation baseline and design reconciliation
remain in place. Next.js Server pages compose registry-driven client tools.
ImageFile shares source primitives, ImageSourcePanel shares identical source
presentation, and operation encoding/state/results/URLs/generations stay local.
Only the dedicated HEIC worker imports heic-to/next; it activates after source
size checks, never on initial routes, and terminates after each operation or
invalidation. No generic file framework is implemented.

CI has six independent gates: Typecheck, Lint, Test, Build, E2E and Container.
Active workflows use Node 24.21.0. `npm run verify` runs the first four;
`npm run test:e2e` and optional Docker `npm run test:container` are separate.
Current counts and responsibility details are in TESTING.md.

Batch 7 container runtime hardening: PASS. Next standalone output, a
digest-pinned Node 24 Docker image, optional Compose preview, Windows Docker
Desktop readiness helper, container smoke orchestration, external Playwright
runtime targeting, and the sixth Container workflow are implemented. The
container runs non-root with a read-only filesystem and passed health, route,
PWA/HEIC, full desktop/mobile E2E, image-hygiene, and graceful-shutdown checks.
Evidence is in the unique `test-report/container/` run directory. Container
runtime validation does not resolve the separate HEIC license or release gate.

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
- Production `heic-to@1.5.2` worker-only HEIC decoding, real JPEG/PNG
  conversion, lifecycle/privacy and final application decoder isolation PASS;
  production license approval remains required.
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

- **HEIC → JPG / PNG Converter** (`/tool/heic-converter`) — image category;
  actual HEIC/HEIF detection, worker-generated PNG preview, exact JPEG/PNG output.


## Historical Batch 5 acceptance

Batch 5 adds HEIC to JPG / PNG Converter, bringing the registry to **10 tools / 4 image tools**, with exact heic-to 1.5.2 isolated inside a lazily created short-lived worker. The synthetic MIT 3,554-byte positive fixture decodes to 480 x 320 and converts to JPEG/PNG at exact dimensions. Source limits remain 25 MiB / 30 MP.

Two planner fixture-selection specification gaps are DEGRADED / WORKED_AROUND: ambiguous image redistribution permission in the first fixture, then a redistributable replacement that exceeded the 30 MP contract. EXTRA_PROMPT_REQUIRED=YES. The previous 45 MP rejection remains actual limit evidence in the ignored corrected Batch 5 report. Feature acceptance is technical; HEIC_RELEASE_LICENSE_APPROVAL=REQUIRED and HEIC_RELEASE_READY=NO. Technical feature result PASS; ecosystem result DEGRADED. Final validation: 396 Vitest tests in 30 files and 146 E2E cases (73 desktop / 73 mobile), including all inherited tests; Typecheck, Lint, Build, protected Observer acceptance and impact/isolation review PASS. Complete evidence is in `.my-dev-kit-context/reports/batch-5-final/final-report.md`.


## Historical process debt

The roadmap-referenced `doc/plans/v0.2.0-implementation-plan.md` is absent
from the current tree and available Git history. V0_2_VERSION_PLAN_PRESENT=NO;
RETROACTIVE_VERSION_PLAN_CREATED=NO. Historical Batch 3–5 reports and ecosystem
learning remain snapshots; they are not current-state authorities or new Batch 6 gaps.

## Remaining decisions

- HEIC production-license approval before release.
- Final-version PR hosted E2E after explicit release-preparation authorization.
- Later-version/Version-TBD scope remains in ROADMAP.md: authentication, payments,
  analytics/ad providers, server storage, recently-used integration, metadata
  enrichment, About content and RustLogProvider activation.

## Next action

Return the Batch 6 report to the planner. Do not create a release PR, merge,
version bump, publish or deploy. After explicit HEIC production-license approval,
proceed to the normal pre-release audit and release-preparation workflow.
