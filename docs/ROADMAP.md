# Roadmap

## Overview

`iworkhere.space` is a documentation-first, registry-driven utility-tool platform built with Next.js, React, and TypeScript.

The root application package version is `0.4.0`; the independent dashboard
retains its own package version. Source release status and live production
deployment status are tracked separately.

The original v0.1.0 product baseline provides six registered utilities:

- Slugify Text
- HTML Text Extractor
- Calculator
- Length Converter
- Weight Converter
- Time Arithmetic

The v0.2 image family brings the catalog to ten tools. Package version and
implementation scope are tracked separately.

The v0.3 document family brings the live catalog to fifteen tools. v0.3.0 was
integrated through PR #9, merged to `master` at
`008458651bc8786b46fcc4b27ef119147e1e2579`, published as GitHub release
`v0.3.0` on 2026-10-06, and is now publicly deployed. Source-release identity
and hosting/deployment identity remain separate records; this planning update
does not invent an unverified Vercel deployment ID.

The application already provides registry-driven routing and discovery, category pages, query-state support, theme persistence, analytics/logging/observability abstractions, browser storage, SEO helpers, PWA/service-worker behavior, automated tests, and independent CI validation jobs.

Future development must preserve the existing architecture rather than adding parallel registries, routing systems, state systems, persistence paths, provider systems, or tool frameworks.

## Planning model

This roadmap is the canonical version-level planning document.

It owns:

- version goals;
- product capability scope;
- dependencies;
- architectural constraints that affect version scope;
- explicit exclusions;
- version-level acceptance criteria;
- unresolved planning decisions;
- deferred or Version-TBD work;
- concise implementation/release status.

It does not own implementation batches, command transcripts, changed-file lists, test counts, branch bookkeeping, or execution reports.

At the start of each implementation version, after current repository inspection and fresh my-dev-kit retrieval, create a version-specific plan at:

`docs/plans/vX.Y.Z-implementation-plan.md`

The version plan may freeze:

- implementation architecture decisions;
- context-sharing batch structure;
- sequencing;
- affected owners/contracts;
- planner-authored test expectations;
- batch acceptance gates;
- validation expectations;
- implementation exclusions;
- documentation-reconciliation and readiness handoff.

A future version's batch plan must not be prewritten in this roadmap. Implementation reports describe what happened; they do not silently rewrite the roadmap or the frozen version plan.

`docs/project-status.md` describes actual current implementation and validation state. Implementation and release evidence may update roadmap status, but must not erase unrelated future scope.

## Product principles

Future versions must preserve the following established principles:

- Keep the architecture explicit and predictable.
- Prefer composition over speculative abstraction.
- Preserve the existing four-layer structure:
  - `src/app`
  - `src/module`
  - `src/component`
  - `src/lib`
- Keep route files focused on routing and composition.
- Keep browser APIs inside client components, effects, or handlers.
- Keep tool/domain logic out of `src/app`.
- Preserve the rule that `src/lib` does not import from `src/module`.
- Keep `ToolDefinition` and `tool_definition_list` authoritative for tool registration.
- Put cross-tool derived queries in the existing metadata layer.
- Use the existing storage abstraction rather than direct parallel `localStorage` access.
- Use the existing theme registry, storage, and runtime mechanisms.
- Use the observability facade rather than bypassing it with direct analytics or logging-provider calls.
- Extend existing provider interfaces when changing analytics or logging behavior.
- Preserve the existing application-shell composition and slots.
- Keep client-side processing preferred where it fits the product.
- Preserve mobile and slow-network usability.
- Complete affected component/module specifications before implementing changes to those units.
- Add reusable tool UI primitives only when repeated product behavior demonstrates a shared need.
- Do not introduce magic tool discovery, a universal tool engine, or premature server/catalog infrastructure.

## Current baseline — v0.1.0

Status: Original product foundation; the v0.1.0 baseline remains documented
here while current root package metadata advances independently.

Version 0.1.0 establishes the original product and architecture.

Baseline capabilities include:

- six working utility tools;
- registry-based tool definition and discovery;
- dynamic tool routes;
- category routes;
- home and discovery interfaces;
- tool metadata and SEO generation;
- local persistent storage abstraction;
- recently-used storage behavior at the module level;
- eight-theme registration and runtime application;
- analytics abstraction;
- logging abstraction;
- observability facade;
- error handling;
- PWA/service-worker support;
- health and log API routes;
- Vitest testing infrastructure;
- continuous-integration workflow definitions;
- documentation-first component/module architecture.

## Version 0.1.1 — Development Validation Hardening

Status: Integrated / accepted validation baseline

### Goal

Restore trustworthy development and continuous-integration validation and retire the obsolete repository-local orchestration predecessor before broader product expansion.

### Scope

- Replace the obsolete Next.js lint path with supported ESLint execution.
- Restore the CI test job as a real blocking gate.
- Correct documentation inventory drift.
- Retire the legacy `script/orchestrator.ts` context/agent-invocation system.
- Preserve project-local aggregate validation through `script/verify.ts` and `npm run verify`.
- Keep the four GitHub Actions validation jobs independent.

### Acceptance

v0.1.1 implementation is accepted when:

- type checking, linting, tests, and production build pass;
- CI test failures block the test job;
- the legacy context/ask orchestrator surface is removed;
- `npm run verify` owns aggregate local validation with shared run/report identity;
- current documentation describes the implemented validation model;
- the integration commit is on `master` and all four required CI jobs pass on
  that exact commit.

At v0.1.1 acceptance, publication/release status was separate and root package
metadata remained `0.1.0`.

### Exclusions

v0.1.1 does not add product utilities, browser E2E capability, new categories, product routes, or unrelated architecture.

## Catalog expansion direction

The next product track is the Priority A+B utility catalog.

The architecture investigation at v0.1.1 found the existing explicit registry, routing, metadata, shared tool frame, storage, observability, and SEO architecture suitable for continued catalog growth with incremental evolution. No registry redesign is required before adding the next several dozen lightweight utilities.

Priority A contains 12 new utilities. Priority B contains 12 new utilities. Completing this roadmap through v0.6.0 yields 24 new utilities and 30 total registered utilities including the six-tool baseline.

Priority C and heavier processing utilities are intentionally outside this concrete sequence.

## Version 0.2.0 — Image Utility Foundation

Status: Implementation, exact-SHA readiness, integration, and production
technical launch are complete. Delivery 2 was merged and deployed on 2026-10-04;
root package metadata remains 0.2.0 and the independent dashboard remains 0.1.0.
Manual Google Search Console and Bing Webmaster actions and the later 28-day
measurement review remain operational follow-up. No ranking or traffic change
is claimed.

### Goal

Establish the first substantial new utility family using the existing `image` category and prove the shared file-processing user experience needed by later catalog releases.

### Scope

Priority A utilities:

- Image Resizer
- Image Compressor
- JPG / PNG / WebP Converter
- HEIC → JPG / PNG Converter

The accepted v0.2.0 repository scope also includes explicitly authorized
implementation extensions: the compact discovery/homepage layout and One Dark
material pilot; production-gated AdSense placement; opt-in production
observability; Neon persistence and daily maintenance; and the separate private
observability dashboard. These extend the original image-utility plan without
changing the future catalog sequence. Delivery 1 is implemented and user-approved. Delivery 2 is
implemented, validated, merged, and publicly deployed as cross-version UI and
discovery enabling work; its technical launch is complete. Manual Google Search
Console and Bing Webmaster submissions remain pending owner account access.

### Dependencies

Requires:

- v0.1.1 as the accepted development base;
- the existing `image` category and registry/routing contracts;
- substantive specifications for affected tools/components before implementation;
- browser-level validation sufficient to protect real file-selection, execution, result, download, hydration, and responsive behavior.

Browser E2E capability is enabling implementation infrastructure for this product release. It is not a standalone product-version goal.

### Constraints

- Reuse the existing `ToolDefinition` → registry → `/tool/[slug]` → `ToolClientFrame` → `ToolErrorBoundary` path.
- Prefer client-side processing where browser capability, memory, dependency size, and output fidelity are acceptable.
- Do not introduce a universal file-tool engine.
- Extract shared file-input/result UI only when repeated behavior demonstrates a stable abstraction.
- Heavy image dependencies must not silently degrade unrelated routes.

### Acceptance

v0.2.0 is complete when:

- all four utilities are usable through normal tool routes;
- each tool participates in existing registry, category, discovery, metadata, SEO, error, and observability paths;
- file validation, processing, result, and download behavior is defined and tested;
- required browser-visible behavior has automated evidence;
- repository validation passes;
- documentation matches the shipped contracts.

### Exclusions

- PDF processing
- EXIF tools
- OCR
- background removal
- server-side processing architecture
- registry redesign
- server-side catalog search

### Unresolved planning decisions

Browser E2E implementation, shared ImageFile source primitives, presentation-only
ImageSourcePanel, real HEIC conversion, dedicated worker architecture and
application-level decoder isolation are resolved and validated. The exact
production decoder is `heic-to@1.5.2`.

The HEIC production-license gate is approved. Production observability,
Neon persistence and maintenance, the protected dashboard, and the public
Delivery 2 deployment are live. The Google and Bing webmaster-console actions
remain pending owner access. No indexing, ranking, or traffic result is implied.

## Version 0.3.0 — PDF & Document Essentials

Status: RELEASED AND PUBLICLY DEPLOYED on 2026-10-06.
Application package metadata is 0.3.0. PR #9 merged the release branch to
`master` at `008458651bc8786b46fcc4b27ef119147e1e2579`; GitHub release
`v0.3.0` is published. Production deployment is owner-confirmed. Exact Vercel
deployment metadata remains an operational record and is not guessed here.

Frozen implementation contract: [v0.3.0 implementation plan](plans/v0.3.0-implementation-plan.md).

### Goal

Establish the `document` utility family and provide the highest-priority PDF workflows using the file-processing experience proven in v0.2.0.

### Scope

Priority A utilities:

- PDF → JPG / PNG
- Images → PDF
- Merge PDF
- Split PDF
- Compress PDF

### Dependencies

Requires:

- v0.2.0 file-processing and browser-validation foundation;
- the existing `document` category;
- an approved PDF-processing approach demonstrated to be viable for the planned operations.

### Constraints

- Prefer browser/local processing where it produces acceptable fidelity and resource usage.
- Do not create generic server-processing infrastructure solely because PDF operations are complex.
- Escalate to a server/service boundary only when concrete browser limitations block an approved capability.
- Measure heavy dependency and route-bundle effects before changing component-loading architecture.
- PDF compression must represent meaningful, measurable compression rather than a nominal rewrite.

### Acceptance

v0.3.0 is complete when:

- all five utilities implement their documented operations;
- supported and unsupported file/error cases are explicit;
- outputs preserve the documented fidelity/order/page semantics;
- applicable browser/regression evidence passes;
- existing registry/routing/discovery architecture remains authoritative;
- repository validation and documentation reconciliation pass.

### Exclusions

- OCR
- PDF editing
- PDF signing
- Office-document conversion
- cloud file storage
- user accounts
- generic background-job infrastructure

### Unresolved planning decisions

NONE THAT BLOCK IMPLEMENTATION. The frozen plan resolves dependency/runtime
selection, resource limits and browser-local processing for all five operations;
SERVER_BOUNDARY: NOT_REQUIRED. Ordinary batch-local engineering details remain
constrained by the [implementation plan](plans/v0.3.0-implementation-plan.md).

## Version 0.3.1 — Vercel Web Analytics

Status: RELEASED AND PUBLICLY DEPLOYED — 2026-10-06.

Frozen implementation contract:
[v0.3.1 implementation plan](plans/v0.3.1-implementation-plan.md).

The readiness-passed candidate was
`3d0dc49a9f850f35f4b75709aa8cffa50768c49d`; release preparation produced
`f0b26c00852fe048cb15839ddfc59504a8453de4`. PR #10 merged v0.3.1 to
`master` at `2c8c1dec611b228a73137c5ee8ae0a5cd60caab0`. The exact merged
source is deployed to the public `iworkhere-space` Vercel project, Web
Analytics is enabled for Production only, live query/hash redaction and
file-input privacy passed, and tag/GitHub Release `v0.3.1` are published.
Detailed production evidence is in
[the launch report](reports/V0_3_1_VERCEL_WEB_ANALYTICS_LAUNCH_REPORT.md).

### Goal

Add Vercel Web Analytics to the public `iworkhere-space` project as a bounded
traffic-measurement integration without changing the utility catalog or
replacing the existing application observability system.

### Scope

- automatic page views and client-side navigation traffic through
  `@vercel/analytics` version 2;
- one app-owned Analytics wrapper composed from the root layout;
- explicit production-only opt-in;
- `beforeSend` sanitization that removes query strings and URL fragments before
  transmission;
- preservation of the existing analytics facade, Neon metrics, Web Vitals,
  diagnostics and protected observability dashboard;
- focused unit/browser/container validation and normal release/deployment
  validation.

### Dependencies

Requires:

- released and deployed v0.3.0;
- the existing analytics/observability abstractions;
- the public `iworkhere-space` Vercel project;
- Web Analytics enabled in that Vercel project before the first
  Analytics-enabled production deployment.

### Constraints

- Do not add a second application-domain event system.
- Do not call Vercel `track()` from tools in v0.3.1.
- Do not send file/input/output data, query strings, fragments, raw diagnostics,
  storage/authentication data or object URLs to Vercel Analytics.
- Preview, Development, local E2E and container validation remain disabled by
  default.
- Provider-specific imports remain isolated behind an app-owned wrapper.
- Do not change the independent protected dashboard project.
- Do not combine this infrastructure release with v0.4 catalog implementation.

### Acceptance

The implementation scope is complete when:

- an exact compatible `@vercel/analytics` v2 release is pinned;
- automatic page views work for initial loads and client navigation without
  duplicate wrappers/manual page-view calls;
- production activation is explicit and default-off elsewhere;
- outgoing Analytics URLs contain no application query/hash data;
- no Vercel custom events are emitted;
- the existing application observability/Neon/diagnostic contracts continue to
  pass;
- full repository validation passes;
- the exact release candidate passes the separate pre-release readiness and
  production smoke stages;
- the package version is bumped to 0.3.1 only during release preparation.

### Exclusions

- new utilities;
- Vercel custom events;
- Speed Insights;
- Vercel Web Analytics API ingestion;
- analytics replication into Neon;
- analytics cards in the private dashboard;
- Google Analytics;
- session replay;
- analytics-provider replacement;
- advertising changes.

This release does not alter the planned v0.4.0–v0.6.0 catalog sequence.

## Version 0.4.0 — Core Text, Data & Sharing Utilities

Status: Released on 2026-10-08. PR #21 merged v0.4.0 into `master` at
`b619920048239e1b60ea20c4db5a4d0f01bdcd39`; annotated tag `v0.4.0`
and the GitHub Release refer to that commit. The implementation plan was frozen
2026-10-07. Live deployment evidence remains separate from release identity.

Frozen plan: [v0.4.0 implementation plan](plans/v0.4.0-implementation-plan.md).

### Goal

Complete the Priority A catalog with lightweight, frequently used browser utilities and resolve the durable category model needed by the upcoming developer-tool family.

### Scope

Remaining Priority A utilities:

- JSON Formatter / Validator
- Word / Character Counter
- QR Code Generator

At completion of v0.4.0, all Priority A utilities are implemented.

### Dependencies

Requires:

- stable tool/catalog contracts from earlier releases;
- the bounded pre-v0.4 canonical-host configuration check, now complete
  (2026-10-07): Vercel permanently redirects `www.iworkhere.space` and HTTP
  variants to the canonical HTTPS apex host with no parallel application
  redirect layer; Google recrawl/index inclusion continues as measurement and
  does not block v0.4 unless it reveals a real canonical production defect;
- the category decision for developer-oriented utilities, now resolved (see
  below).

### Constraints

- JSON formatting/validation must preserve data semantics and report parse errors explicitly.
- Word/character metrics must have deterministic documented definitions.
- QR generation should begin with approved core input modes rather than an unbounded specialized QR suite.
- If a `developer` category is introduced, category identity must have one canonical owner rather than duplicated hardcoded lists.

### Acceptance

v0.4.0 is complete when:

- all three utilities are routed, registered, discoverable, documented, and tested through existing contracts;
- the selected category model is canonical and covered by contract tests;
- Priority A catalog completion is reflected in current-state documentation;
- repository validation passes.

### Exclusions

- recommendation algorithms
- personalized ranking
- broad discovery redesign
- analytics-provider replacement
- server persistence

### Resolved planning decisions

- `developer` becomes a canonical `ToolCategory`, with one canonical runtime
  category-definition owner (no duplicated category lists);
- JSON Formatter / Validator belongs to `developer`;
- Word / Character Counter belongs to `text`; QR Code Generator belongs to
  `everyday`; no existing tool moves.

The three-tool v0.4.0 scope and the exclusions above are unchanged. Detailed
contracts, dependency decision, batch structure and test responsibilities live
in the [frozen implementation plan](plans/v0.4.0-implementation-plan.md).

## Version 0.5.0 — Developer & Text Utility Suite

Status: Planned

### Goal

Build the main Priority B developer/text utility family using the existing registry, metadata, route, shared UI, storage, and observability contracts.

### Scope

Priority B utilities:

- Password Generator
- UUID Generator
- Base64 Encode / Decode
- URL Encode / Decode
- JWT Decoder
- Regex Tester
- Text Diff
- Markdown → HTML
- Hash Generator

### Dependencies

Requires:

- the category decision from v0.4.0;
- stable shared tool UX and browser-validation infrastructure;
- existing catalog/discovery architecture.

### Constraints

- Security-sensitive utilities must state their actual guarantees.
- Password generation must use cryptographically appropriate randomness.
- JWT decoding must not be presented as signature verification.
- Hash algorithms must identify relevant security limitations.
- Markdown rendering must have an explicit safe-rendering boundary.
- Regex execution must not knowingly expose the primary UI to uncontrolled pathological execution.
- Do not create a separate developer-tool registry or routing framework.

### Acceptance

v0.5.0 is complete when:

- all nine utilities use the canonical category, registry, routing, discovery, metadata, SEO, and validation paths;
- transformation/security semantics are explicit and covered by tests;
- browser-visible workflows have proportionate browser evidence;
- repository validation passes;
- current documentation accurately describes the developer/text catalog.

### Exclusions

- code execution sandboxes
- secret storage
- JWT signing infrastructure
- authentication
- cloud developer workspaces
- generic plugin systems

## Version 0.6.0 — Time & Everyday Calculators

Status: Planned

### Goal

Complete the Priority B catalog with common time/date and percentage utilities while reusing the existing `time` and `math` architecture.

### Scope

Priority B utilities:

- Timestamp / Date Converter
- Age Calculator
- Percentage Calculator

At completion of v0.6.0:

- Priority A is complete;
- Priority B is complete;
- 24 new catalog utilities have been added;
- the product contains 30 registered utilities in total, assuming the six-tool baseline remains.

### Dependencies

Requires:

- the preceding catalog releases;
- established shared UI, browser-validation, registry, metadata, and testing conventions.

### Constraints

- Date/time utilities must make timezone, unit, and calendar semantics explicit.
- Ambiguous date/time input must not be silently reinterpreted.
- Percentage operations should remain one coherent utility unless future product/SEO evidence justifies separate pages.
- Reuse existing calculation/time patterns rather than create another calculation framework.

### Acceptance

v0.6.0 is complete when:

- all three utilities are implemented through existing architecture;
- Priority A+B catalog completion is documented;
- tests cover defined date/time/calculation semantics;
- repository validation passes;
- a post-catalog architecture checkpoint is completed before planning substantially larger catalog expansion.

### Exclusions

- scheduling services
- calendar/account integration
- financial calculators outside separately approved scope
- server-backed saved history

## Post-v0.6 catalog architecture checkpoint

After the 30-tool A+B catalog is complete, reassess the current architecture before planning a much larger catalog.

The checkpoint should inspect measured evidence for:

- registry size and static import fan-in;
- production route/client bundle output;
- catalog payload size;
- search/filter responsiveness;
- build time;
- shared-tool UI maturity;
- storage-key ownership/versioning needs;
- SEO crawl/discovery infrastructure;
- dependency cost of file-processing tools.

This checkpoint does not presume a redesign. The v0.1.1 architecture investigation found the current architecture appropriate for the next several dozen utilities and identified larger-scale catalog/search/component-loading evolution as a later evidence-driven concern.

## Cross-version enabling work

The following capabilities support product versions and should be implemented when the first owning product version needs them. They are not standalone product versions in this roadmap.

### Browser end-to-end validation

Browser-level validation is implemented in v0.2.0 with separate production desktop/mobile Chromium and CI gates. Extend it proportionately for later browser-visible releases.

Static/unit checks must not be presented as browser proof when the acceptance requirement is browser-visible behavior.

### Shared tool UI primitives

The platform may gain shared file-input, result, download, text-output, validation, or action primitives as repeated implementations demonstrate stable common behavior.

Do not pre-design a universal tool engine or speculative component hierarchy.

### Bundle and dependency measurement

Measure production bundle/dependency impact when image/PDF/developer tools introduce materially heavier dependencies. Do not change registry/component-loading architecture without evidence.

### SEO/catalog growth support

Existing per-tool/category metadata is a foundation, not evidence that discovery is complete. The 2026-10-01 repository review identified script-button catalog navigation, an inactive header search field, minimal tool-page presentation, and no sitemap/robots implementation in the inspected app/public listings.

The bounded discovery work subsequently added crawlable links, server-rendered
guide content, metadata/canonical consistency, and a registry-derived
sitemap/robots policy. After the v0.3 document family, the live sitemap contains
23 canonical HTTPS apex URLs. A 2026-10-07 Search Console redirect notice was
investigated: the known redirected variants are intentional HTTP/HTTPS and
trailing-slash normalization, while all 23 current sitemap URLs passed a live
direct-200, indexable, self-canonical audit. The current sitemap was re-submitted
to Google for re-download. The remaining pre-v0.4 infrastructure check is to
verify the Vercel `www` → apex redirect because Google retains historical
`www` crawl/index evidence. Search-engine recrawl and index inclusion remain
measurement, not a product-version gate unless they expose an actual canonical
production defect.

See [UI, discovery, and measured growth](plans/ui-discovery-growth-plan.md) and
the [pre-v0.4 indexing checkpoint report](reports/PRE_V0_4_INDEXING_CHECKPOINT_2026-10-07.md)
for the bounded operational evidence and remaining follow-up.

This changes the priority of a bounded discovery subset, not the catalog version sequence. Broader ranking/recommendation systems, new analytics vendors, and server-backed search remain deferred. Neither search eligibility nor modern styling guarantees rankings, traffic, or LLM citations.

### Near-term UI and discovery pilot

Status: Delivery 1 is implemented and user-approved. Delivery 2 is implemented,
validated, merged, and publicly deployed. Delivery 3 technical launch is
complete. Google Search Console now has the production sitemap submitted and
re-submitted after the catalog expanded to 23 canonical URLs; canonical recrawl
and indexing remain under observation. Bing Webmaster submission and the later
measurement review remain operational follow-up.

Goal: make the existing tools more useful and visually distinct before expanding the amount of redesign work. Start with the homepage and Image Resizer, proposing compact top navigation and a settings-plus-preview workspace rather than repeating the existing permanent-sidebar composition. Preserve the registry, routes, themes, local-processing/privacy contracts, and existing banner decisions unless explicitly revised.

Delivery 2 extends the accepted pattern across the other three image tools and
adds the bounded search foundation above. Its public production technical
launch completed on 2026-10-04. Google Search Console sitemap submission has
since been completed and the current 23-URL sitemap was re-submitted on
2026-10-07 after redirect/canonical verification. Bing Webmaster submission
remains operational follow-up; measurement is future evidence collection, and
owned-site distribution remains a separate optional task. The owner approved
the HEIC production-license gate for v0.2.0.

The [detailed plan](plans/ui-discovery-growth-plan.md) owns this enhancement's delivery boundaries. It is not a retroactive v0.2 implementation plan or a new numbered catalog version. No new utility, bulk processing, target-size compression, generic file framework, large content program, or AI-specific integration is added to the first delivery.

## Documentation and specification debt policy

The repository currently contains a substantial generated component/module specification layer, including many thin stubs.

This debt must not become a standalone requirement to rewrite every specification before productive work can continue.

The rule remains:

> Complete the specification for an affected component or module before that unit enters implementation scope.

Therefore:

- targeted specification completion is part of version preparation;
- unrelated stubs remain outside the version;
- global completion of all stubs is not a planned catalog release;
- generated inventory artifacts are not canonical product plans;
- each version implementation plan should identify only the affected specification owners.

## Theme specification debt

The application currently supports four theme selections:

- system
- light
- dark
- onedark

Theme implementation is functional. Theme/design documentation must remain current before future visual-system behavior changes.

No standalone catalog version is assigned solely to theme documentation debt.

## Planned work — Version TBD

The following planned items remain preserved but are not assigned to the concrete Priority A+B version sequence.

They must not be silently folded into a catalog version without an explicit planning decision.

### HTTP security-header hardening

A security-header policy remains planned.

Before assignment to a version, define the exact policy, owner, environment differences, compatibility requirements, and validation evidence. This work is likely to become relevant when network/server-backed capabilities materially expand.

### Recently-used tool integration

The recently-used module exists but requires product/UI ownership before its runtime integration or presentation is scheduled.

Do not add a recently-used UI surface without an explicit product decision.

### Metadata and discovery enrichment

Tags/popularity support exists in the current architecture, but consumer/ranking/featured semantics remain unresolved.

Do not introduce recommendation/ranking behavior until the consumer surface and semantics are explicitly defined.

The near-term UI/discovery plan defines only functional search entry, real destination links, populated-category discovery, a curated image-tool group without popularity claims, related image-tool links, and basic SEO. It does not authorize personalized ranking, a new recommendation engine, or the full deferred enrichment workstream.

### RustLogProvider startup activation

The provider and `/api/log` endpoint exist. Startup owner, environment behavior, network/privacy expectations, fallback behavior, and validation remain unresolved.

### About page

An About page remains a valid product/content candidate, but its content, route placement, navigation role, and SEO contract are not yet defined.

### Analytics provider swap

The analytics abstraction still supports a future replacement of the provider
used for application-generated events. That work remains deferred. The planned
Vercel Web Analytics integration is explicitly additive traffic analytics; it
does not authorize replacing the existing analytics/observability providers or
duplicating canonical tool events.

### Advertising provider integration

Advertising placeholders exist, but provider, privacy, loading, security, responsive, failure, and slot behavior are unresolved.

### Server-side storage backend

The current storage abstraction is browser-backed. Any durable/server-backed evolution requires explicit decisions for backend technology, state ownership, migration, synchronization, authentication relationship, offline behavior, and compatibility.

### Authentication

Authentication is not required for the Priority A+B catalog. It requires separate product/security/API/state planning before version assignment.

### Payments

Payments remain future/unresolved and require independent provider, business, authentication, API, and security decisions before version assignment.

## Future catalog candidates outside Priority A+B

The following previously researched candidates are intentionally outside this concrete sequence:

- EXIF Viewer / Remover
- Image → Text / OCR
- Background Remover
- MP4 → MP3

These are not canceled. They remain future candidates for a later catalog planning cycle, especially because several introduce heavier processing/runtime/service concerns.

## Version sequence

The current concrete product sequence is:

```text
v0.1.0  Current product baseline

v0.1.1  Development Validation Hardening
        integrated / accepted validation baseline
        ↓
v0.2.0  Image Utility Foundation
        ↓
v0.3.0  PDF & Document Essentials
        ↓
v0.3.1  Vercel Web Analytics (released 2026-10-06)
        ↓
v0.4.0  Core Text, Data & Sharing Utilities (released 2026-10-08)
        Priority A complete
        ↓
v0.5.0  Developer & Text Utility Suite
        ↓
v0.6.0  Time & Everyday Calculators
        Priority A+B complete
```

Items under **Planned work — Version TBD** and **Future catalog candidates outside Priority A+B** remain outside this sequence until explicitly assigned.

## Cross-version dependencies

### Validation foundation

v0.1.1 is the prerequisite development baseline for later implementation work.

### Documentation-first implementation

Every implementation version must inspect current repository state, use current my-dev-kit evidence before source/test edits, and complete affected specifications before production implementation.

This does not require global completion of unrelated stubs.

### Browser evidence

v0.2.0 establishes the browser-validation capability required by the first file-processing product workflows. Later versions extend that evidence only as needed.

### Architecture preservation

Later versions must continue to use established owners:

- tool registration → `ToolDefinition` / `tool_definition_list`;
- tool queries → metadata layer;
- persistence → storage abstraction;
- themes → existing theme registry/storage/runtime;
- logging → existing log/provider abstraction;
- analytics → existing analytics abstraction;
- tool lifecycle → `ToolClientFrame`;
- observability → observability facade;
- layout → `AppShell`;
- navigation → explicit navigation data;
- SEO → registry metadata and existing SEO helpers.

Refresh architecture assimilation before implementation when a version introduces a new canonical state store, new persistence architecture, major route/state redesign, new framework/service boundary, new public contract family, major subsystem replacement, or substantial repository restructuring.

### Catalog-scale architecture evolution

Do not redesign the registry/search/component-loading architecture merely because the catalog is growing.

Measure first. The post-v0.6 checkpoint decides whether further evolution is justified.

## Global validation expectations

Every implementation version must preserve the repository's required validation chain.

At minimum:

- type checking passes;
- linting passes;
- unit/contract/integration tests pass;
- browser tests pass when the version's acceptance depends on browser-visible behavior;
- production build passes;
- `npm run verify` passes;
- documentation is reconciled with implemented behavior;
- affected component/module specifications match the final implementation.

A version is not release-ready merely because implementation code is complete. Implementation completeness, documentation reconciliation, readiness, release/integration, and publication/deployment remain separate workflow states.

## Roadmap boundaries

This roadmap does not authorize a coding agent to:

- invent behavior for any listed utility;
- prewrite implementation batches for future versions;
- add Priority C utilities to the Priority A+B sequence;
- introduce new categories without resolving the documented planning decision;
- introduce server processing merely because browser processing is inconvenient;
- implement Version-TBD work without explicit assignment;
- select external analytics, advertising, storage, OCR, background-removal, or media providers;
- implement authentication or payments;
- complete unrelated specification stubs;
- reorganize the version sequence without an explicit planning decision.

Where a version has unresolved planning decisions, resolve them before its implementation plan is frozen.

## Next planning action

v0.4.0 was merged, tagged, and published as a GitHub Release on
2026-10-08. The root application package is `0.4.0` (private; no npm
publication); the independent dashboard remains `0.1.0`. The next catalog
implementation is **v0.5.0 — Developer & Text Utility Suite**. Before coding,
inspect the released implementation, obtain a fresh my-dev-kit index and
bounded owner/contract/test evidence, resolve security/runtime and UX
contracts for the nine agreed utilities, then create and freeze
`docs/plans/v0.5.0-implementation-plan.md`. That plan must contain bounded
implementation batches, applicable use-case and browser acceptance, tests,
dependencies, and exclusions. Do not invent the batch sequence in this roadmap.
Release tagging does not on its own verify the resulting production deployment.

Historical v0.3.1 scope and decisions remain in the
[frozen plan](plans/v0.3.1-implementation-plan.md) and
[implementation report](reports/V0_3_1_VERCEL_WEB_ANALYTICS_IMPLEMENTATION_REPORT.md).

Delivery 1 is implemented and user-approved. Delivery 2 is implemented,
validated, merged, and publicly deployed. Delivery 3 technical launch is
complete. Remaining operational follow-up is owner-authenticated Google Search
Console and Bing Webmaster sitemap/priority-URL work, followed by the planned
28-day measurement review. These steps do not imply ranking or traffic
improvement. Current v0.3.0 production state is recorded in project-status.md.

Historical v0.2 implementation and exact-SHA readiness record: the eight hosted
workflows passed at 339091c5aaf4ad31be656756a7f4e4c121cc37de on the immutable
validation/v0.2.0-heic-license-339091c5 ref. The owner approved the HEIC
production-license gate. Root package metadata remained 0.2.0; dashboard package
metadata remained independently versioned at 0.1.0.

Historical process debt: the referenced
`docs/plans/v0.2.0-implementation-plan.md` is absent from the repository and its
available history. No retroactive version plan was created. Future versions
should freeze their implementation plan before coding prompts are issued.
