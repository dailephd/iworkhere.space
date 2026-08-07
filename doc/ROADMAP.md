# Roadmap

## Overview

`iworkhere.space` is a documentation-first, registry-driven utility-tool platform built with Next.js, React, and TypeScript.

The current repository package version is `0.1.0`.

The existing implementation provides:

* six registered tools:

    * Slugify Text
    * HTML Text Extractor
    * Calculator
    * Length Converter
    * Weight Converter
    * Time Arithmetic
* registry-driven tool discovery and routing
* category and discovery/search surfaces
* query-state sharing for supported tools
* an eight-theme system with persistence and system fallback
* analytics, logging, observability, and error-capture abstractions
* persistent browser storage through the existing storage adapter
* `/api/health`
* `/api/log`
* Progressive Web App and service-worker support
* responsive shared application layout
* Vitest-based automated testing
* documentation-first component and module specifications

Future development must preserve the existing architecture rather than adding parallel owners, registries, state systems, persistence paths, provider systems, or routing abstractions.

The roadmap follows this general development sequence:

```text
version goal
→ affected project-level documentation
→ affected component/module specifications
→ implementation
→ behavior-derived tests
→ documentation reconciliation
→ validation
→ release preparation
```

Component and module specifications are implementation contracts. When a version affects a component or module whose specification is currently a stub, that specification must be completed before production implementation begins.

The roadmap records version goals, planned capability scope, dependencies, exclusions, and high-level status. Detailed implementation batches and execution reports belong outside this document.

## Product principles

Future versions must preserve the following established principles:

* Keep the architecture explicit and predictable.
* Prefer composition over speculative abstraction.
* Preserve the existing four-layer structure:

    * `src/app`
    * `src/module`
    * `src/component`
    * `src/lib`
* Keep route files focused on routing and composition.
* Keep browser APIs inside client components, effects, or handlers.
* Keep tool/domain logic out of `src/app`.
* Preserve the rule that `src/lib` does not import from `src/module`.
* Keep `ToolDefinition` and `tool_definition_list` authoritative for tool registration.
* Put cross-tool derived queries in the existing metadata layer.
* Use the existing storage abstraction rather than direct parallel `localStorage` access.
* Use the existing theme registry, storage, and runtime mechanisms.
* Use the observability facade rather than bypassing it with direct analytics or logging-provider calls.
* Extend the existing provider interfaces when changing analytics or logging behavior.
* Preserve the existing application-shell composition and slots.
* Keep client-side processing preferred where it fits the product.
* Preserve mobile and slow-network usability.
* Document architecture, schema, style, and component/module contracts before implementing changes that alter them.

## Current baseline — v0.1.0

Status: Current repository baseline

Version 0.1.0 establishes the current product and architecture.

Current capabilities include:

* six working utility tools
* registry-based tool definition and discovery
* dynamic tool routes
* category routes
* home and discovery interfaces
* tool metadata and SEO generation
* local persistent storage abstraction
* recently-used storage behavior at the module level
* eight-theme registration and runtime application
* analytics abstraction
* logging abstraction
* observability facade
* error handling
* PWA/service-worker support
* health and log API routes
* Vitest testing infrastructure
* continuous-integration workflow definitions
* documentation-first component/module architecture

Known baseline defects and debt are addressed by the following versions rather than being silently folded into unrelated feature work.

## Version 0.1.1 — Development Validation Hardening

Status: Planned

### Goal

Restore trustworthy development and continuous-integration validation before larger feature work proceeds.

The current repository has two validation defects:

* `npm run lint` invokes the removed Next.js `next lint` command and fails under Next.js 16.1.0.
* the GitHub Actions test workflow uses `continue-on-error: true`, even though the documented continuous-integration policy says required tests must pass.

These defects affect validation of every later implementation and should be corrected before broader feature development.

### Planned scope

#### Lint command correction

* Replace the obsolete `next lint` execution path with the supported lint mechanism already compatible with the repository's ESLint configuration and dependencies.
* Preserve existing linting intent rather than weakening or bypassing lint rules.
* Update user/developer commands that refer to the obsolete lint invocation.
* Ensure local and continuous-integration lint execution use the same supported contract.

#### Continuous-integration test-gate correction

* Make test failures fail the test job.
* Remove or correct the current non-blocking behavior caused by `continue-on-error: true`.
* Preserve the existing separation of validation jobs unless a narrowly required correction is necessary.
* Verify that a failing test produces a failing continuous-integration result.

#### Documentation consistency correction

Correct the known inventory drift:

* component/module specification total: 46
* component specifications: 19
* module specifications: 27
* substantive specifications: 10
* stub specifications: 36

Update only documentation that owns these current-state facts.

### Documentation prerequisites

Review and update as applicable:

* `README.md`
* `doc/CI_CD.md`
* `doc/TESTING.md`
* `doc/doc_index.md`
* development/orchestration command documentation

No component or module specification is required solely for the lint or continuous-integration correction.

### Acceptance boundaries

Version 0.1.1 is complete when:

* the supported lint command executes successfully on the current project;
* lint remains a real validation gate rather than being suppressed;
* automated test failures fail the relevant continuous-integration job;
* type checking still passes;
* all existing tests still pass;
* production build still passes;
* documentation accurately describes the validation commands and gates;
* the documentation inventory reports the actual component/module specification counts.

### Explicit exclusions

Version 0.1.1 does not include:

* Playwright
* application features
* new tools
* recently-used integration
* metadata/featured behavior
* logging-provider activation
* security-header policy
* About page
* global completion of all specification stubs
* package/provider architecture changes

## Version 0.2.0 — Browser End-to-End Validation Foundation

Status: Planned

### Goal

Implement the browser-level automated testing capability already specified in `doc/TESTING.md` before expanding the application with additional tool, route, and layout behavior.

The existing automated suite is Vitest-based. Browser end-to-end testing is explicitly planned but not currently implemented.

### Planned scope

#### Playwright foundation

* Add the required Playwright testing dependency and configuration.
* Define the local application/server lifecycle used by browser tests.
* Add a stable project command for running browser tests.
* Ensure the browser suite can run reproducibly in the project's supported development and continuous-integration environments.

#### Browser test coverage

Establish representative browser coverage for the behavior already identified by the testing specification:

* application routing
* tool-page rendering
* primary tool interaction where appropriate
* responsive layout behavior
* hydration/runtime browser warnings where the selected testing mechanism can detect them
* service-worker or Progressive Web App behavior where reliably testable within the adopted browser-test environment

The implementation must not claim browser coverage beyond what the actual tests verify.

#### Continuous-integration integration

* Add the browser suite to the documented validation workflow.
* Ensure browser-test failures are visible and blocking wherever the documented testing policy requires them to be blocking.
* Keep browser setup and generated output out of committed project artifacts unless explicitly required.

### Documentation-first prerequisites

Before browser tests are used as acceptance contracts for a particular component or module, the corresponding behavioral specification must be substantive.

Complete only the specifications needed by the initial browser suite.

Do not complete all 36 current stubs merely because Playwright is being introduced.

Likely affected project documentation includes:

* `doc/TESTING.md`
* `doc/CI_CD.md`
* relevant workflow/development documentation

Likely lower-level specifications depend on the exact initial browser scenarios selected during implementation planning.

### Dependencies

Requires:

* v0.1.1 Development Validation Hardening

### Acceptance boundaries

Version 0.2.0 is complete when:

* Playwright is installed and configured;
* the documented browser-test command executes successfully;
* representative browser tests exercise the selected existing user flows;
* browser-test failures produce the expected failing validation result;
* continuous integration runs the required browser suite;
* browser-generated output is handled according to repository hygiene policy;
* existing Vitest tests continue to pass;
* type checking, linting, and build validation remain green;
* testing and continuous-integration documentation describe actual implemented behavior.

### Explicit exclusions

Version 0.2.0 does not include:

* new product tools
* new product routes solely to create test targets
* recently-used implementation changes
* metadata feature changes
* logging-provider activation
* auth
* payments
* ad-provider integration
* analytics-provider replacement
* server-side storage

## Version 0.3.0 — Additional Tools End-to-End

Status: Planned — requires tool selection before implementation

### Goal

Expand the utility catalog with additional tools in the already planned document, image, and time categories.

The exact tools have not yet been selected. This version must not enter implementation until the concrete tool list and behavior are approved.

### Definition gate

Before implementation planning for this version:

* select the exact tools to add;
* define each tool's purpose;
* define input and output behavior;
* define validation/error behavior;
* determine whether URL query-state sharing applies;
* determine category placement;
* define SEO metadata;
* write a substantive specification for each selected tool.

Do not infer tool requirements from category names alone.

### Planned capability scope

For every approved tool:

* implement the tool component according to its approved specification;
* use `ToolComponentProp`;
* register the tool explicitly in `tool_definition_list`;
* preserve registry uniqueness and canonical slug behavior;
* provide required category/capability metadata;
* integrate with existing metadata/SEO infrastructure;
* use existing observability/error-handling patterns;
* add behavior-derived unit tests;
* add registry/metadata contract coverage as needed;
* add browser coverage consistent with the implemented v0.2.0 testing policy.

### Architecture constraints

New tools must extend:

* the existing tool registry;
* the existing tool type contract;
* the existing metadata layer;
* the existing tool rendering path;
* the existing observability and error-handling mechanisms.

Do not introduce:

* a second tool registry;
* reflection-based or magic registration;
* a parallel tool routing mechanism;
* a new general state system solely for individual tools;
* direct persistence or provider access that bypasses established abstractions.

### Documentation prerequisites

Update affected project-level documents as required:

* project status
* architecture
* API
* schema
* testing
* styling when the tool introduces new UI requirements

Create one substantive component specification for every selected new tool before implementation.

Complete existing Registry, Metadata, Type, or related specifications only where they are required by the selected tool changes.

### Dependencies

Requires:

* v0.1.1 Development Validation Hardening
* v0.2.0 Browser End-to-End Validation Foundation
* exact tool selection and approved tool specifications

### Acceptance boundaries

Version 0.3.0 is complete when:

* every selected tool has an approved specification;
* every selected tool is implemented through the existing registry architecture;
* the selected tools are reachable through their intended routes/categories;
* registry and metadata contracts remain valid;
* relevant unit tests pass;
* relevant browser tests pass;
* typecheck, lint, full tests, and build pass;
* documentation reflects only the tools actually shipped.

### Explicit exclusions

Unless separately approved as part of the version definition, v0.3.0 does not include:

* metadata featured/ranking redesign
* analytics-provider replacement
* advertising-provider integration
* server-side storage
* auth
* payments
* broad theme-system changes

## Version 0.4.0 — HTTP Security Header Hardening

Status: Planned — policy definition required before implementation

### Goal

Implement the explicitly planned HTTP security-header capability through the project's existing Next.js application/configuration architecture.

### Definition gate

Before implementation begins, document and approve:

* the exact security-header policy;
* the configuration owner;
* environment-specific differences, if any;
* compatibility requirements;
* validation expectations.

Do not guess a header set from generic web recommendations and present it as project policy.

### Planned scope

* Implement the approved HTTP security-header policy in the established configuration/application layer.
* Preserve existing routing and response behavior unless the approved security policy explicitly changes it.
* Add automated or reproducible validation for the configured headers.
* Update security/API/architecture/continuous-integration documentation as applicable.

### Dependencies

Requires:

* v0.1.1 Development Validation Hardening
* approved security-header policy

Browser-level validation from v0.2.0 may be reused when appropriate but must not replace direct validation of response headers.

### Acceptance boundaries

Version 0.4.0 is complete when:

* the approved headers are emitted on the intended response surfaces;
* tests or other deterministic validation prove the configured policy;
* existing routes continue to work;
* typecheck, lint, tests, and build pass;
* documentation accurately records the implemented policy and its boundaries.

### Explicit exclusions

Version 0.4.0 does not include:

* authentication
* authorization
* payments
* general security architecture redesign
* server-side storage
* advertising-provider integration
* unrelated API changes

## Version 0.5.0 — Recently Used Tool Tracking Integration

Status: Planned

### Goal

Complete the existing recently-used capability by wiring the already implemented recording behavior into the existing shared tool-open lifecycle.

The module-level recent-tool behavior already exists but has no production caller.

### Planned scope

#### Specification completion

Complete `doc/components/ToolClientFrame.md` before production implementation.

The specification must define:

* ToolClientFrame's shared tool-open lifecycle responsibility;
* observability behavior;
* recently-used recording behavior;
* persistence interaction through the existing storage abstraction;
* failure behavior;
* applicable test expectations.

Preserve the substantive existing specifications for:

* RecentlyUsed
* Storage

#### Runtime integration

Extend the existing `ToolClientFrame` tool-open lifecycle to invoke the existing recent-tool recording behavior when a tool is opened.

Preserve:

* current `tool_opened` observability behavior;
* the existing `recordRecentTool` contract;
* ordered recent slugs;
* deduplication behavior;
* maximum of 10 entries;
* storage key `recent-tool`;
* storage abstraction ownership.

### Architecture constraints

Do not:

* create a second recently-used store;
* write directly to `localStorage`;
* move the behavior into unrelated home/discovery components;
* add a recent-tools display surface without a separate approved product requirement.

The current plan is to record recently opened tools. A user-interface display for that data is not currently specified.

### Dependencies

Requires:

* v0.1.1 Development Validation Hardening
* completion of `ToolClientFrame.md`

May reuse browser validation introduced in v0.2.0.

### Acceptance boundaries

Version 0.5.0 is complete when:

* opening a tool records the tool through the existing recent-tool module;
* existing deduplication/order/cap behavior is preserved;
* persistence continues through the existing storage adapter;
* existing observability behavior remains intact;
* focused integration/regression tests protect the new wiring;
* browser validation is added where useful under the established testing policy;
* typecheck, lint, tests, and build pass;
* affected documentation matches implemented behavior.

### Explicit exclusions

Version 0.5.0 does not include:

* a recently-used user-interface panel
* home-page recently-used rendering
* discovery-page recently-used rendering
* new persistence architecture
* server-side recent-tool synchronization

Those require separate product decisions.

## Version 0.6.0 — Tool Metadata and Discovery Enrichment

Status: Planned — product definition required before implementation

### Goal

Complete the existing planned tool metadata expansion without duplicating data already present in the registry.

Current implementation already provides:

* tags for all six current tools;
* popularity metadata for all six current tools;
* metadata query functions;
* no production consumers of the tag/popularity queries;
* no `featured` field.

The future plan therefore requires clarification before implementation rather than simply "adding tags and popularity" again.

### Definition gate

Before implementation begins, decide:

* the intended meaning of `featured`;
* whether `featured` becomes part of the canonical `ToolDefinition` contract;
* which surface consumes tags;
* which surface consumes popularity;
* which surface consumes featured state;
* whether these values affect discovery filtering, ranking, home-page presentation, another interface, or a defined combination;
* expected sorting/filtering behavior;
* acceptance criteria.

Do not assume `HomeClient`, `DiscoverClient`, or another component is the intended consumer until the product decision is made.

### Planned scope

Once the product definition is approved:

* update the canonical tool metadata/type contract only where necessary;
* preserve registry ownership of canonical tool metadata;
* preserve `metadata.ts` as the cross-tool derived-query layer;
* implement the approved consumer behavior;
* complete affected component/module specifications before coding;
* extend registry and metadata tests;
* add integration/browser tests for the approved user-facing behavior.

### Documentation prerequisites

At minimum review:

* API
* schema
* architecture
* project status

Complete affected lower-level specifications, including `Type.md` and whichever consumer specification is selected.

### Dependencies

Requires:

* approved metadata/consumer product definition
* v0.1.1 Development Validation Hardening
* applicable component/module specification completion

If the approved behavior changes discovery/browser interaction substantially, use the v0.2.0 browser-test infrastructure.

### Acceptance boundaries

Version 0.6.0 is complete only when:

* the canonical metadata contract is explicit;
* existing tags/popularity data are not redundantly duplicated;
* `featured`, if retained by the approved design, has one canonical definition;
* intended consumers use the existing registry/metadata architecture;
* filtering/ranking/presentation behavior is covered by tests;
* documentation describes actual behavior rather than the earlier ambiguous plan.

### Explicit exclusions

Until separately approved, this version does not include:

* analytics-provider replacement
* ad-provider integration
* arbitrary recommendation algorithms
* server-side ranking/storage
* user-personalized ranking

## Version 0.7.0 — RustLogProvider Startup Activation

Status: Planned — startup and privacy contract required before implementation

### Goal

Complete the existing logging-provider capability by activating the already implemented `RustLogProvider` through the established provider-swap architecture.

The provider implementation, `/api/log` endpoint, logger abstraction, and `setLogProvider` extension point already exist. Startup activation is missing.

### Definition gate

Before implementation begins, document and approve:

* the client/server startup owner;
* when the provider is activated;
* environment-specific behavior;
* failure behavior;
* privacy/consent expectations where applicable;
* network behavior;
* fallback behavior.

Do not invent a startup mechanism merely because `setLogProvider` exists.

### Planned scope

#### Specification completion

Complete the affected specifications before production edits:

* `Logger.md`
* `Provider.md`
* `RustLogProvider.md`
* specification for the selected startup owner

#### Provider activation

* Activate `RustLogProvider` through the existing `setLogProvider` mechanism.
* Preserve the current `LogProvider` contract.
* Preserve `/api/log` request/response contracts.
* Preserve appropriate fallback/fail-safe behavior.
* Do not let normal tool components import the provider directly.

#### Validation

Add focused coverage for:

* provider selection;
* startup behavior;
* endpoint interaction;
* failure/fallback behavior;
* architecture boundary preservation.

### Dependencies

Requires:

* v0.1.1 Development Validation Hardening
* approved startup/environment/privacy contract
* completed affected specifications

### Acceptance boundaries

Version 0.7.0 is complete when:

* the selected startup path activates the intended provider;
* log-provider architecture remains swappable;
* normal application behavior remains functional when logging transport fails according to the approved failure contract;
* relevant tests pass;
* typecheck, lint, tests, and build pass;
* documentation reflects actual startup/provider behavior.

### Explicit exclusions

Version 0.7.0 does not include:

* analytics-provider replacement
* a new logging abstraction
* direct logging-provider imports from tool components
* auth
* server-storage architecture changes

## Version 0.8.0 — About Page

Status: Planned — content definition required before implementation

### Goal

Add the explicitly planned About page through the existing Next.js routing, navigation, layout, and SEO architecture.

### Definition gate

Before implementation begins, define:

* About-page content;
* route;
* navigation placement;
* layout requirements;
* SEO metadata;
* responsive behavior;
* acceptance criteria.

Do not invent project/company copy during implementation planning.

### Planned scope

After content and behavior are approved:

* create the About route using the existing App Router conventions;
* keep the route composition-oriented and server-first where appropriate;
* use existing shared layout/components;
* update explicit navigation data if the approved design requires a navigation link;
* use existing SEO builders/contracts where applicable;
* write the required page/component specification before implementation;
* add route/rendering tests;
* add browser coverage under the established Playwright infrastructure.

### Dependencies

Requires:

* approved About-page content and placement
* relevant page/component specification
* v0.1.1 Development Validation Hardening

Browser acceptance testing should use the v0.2.0 infrastructure.

### Acceptance boundaries

Version 0.8.0 is complete when:

* the approved About route exists;
* approved content renders correctly;
* navigation integration matches the approved design;
* SEO metadata follows existing architecture;
* responsive behavior is verified;
* tests and browser checks pass;
* typecheck, lint, full tests, and build pass.

### Explicit exclusions

Version 0.8.0 does not include:

* authentication
* payments
* advertising-provider integration
* analytics-provider replacement
* server-side storage
* unrelated content pages

## Documentation and Specification Debt Policy

The current repository contains:

* 19 component specifications
* 27 module specifications
* 46 combined specifications
* 10 substantive specifications
* 36 generated/content-light stubs

This debt must not become a standalone requirement to rewrite every specification before productive work can continue.

The rule for future versions is:

> Complete the specification for an affected component or module before that unit enters implementation scope.

Therefore:

* targeted specification completion is part of version preparation;
* unrelated stubs remain outside the version;
* global completion of all stubs is not currently a planned product release;
* documentation inventory counts must remain accurate;
* generated inventory artifacts must not be treated as canonical product plans.

Known high-priority stubs because they intersect currently planned work include:

* `ToolClientFrame.md`
* `Type.md`
* `Logger.md`
* `Provider.md`
* `RustLogProvider.md`
* `ThemeProvider.md`
* `ThemeToggle.md`
* selected page/component specifications required by About or browser-test work

Other stubs become relevant only when their owning units enter planned scope.

## Theme Specification Debt

The application currently supports these theme selections:

* system
* light
* dark
* onedark
* vscode-modern
* dracula
* amethyst-haze
* mercury-fog

The theme implementation is functional, but the non-Light/Dark palette intent is not fully captured in canonical styling documentation.

This is documentation/specification debt rather than an identified runtime feature defect.

Required rule:

> Complete the canonical token/design specification before future theme or styling behavior is changed.

No standalone product version is assigned to this work at present.

A documentation-only correction may address the missing theme specification independently when appropriate.

## Planned Work — Version TBD

The following items are explicitly present in project planning sources but do not yet have enough approved product or architecture definition for a concrete version assignment.

They must remain separate rather than being folded into another version without an explicit planning decision.

### Analytics provider swap

Current state:

* analytics abstraction exists;
* provider swapping is supported by the architecture;
* no external analytics vendor has been selected.

Future work may replace the current provider through the existing provider interface.

Required decisions before version assignment:

* vendor
* privacy policy
* network behavior
* configuration
* consent requirements if applicable
* validation requirements

Do not bypass the existing analytics abstraction.

### Advertising provider integration

Current state:

* horizontal and vertical ad placeholders exist;
* AppShell provides the current layout surfaces;
* no advertising provider is selected.

Required decisions before version assignment:

* provider
* privacy policy
* loading behavior
* security policy
* responsive behavior
* failure behavior
* exact slot behavior

Complete the AdBanner and relevant AppShell specifications before implementation.

### Server-side storage backend

Current state:

* browser persistence uses the established `StorageAdapter`;
* theme, recently-used data, and other consumers depend on that abstraction.

Any server-side storage work must preserve or deliberately migrate the existing storage contract.

This work likely requires architecture re-assimilation because it would introduce a new persistence architecture and affect multiple consumers.

Required decisions include:

* backend technology
* state ownership
* migration behavior
* browser/server synchronization
* authentication relationship
* failure/offline behavior
* compatibility with existing stored values

No version is assigned.

### Authentication

Status: Not needed yet

Authentication is an explicit open decision and is not current required scope.

Do not introduce authentication merely as a prerequisite for unrelated current features.

Authentication requires separate product, security, API, state, and architecture planning before entering the roadmap sequence.

### Payments

Status: Future / unresolved

Payments remain an explicit future item with no defined provider, business requirements, authentication relationship, API contract, or security model.

Do not assign payments to a concrete version until those decisions exist.

## Version Sequence

The currently planned implementation sequence is:

```text
v0.1.0  Current product baseline

v0.1.1  Development Validation Hardening
        ↓
v0.2.0  Browser End-to-End Validation Foundation
        ↓
v0.3.0  Additional Tools End-to-End
        ↓
v0.4.0  HTTP Security Header Hardening
        ↓
v0.5.0  Recently Used Tool Tracking Integration
        ↓
v0.6.0  Tool Metadata and Discovery Enrichment
        ↓
v0.7.0  RustLogProvider Startup Activation
        ↓
v0.8.0  About Page
```

This sequence preserves the current project's documented product-work ordering after first resolving the validation infrastructure required to implement and verify later versions safely.

Items listed under **Planned Work — Version TBD** remain outside this concrete sequence until their required product and architecture decisions are made.

## Cross-Version Dependencies

### Validation foundation

v0.1.1 is a prerequisite for all later implementation versions because the current lint and continuous-integration test gates are not trustworthy.

### Browser validation

v0.2.0 establishes the planned browser-test capability needed to validate later route, tool, layout, and user-flow changes.

### Documentation-first implementation

Every later version must complete affected component/module specifications before implementing production changes.

This does not require global completion of unrelated stubs.

### Architecture preservation

Later versions must continue to use the established owners:

* tool registration → `ToolDefinition` / `tool_definition_list`
* tool queries → metadata layer
* persistence → `StorageAdapter`
* themes → ThemeRegistry / ThemeStorage / ThemeRuntime
* logging → LogProvider / logger / `setLogProvider`
* analytics → existing analytics provider abstraction
* tool lifecycle → ToolClientFrame where the shared tool-open client lifecycle is involved
* observability → observability facade
* layout → AppShell
* navigation → explicit navigation data
* SEO → registry metadata and existing SEO builder functions

A version that introduces any of the following requires Architecture Assimilation to be refreshed before implementation:

* a new canonical state store
* a new persistence architecture
* a major route/state redesign
* a new framework/service/package boundary
* a new public contract family
* replacement of a major subsystem
* substantial repository restructuring

## Global Validation Expectations

Every implementation version must preserve or restore the repository's required validation chain.

At minimum, once the v0.1.1 correction establishes the supported commands:

* type checking must pass;
* linting must pass;
* unit/integration tests must pass;
* browser tests must pass when applicable under the established testing policy;
* production build must pass;
* documentation must be reconciled with implemented behavior;
* relevant component/module specifications must match the final implementation.

A version is not release-ready merely because its implementation code is complete.

Release readiness, release preparation, and publication remain separate workflow stages.

## Roadmap Boundaries

This roadmap must not be interpreted as authorization to:

* implement unassigned Version-TBD items;
* infer exact tools for v0.3.0;
* invent a security-header policy for v0.4.0;
* invent metadata consumer behavior for v0.6.0;
* invent Rust logging startup/privacy behavior for v0.7.0;
* invent About-page content for v0.8.0;
* implement authentication or payments;
* select external analytics, advertising, or storage providers;
* complete unrelated specification stubs;
* reorganize the version sequence without an explicit planning decision.

Where a version has a **Definition gate**, that gate must be resolved before implementation prompts are written.

## Next Planning Action

The next implementation target is:

**v0.1.1 — Development Validation Hardening**

Before its implementation prompt is written:

1. verify the current lint configuration and supported ESLint execution path;
2. verify the exact GitHub Actions test-job ownership and `continue-on-error` behavior;
3. identify the documentation references that must change with the corrected validation contract;
4. use current my-dev-kit targeted retrieval before source/test edits;
5. implement the bounded validation correction without introducing unrelated product work.
