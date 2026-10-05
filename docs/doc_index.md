# docs/doc_index.md

# Documentation Index

### docs/modules/CompressPdf.md

**Summary:** Lossless structural QPDF compression, strict independent PDF.js
verification, truthful byte comparison and local lifecycle/privacy.
**When to read:** Changing Compress PDF.

### docs/modules/PdfToImage.md

**Summary:** Selected-page PNG/JPEG export, DPI/quality, atomic viewport preflight,
native image verification and local cancellation/download ownership.
**When to read:** Changing PDF to JPG / PNG.

### docs/modules/ImagesToPdf.md

**Summary:** Atomic ordered JPEG/PNG selection, intrinsic page sizing, direct
worker embedding, independent alpha/content verification and local lifecycle.
**When to read:** Changing Images to PDF.

### docs/modules/MergePdf.md

**Summary:** Atomic ordered PDF selection, existing worker merge operation,
independent verification, local lifecycle/download/privacy and accessibility.
**When to read:** Changing Merge PDF.

### docs/modules/SplitPdf.md

**Summary:** Explicit parsed output groups, existing worker split operation,
ordered verification/downloads, local lifecycle/privacy and accessibility.
**When to read:** Changing Split PDF.

### docs/modules/PdfFile.md

**Summary:** Batch 1 document source validation, frozen limits, bounded PDF
inspection/errors, page selection and pure ordered-file transitions.

### docs/modules/PdfProcessing.md

**Summary:** Batch 1 lazy PDF.js/native worker, short-lived pdf-lib/QPDF workers,
pinned supply chain/assets/notices and independent browser/container acceptance.

### docs/modules/HeicConverter.md

**Summary:** Batch 5 HEIC/HEIF worker-only decoding, bounded inspection,
JPEG/PNG composition, lifecycle, privacy, synthetic MIT fixture identity and separate
production-license release gate. The generated positive fixture is within the frozen decoded-area limit.

## 1. Overview

Current persistent-observability references:

- `OBSERVABILITY.md`: diagnostic/measurement split, bounded error metrics,
  viewport classification, Neon configuration, daily maintenance and privacy.
- `../database/observability/README.md` / `001-schema.sql`: dedicated schema,
  90-day raw retention, indefinite aggregates, transactional SQL and read-only role.
- `../dashboard/README.md`: independent app, seven ranges, sources, UTC bins,
  honest percentile semantics, empty/failure states and isolated visual smoke.
- `../dashboard/DEPLOYMENT.md`: two Vercel projects, one Neon database, exact
  external authentication/secret/domain setup while the public site stays public.
- `TESTING.md` / `CI_CD.md`: root/database/dashboard validation and unique artifacts.

Current integration and deployment authority:

- `ROADMAP.md` owns v0.2.0 scope, including explicitly authorized repository
  extensions. `project-status.md` owns current implementation/deployment/release
  state and the next workflow.
- `DESIGN.md` is the canonical visual authority, including the current
  workspace-first layout, four supported themes and scoped material pilot.
- `DEPLOYMENT.md` owns root runtime, safe environment templates and the variable
  matrix. `ADVERTISING.md` owns AdSense code/configuration and external activation
  gates. `OBSERVABILITY.md` owns telemetry/privacy/persistence contracts.
- `API.md` and `SCHEMA.md` describe public route/schema contracts;
  `database/observability/README.md` owns SQL/migration/role details.
- `dashboard/README.md` and `dashboard/DEPLOYMENT.md` own the isolated app and
  its separate Vercel deployment/protection steps.

This documentation system defines the architecture, development standards, and
operational procedures for the Modular Utility Platform. Documentation is
organized by function: architectural contracts, development workflows, testing
standards, and operational guides.

The governance philosophy is explicit and contract-driven. Every module boundary
is defined by a TypeScript interface or a schema document. Changes to code must
be preceded by changes to documentation.

---

## 2. Planning, Architecture & Design Documents

### ROADMAP.md
**Summary:** Canonical version-level planning authority. It owns version goals,
product capability scope, dependencies, constraints, exclusions, acceptance
criteria, unresolved planning decisions, deferred/Version-TBD work, and concise
status. It must not become an implementation-batch log, command transcript,
changed-file inventory, or execution report.
**When to read:** Before planning any version or deciding whether work belongs
in the current release.
**Relations:** Version-specific implementation plans derive from the roadmap but
do not replace or silently rewrite it.

### docs/plans/vX.Y.Z-implementation-plan.md
**Summary:** Version-specific frozen implementation plan, created only when that
version starts and after current repository inspection and fresh my-dev-kit
retrieval. A version plan may define implementation architecture decisions,
context-sharing batches, sequencing, affected owners/contracts, planner-authored
test expectations, batch gates, validation, explicit exclusions, and the
handoff into documentation reconciliation/readiness.
**When to read:** During implementation of the named version. If no plan exists
yet, do not invent batches from the roadmap; prepare the plan first.
**Relations:** Subordinate to the roadmap's version-level scope. It is planning
authority, not evidence that a batch or version was implemented.

### plans/v0.3.0-implementation-plan.md

**Summary:** Frozen PDF & Document Essentials scope, browser-local architecture,
pinned PDF.js/pdf-lib/project-owned QPDF runtimes, supply-chain and fidelity
contracts, public limits, six ordered batches and separate release gates.
**When to read:** Before preparing or executing any v0.3 implementation batch.
**Relations:** [Implementation plan](plans/v0.3.0-implementation-plan.md),
ROADMAP.md and project-status.md. Planning is frozen; implementation is not started.

### plans/ui-discovery-growth-plan.md
**Summary:** Planner-authored, research-backed 2026-10-01 plan for a small
homepage/Image Resizer visual pilot, approved-pattern image-family rollout,
basic crawlability and useful tool-page content, followed by authorized launch
measurement. Records current source findings, current public research,
explicitly proposed visual changes, exclusions, and unresolved evidence.
**When to read:** Before preparing the next UI/discovery implementation prompt.
**Relations:** [Detailed plan](plans/ui-discovery-growth-plan.md), DESIGN.md,
ROADMAP.md and project-status.md. It is not the missing historical v0.2 version
plan, does not reorder the A+B catalog, and does not authorize release or claim
traffic gains. Visual approval precedes broad rollout.

### project-status.md
**Summary:** Tracks actual current implementation, validation state, open
decisions, and exact next action. It does not own future version scope.
**When to read:** To establish the current repository state before planning or
implementation.
**Relations:** Implementation evidence may update roadmap status but must not
erase unrelated future scope.

### architecture.md
**Summary:** Defines the high-level four-layer structure (`app`, `module`,
`component`, `lib`) and the strict dependency rules between them. It details the
tool registry system, the server/client split, and the data flow for tool
rendering.
**When to read:** First read for any new contributor. Essential before creating
new modules or changing layer boundaries.
**Relations:** Enforces the boundaries tested in `TESTING.md`.

### DESIGN.md
**Summary:** The canonical product design and styling contract, including
visual identity, themes, layout, scrolling, accessibility, performance, and
current implementation boundaries. Separates the current implemented shell
from the proposed workspace-first pilot awaiting visual approval.
**When to read:** Before changing product visual design, styling, interaction
presentation, responsive behavior, or visual accessibility rules.
**Relations:** Works with `architecture.md`, agent guidance, and
`code-generation-guidelines.md`.

### SCHEMA.md
**Summary:** The central source of truth for data contracts. It defines the
exact shape of `ToolDefinition`, analytics events, log records, storage keys,
and API responses.
**When to read:** Whenever you need to consume data across a module boundary or
add a new field to a shared object.
**Relations:** Directly referenced by `API.md` and enforced by `TESTING.md`.

### API.md
**Summary:** Lists the stable public interfaces of the platform. It distinguishes
between what is safe to import (stable contracts) and what is internal
implementation detail.
**When to read:** When building a new feature that needs to interact with core
platform services like the registry, observability, or storage.
**Relations:** Implements the contracts defined in `SCHEMA.md`.

### modules/ImageConverter.md
**Summary:** Local JPEG/PNG/WebP conversion in all six distinct directions,
quality for JPEG/WebP, alpha preservation, white JPEG compositing, exact MIME
verification, lifecycle/privacy and real completed-state scrolling acceptance.
**When to read:** Implementing or validating Image Converter.
**Relations:** Reuses ImageFile.md and ImageSourcePanel.md; registry and E2E owners.

### modules/ImageSourcePanel.md
**Summary:** Presentation-only common source panel proven across independently
passing Resizer, Compressor and Converter. No domain imports or lifecycle ownership.
**When to read:** Editing image source presentation.
**Relations:** All three image tool UIs pass display-ready data and keep lifecycle local.

### modules/ImageCompressor.md
**Summary:** Local JPEG/PNG/WebP compression with actual byte comparison,
JPEG/WebP quality controls, native PNG re-encoding, truthful no-reduction outcomes,
safe telemetry and resource cleanup.
**When to read:** Implementing or validating Image Compressor.
**Relations:** Uses ImageFile.md and the existing registry/browser validation owners.

### modules/ImageFile.md
**Summary:** Narrow source-file primitives proven equivalent by independent
Resizer/Compressor implementations: signatures, metadata, limits, formatting,
basename, native decode and inspection. No shared React framework or encoder.
**When to read:** Changing common source validation or decoding.
**Relations:** Shared by ImageResizer.md, ImageCompressor.md and ImageConverter.md.

### modules/ImageResizer.md
**Summary:** Browser-native JPEG/PNG/WebP resizing, authoritative signatures,
25 MiB and 30 MP limits, original aspect ratio, local state, fixed encoding,
preview/download ownership, privacy and validation evidence.
**When to read:** Before changing or testing Image Resizer.
**Relations:** Implements ImageFileProcessing.md through the existing registry.

### modules/ImageFileProcessing.md
**Summary:** Frozen browser image-file validation, privacy, state, resource-limit,
Blob/download and object-URL lifecycle contracts. No shared production engine is
authorized. Includes production HEIC worker isolation, local actionable errors and separate
production-license release boundaries.
**When to read:** Before implementing or testing any v0.2 image tool.
**Relations:** Uses TESTING.md and the deterministic image-fixture convention;
preserves registry, storage and observability contracts in architecture.md.

### project-tree.txt
**Summary:** A text representation of the file structure.
**When to read:** To understand where files are located.
**Relations:** Visualizes the structure defined in `architecture.md`.

---

## 3. Development & Code Governance

### code-generation-guidelines.md
**Summary:** Strict rules for AI agents and developers generating code. It
forbids speculative implementation, enforces singular naming, and requires
my-dev-kit bounded retrieval before broad source reading.
**When to read:** Mandatory for coding agents. Useful for humans to understand
the expected code quality.
**Relations:** Enforces the philosophy in `DESIGN.md`.

### AGENTS.md and CLAUDE.md
**Summary:** Root-level coding-agent guidance. Both documents must stay
semantically aligned with the retrieval-first policy in
`code-generation-guidelines.md` and must not require users to manually paste
repository files that are already available to the coding environment.
**When to read:** At coding-agent session start.
**Relations:** Repository-specific execution guidance subordinate to the
architecture, roadmap, and version plan.

### CI_CD.md
**Summary:** Defines six public-application CI gates (typecheck, lint, test,
build, E2E and Container) plus independent dashboard and observability-database
workflows. It documents `npm run verify` as the first four local checks, with
separate browser/container commands, report discipline, and the prohibition on
suppressing errors.
**When to read:** When setting up a PR or debugging a CI failure.
**Relations:** Enforces the standards defined in `TESTING.md`.

---

## 4. Testing & CI

### TESTING.md
**Summary:** The comprehensive testing strategy. It defines the current Vitest
unit/contract/integration disciplines and implemented Playwright E2E browser
discipline, the requirement for unique test reports, and the rules for SSR
safety and hydration mismatch detection.
**When to read:** Before writing any code. Every new feature must have
accompanying tests as defined here.
**Relations:** The practical enforcement of `SCHEMA.md` and `architecture.md`.

---

## 5. Operational / Debugging Documents

### DEPLOYMENT.md

Authoritative Docker and self-hosted runtime guide: standalone image, optional
local preview, runtime requirements, browser assets, and release boundaries.

### debugging.md
**Summary:** A systematic protocol for isolating root causes. It mandates
reading code before reasoning, classifying failures, and applying the smallest
possible fix.
**When to read:** Immediately when a bug is found or a build fails.
**Relations:** Provides the methodology for resolving issues found by `CI_CD.md`
and `TESTING.md`.

---

## 6. Reading Paths

### For new contributors
1. `architecture.md` - Understand the system structure.
2. `DESIGN.md` - Review the canonical product design and styling contract.
3. `project-status.md` - See what is actually built now.
4. `ROADMAP.md` - Understand the approved product/version direction.
5. `TESTING.md` - Learn how to verify your work.

### For UI and discovery planning
1. `project-status.md` - Establish actual implementation and release state.
2. `plans/ui-discovery-growth-plan.md` - Review source evidence, proposed pilot,
   research, delivery boundaries and measurement limits.
3. `DESIGN.md` - Separate current layout from the pilot requiring approval.
4. Refresh affected source/contracts through my-dev-kit before implementation;
   approve the visual reference before rollout.

### For planning a version
1. `ROADMAP.md` - Preserve the approved version goal, scope, dependencies,
   exclusions, acceptance, and unresolved decisions.
2. `project-status.md` - Establish current implementation and validation
   state.
3. Refresh repository evidence with my-dev-kit.
4. Resolve the version's open planning decisions.
5. Create and freeze `docs/plans/vX.Y.Z-implementation-plan.md`.

### For implementing a planned version
1. Read `ROADMAP.md` and the current version implementation plan.
2. `SCHEMA.md` - Check whether shared data contracts are affected.
3. `API.md` - Identify stable interfaces and extension points.
4. Read affected `docs/components/*.md` and `docs/modules/*.md` contracts.
5. `DESIGN.md` - Review UI rules when
   applicable.
6. `TESTING.md` - Apply the required test layers and validation evidence.

### For debugging a production issue
1. `debugging.md` - Follow the strict isolation protocol.
2. `architecture.md` - Trace the data flow.
3. `API.md` - Verify interface contracts.

### For modifying CI or governance rules
1. `CI_CD.md` - Understand current gates.
2. `TESTING.md` - Ensure new rules don't break test integrity.
3. `code-generation-guidelines.md` - Update if generation rules change.

---

## 8. Component & Module Specification Layer (docs/components/, docs/modules/)

**Summary:** A separate implementation/design-contract layer, one file per
component (`docs/components/*.md`, 18 files plus `TimeArithmeticTool.md` added
2026-08-07 = 19) or module/logical-unit (`docs/modules/*.md`, 27 files). Each
file identifies representative/member source files and (where reconciled)
a real contract: exported functions, storage keys, dependencies, and known
implementation/documentation gaps.

**When to read:** Before modifying a specific component or module — check
whether its `.md` file already documents a contract you must preserve.

**Relations:** Complements `architecture.md` (system-level) and `API.md`
(cross-cutting contracts) without duplicating them; this layer is
per-unit detail.

**Status as of 2026-08-07 reconciliation:** all 46 files were produced by an
automated "Milestone 1 / Milestone 12" ingestion pass
(`log/iworkhere-timearith-prepared/`) and, except where noted below, contain
only generation metadata (representative file, member files, inferred role,
merge signals) with **no real contract content** — every unreconciled file
ends with "Manual review and updates are encouraged to add implementation
details." This reconciliation pass added a `## Contract` section with real
exported signatures, storage keys, dependencies, and known implementation gaps
to the files judged most architecturally load-bearing: `Registry.md`,
`Metadata.md`, `Storage.md`, `RecentlyUsed.md`, `Observability.md`, `Seo.md`,
`ThemeRegistry.md`, `ThemeStorage.md`, `ThemeRuntime.md`, plus a newly created
`TimeArithmeticTool.md` (previously undocumented despite being a registered
tool). The remaining ~36 files (all `docs/components/*.md` except
`TimeArithmeticTool.md`, and `docs/modules/{Analytics,Button,ExtractHtmlText,
Input,Layout,NavData,Page,Provider,Route,RustLogProvider,StatusPanel,
ThemeProvider,ThemeToggle,ToolSearch,Type,Types,Util,Logger}.md`) remain thin
generation stubs. This is recorded as an open documentation gap, not silently
fixed — see the Architecture Assimilation Report handoff for the full list.

---

## 9. Layer Inventories (docs/features/)

**Summary:** Four files (`src-app.md`, `src-component.md`, `src-lib.md`,
`src-module.md`) that are raw, auto-generated per-`src/`-subdirectory file
listings from the same ingestion pass, not component specs (their original
titles named an arbitrary member file, e.g. "Component: HomeClient" for the
whole `src/app` group — corrected 2026-08-07 to accurate layer-inventory
titles).

**When to read:** As a cross-check of file membership per layer, or to spot
files not yet covered by an individual component/module doc. Not for
authoritative responsibility descriptions — use `architecture.md` for that.

**Relations:** Subordinate to `architecture.md`; overlaps with
`project-tree.txt` (file locations) but grouped by classifier heuristics
rather than directory structure.

---

## 10. Generated Reports

### EXISTING_PROJECT_INVENTORY_REPORT.md
**Summary:** Machine-generated inventory (Milestone 1 v1, generated
2026-04-01) of every source file, its inferred unit/role, and merged logical
units. This is the report that originally proposed the `docs/components/`,
`docs/modules/`, and `docs/features/` doc targets listed above.
**When to read:** To understand how the component/module doc set was derived,
or to see the classifier's raw file-role output.
**Relations:** Upstream of every file in section 8 and section 9.
**Do not hand-edit:** regenerate via the ingestion tool rather than editing by
hand; treat as a point-in-time snapshot (2026-04-01), not a live index.

---

### THIRD_PARTY_NOTICES.md and license copies

**Authority:** Factual third-party dependency notices, not legal release approval.
Production license copies are under public/licenses; the synthetic MIT fixture
license and provenance are under test/fixtures/images.

### Historical reports and inventories

EXISTING_PROJECT_INVENTORY_REPORT.md and ignored batch/validation reports are
historical snapshots. Their old counts do not override project-status.md,
TESTING.md, current module contracts or final Batch 6 evidence. The absent v0.2
version plan remains historical process debt; no retrospective plan was authored.

## 11. Gaps & Observations

- **Overlap:** `API.md` and `SCHEMA.md` both define contracts, but `SCHEMA.md`
  focuses on data shapes while `API.md` focuses on function signatures and
  module boundaries. This separation is clean but requires checking both.
- **Overlap:** `TESTING.md` and `CI_CD.md` both discuss test reporting, but
  `CI_CD.md` focuses on the pipeline mechanics while `TESTING.md` focuses on
  test content.
- **Completeness:** Architecture, design, testing, and operations are well
  covered at the system level. The per-unit `docs/components/` and
  `docs/modules/` layer is largely unreconciled generation stubs (see section
  8) — a known, tracked gap rather than a completeness claim.
- **Naming:** Consistent use of singular naming is enforced in
  `code-generation-guidelines.md` and visible in the file structure.
- **Browser validation:** `TESTING.md` documents the implemented production
  desktop/mobile Chromium gate and current image-tool browser proofs. Hosted
  E2E execution remains pending the final version PR.
- **Theme token detail remains implementation-owned:** `DESIGN.md` records the
  cross-theme contract; exact per-theme token values remain defined in
  `src/style/theme.css`.

## Production integration contracts

- [OBSERVABILITY](OBSERVABILITY.md): safe telemetry, explicit activation, provider boundaries, Web Vitals, client error/navigation instrumentation and structured runtime logs.
- [ADVERTISING](ADVERTISING.md): frozen AdSense identities, conditional responsive slots, verification, CLS reservation, default network-safe tests and external CMP/readiness gate.

## Delivery 2 guide and crawl evidence

- [Guide contract](modules/Guide.md): server-consumed image operation content and related-ID ownership.
- [Delivery 2 implementation report](reports/UI_DISCOVERY_DELIVERY_2_IMPLEMENTATION_REPORT.md): bounded image rollout, crawl foundation, validation and limitations (created by this delivery).
- [Delivery 2 launch report](reports/UI_DISCOVERY_DELIVERY_2_LAUNCH_REPORT.md): merge, exact-SHA CI, production technical checks, webmaster action status, and measurement follow-up.
