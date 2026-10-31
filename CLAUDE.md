# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Build & Development Commands

npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript type checking (tsc --noEmit)
npm run test         # Unit tests (vitest run)
npm run verify       # Aggregate local validation with shared reports

CI runs six public-app gates (typecheck, lint, test, build, E2E, Container) plus
dashboard and observability-database workflows. All eight trigger on
`pull_request` and pushes to `main`, `master`, and `validation/**`; validation
branches support immutable exact-SHA pre-release checks.

## Mandatory Repository Retrieval Rule (No Guessing)

Before generating or modifying code that depends on existing repository files:

1. Use my-dev-kit against the current repository state to identify the existing
   behavior owner, extension point, relevant contracts, and closest tests.
2. Retrieve bounded context first: search -> lookup -> slice when relationships
   matter -> source -> continuation or local dependency expansion when needed.
3. Read a complete source or test file only when bounded retrieval cannot supply
   the required context, and record why the fallback was necessary.
4. If ownership, contracts, or the requested behavior remain materially
   ambiguous after bounded retrieval, stop and report the exact unresolved
   question instead of guessing.

Forbidden:
- Do NOT guess imports, export names, or type shapes.
- Do NOT assume ownership from file names or paths alone.
- Do NOT broadly dump the repository for orientation.
- Do NOT ask the user to paste repository files that are already available to
  the coding environment.
- Do NOT write placeholder or "most likely" implementations.
- Do NOT create a parallel subsystem when an existing owner can be extended.

## Design Philosophy

Clarity over cleverness. Code should look like it was written by a careful senior engineer.

- Explicit over implicit
- Boring over clever
- Readability over brevity
- Composition over abstraction
- Separation of concerns at all costs
- Straight-line logic, no deep nesting, minimal indirection
- No over-generalization, abstract factories, meta-programming, or auto-discovery
- No eval, no dynamic execution
- Assume mobile plus slow network; avoid large dependencies

## Architecture

Document/PDF source primitives, limits, page selection and ordered-file
transitions belong in `src/module/tool/document/`, specified by PdfFile.md
and PdfProcessing.md. PDF.js is operation-time and same-origin; only the
dedicated pdf-lib worker imports pdf-lib in production source. Project-owned
pinned QPDF WASM uses short-lived workers, manifests and retained notices.
Normal builds consume committed assets; controlled rebuilds belong to
`script/qpdf/`. Each of the five document tools owns its UI, result URLs,
generations, cancellation and identity-only telemetry locally. Do not broaden
image owners or introduce a universal PDF engine.

Next.js 16 App Router with React 19, TypeScript 5, Tailwind CSS v4.

The app is a collection of client-side utility tools organized as a PWA with offline support.

### Path alias

@/* maps to src/* as configured in tsconfig.json.

### Layer responsibilities

Layer: app
Path: src/app
Role: Routing, layouts, pages
Rules: Composition only. No business logic. No tool logic. Server Components by default.

Layer: module
Path: src/module
Role: Domain logic, tools, registries, analytics
Rules: Tool implementations live here. Analytics abstraction lives here. UI allowed only inside tool components. No routing logic.

Layer: component
Path: src/component
Role: Reusable UI
Rules: No knowledge of tools, slugs, or routing. No side effects unless explicitly client-only.

Layer: lib
Path: src/lib
Role: Generic helpers
Rules: No React components. No imports from module layer.

Server vs Client rule:
Pages under app are Server Components. Tool UI components are Client Components. Do not mark layouts or pages as use client.

Forbidden patterns:
- Tool logic inside app
- Implicit magic or reflection-based wiring
- Dynamic imports without explicit intent
- Tight coupling between components and tools
- Business logic in UI components
- Direct analytics SDK usage in tools
- lib importing from module

### Design constraints

- Next.js App Router
- Registry-driven tool discovery
- Server pages plus client tool UI split
- Explicit imports only
- Analytics through abstraction layer only
- Persistence through storage abstraction only

### Tool system

Tools are the core domain concept. Each tool is a React component registered in src/module/tool/registry.ts via tool_definition_list.

Adding a new tool:
1. Create a component in src/module/tool/<category> implementing ToolComponentProp
2. Register it in registry.ts with id, slug, name, description, category, seo metadata, capabilities, and state policy
3. The tool automatically gets a page at /tool/[slug] and appears in listings

Tool component interface:

interface ToolComponentProp {
toolId: ToolId;
query?: Record<string, string>;
setQuery?: (next: Record<string, string>) => void;
}

Tool categories:
document, image, text, math, time, converter, developer

Category definitions (ids, canonical order, page title/description, validation)
are owned by src/module/tool/category.ts. ToolCategory derives from it. Do not
create category lists elsewhere. The registry owns which categories are populated.

Tool capabilities:
client-only, offline, requires-network

Tool components must be self-contained and must not depend on routing.

### Registry-first policy

- src/module/tool/registry.ts is the single source of truth for registered tool data and therefore category population
- src/module/tool/category.ts is the single source of truth for category definitions
- src/module/tool/metadata.ts provides higher-level queries over the registry
- Never duplicate tool data outside the registry
- New metadata queries go in metadata.ts

Image guide prose belongs in the typed server-consumed `src/module/tool/guide.ts`
companion keyed by existing ToolId. It is not another identity registry and must
not enter client catalog payloads. Related IDs resolve through metadata.ts;
generic lib/seo never imports guide data.

The Guide finder is owned by `src/module/content/toolFinder.ts` (frozen decision graph that stores only ToolId and WorkflowSlug references) and `src/module/content/ToolFinderClient.tsx` (in-memory path stack, Back, Start over, focus). `src/app/guide/page.tsx` resolves targets from the registries. Search is owned by `src/component/common/ToolSearch.tsx` with the pure matcher `src/component/common/toolSearchMatch.ts`; neither holds a second tool list.

The Guide finder is owned by `src/module/content/toolFinder.ts` (frozen decision graph that stores only ToolId and WorkflowSlug references) and `src/module/content/ToolFinderClient.tsx` (in-memory path stack, Back, Start over, focus). `src/app/guide/page.tsx` resolves targets from the registries. Search is owned by `src/component/common/ToolSearch.tsx` with the pure matcher `src/component/common/toolSearchMatch.ts`; neither holds a second tool list.

### Layout composition

AppShell provides the responsive grid layout with slots for navigation, header and footer banners, and side panels. Navigation items are defined in src/app/navData.ts (the five primary items only; layout.tsx derives the separate category items from getAvailableCategory() and getToolCategoryLabel, the canonical definition title, and passes them as categoryNavItem). HeaderSearch is the Search utility that focuses the existing #tool-search input. UtilityCard is a presentation-only whole-card link used by the Home catalog and must not import registry or category modules. The root layout.tsx wraps all pages in AppShell.

### URL state sharing

ToolClientFrame in src/component/tool/ToolClientFrame.tsx syncs tool state with URL query parameters. Tools opt into this via statePolicy.shareableQuery.

### Theming

Base CSS custom properties live in src/app/global.css, while registry-defined theme overrides live in src/style/theme.css. The legacy `ThemeId` contract retains System, Light, Dark, and One Dark for compatibility. The current appearance system separately supports six named palettes (`original`, `mineral`, `oxblood`, `signal`, `cobalt`, `amber`) with System/Light/Dark modes, plus fixed-dark legacy One Dark. Palette and mode preferences use the existing theme registry/storage/runtime; selecting an appearance changes visual tokens, not layout.

## Analytics and Observability Policy

All observability goes through module observability:

- trackEvent(event, prop)
- logEvent(message, meta)
- captureError(error, meta)
- setLogProvider(provider)
- setLogLevel(level)

Rules:
- Tools call only trackEvent or logEvent
- No direct console usage
- Error boundaries must use captureError
- Logging must be SSR-safe and non-blocking
- RustLogProvider sends logs to /api/log (endpoint implemented)

Defined events:
tool_opened, tool_executed, tool_result_copied, tool_mode_changed

## Persistence Abstraction Policy

All persistent state access goes through storage from lib/storage:

- storage.get(key)
- storage.set(key, value)
- storage.remove(key)

Rules:
- No direct localStorage calls outside the storage adapter
- SSR-safe behavior
- JSON serialization handled internally
- Current backend localStorage
- Future swap to cookies or server

## SEO Automation

Dynamic metadata is generated from ToolDefinition.seo.

- buildToolMetadata in lib/seo
- buildCategoryMetadata for category pages
- Tool pages export generateMetadata using buildToolMetadata
- No hardcoded SEO in page files
- Scales automatically when new tools are added

## Code Generation Rules

- Always use TypeScript with named interfaces
- Use singular naming everywhere
- Do not refactor architecture unless asked
- Do not invent abstractions unless requested
- Do not move files across layers
- Client components must declare use client
- Fail early using notFound
- Ask for clarification if architecture unclear

## Styling Rules

- Use Tailwind classes for styling
- Use only existing CSS variable tokens
- Themes define palette; components consume semantic visual roles; category colors provide catalog identity
- Themes may vary color, typography, spacing, shape, materials, decorative graphics and nonessential motion through the existing theme and shared presentation owners. They must preserve content and control order, route and processing contracts, theme persistence, responsive usability and all required accessibility checks. Theme changes must not steal focus, clear input/results or obscure controls. Identical geometry across different artistic themes is not required. (Supersedes the earlier "Theme switch changes color only" rule; 8V closeout 2026-10-31.)
- Subtle shadow only
- No surprise animations
- Update `docs/DESIGN.md` before design or styling system changes

## Testing Discipline (Mandatory)

All new modules, features, or behavioral changes must include tests.

Requirements:

1. Write tests for all new logic
   - Business logic must have unit tests
   - Edge cases must be tested
   - Error paths must be tested

2. Test file placement
   - Tests must follow existing project convention
   - Do not mix implementation and test in the same file

3. Run tests after implementation
   - Run npm run test
   - Ensure all tests pass
   - Fix failures before finalizing

4. Unique test report artifact
   - Every test run must generate a unique report directory under test-report/<RUN_ID>
   - The RUN_ID must be unique per execution
   - The agent must report the RUN_ID and the path to the generated report files
   - CI must upload the full test-report/<RUN_ID> directory as an artifact

5. No skipping tests
   - Do not skip tests
   - Do not suppress type errors
   - Do not mock core behavior unnecessarily

6. When modifying existing behavior
   - Update affected tests
   - Add regression tests

7. Infrastructure layers must be tested
   - Analytics abstraction
   - Logging module
   - Storage adapter
   - Error boundary behavior
   - SSR safety where applicable

Testing philosophy:

- Tests verify behavior, not implementation details
- Keep tests readable and explicit
- Avoid brittle snapshot testing
- Avoid over-mocking

CI enforces:
- Typecheck
- Lint
- Test
- Build

Agents must assume CI will enforce all four.

## Documentation Discipline

- Architecture changes require updating docs/architecture.md first
- Style changes require updating docs/DESIGN.md first
- New abstractions require updating this file
- Project status tracked in docs/project-status.md
- Do not skip documentation when adding new tools


### Island/material pilot

SectionIsland is presentation-only (heading, optional description, children), with no data/search/category/routing ownership. Light/Dark/System remain solid; One Dark selectively uses structural glass and restrained local neomorphic depth. Geometry may differ between artistic themes (see the Styling Rules theme rule). See DESIGN.md for fallbacks and contrast.

## Production integration policy

Persistent measurements extend module/observability through the server-only
Neon driver pinned to @neondatabase/serverless@1.1.0. `/api/metric` alone writes
the durable metrics database; `/api/log`, RustLogProvider and captureError keep
technical diagnostics. Client-error metrics receive only explicit typed safe
fields. deviceClass means coarse CSS viewport width only. Schema/rollup/retention
belong to database/observability, with raw retained 90 days and no deletion of
unrolled days; daily history is indefinite. Public-project maintenance requires
CRON_SECRET. `dashboard/` installs/builds/tests independently, has server-only
read-only production database credentials, no app auth, and must be protected
externally by Vercel Authentication → All Deployments. Keep the public project
public and all public automated validation persistence-disabled. Run isolated
test:observability-db and dashboard verify for their respective changes.

See docs/OBSERVABILITY.md and docs/ADVERTISING.md. Existing facade/providers own telemetry; explicit public enable flags default off. No user/file/input/output/full URL/query/hash/identity telemetry. Central module/ad configuration supplies top/right conditional slots through AppShell, no fake footer/right banner. Live ad activation requires production and external AdSense/CMP readiness. Automated tests never request/click live ads; runtime/API/public asset changes require the container gate.

Support reporting (v0.4.2 Batch 1): `src/module/support/` owns the anonymous report contract, validation, route context, client
coordinator, server intake, delivery worker and provider adapters; `src/component/support/` is presentation only; `database/support/` owns the
separate `support` schema and roles; `/api/support/report` and `/api/support/deliver` are thin adapters; the dashboard adds
`/support` pages with a SELECT-only `SUPPORT_DASHBOARD_DATABASE_URL`. The sentence above that `/api/metric` alone writes the durable
metrics database refers to the observability database only; support data is a separate domain and never enters observability,
analytics, logging, advertising, browser storage or service-worker caches. The entry is gated by `NEXT_PUBLIC_SUPPORT_ENABLED`
(default off). See docs/architecture.md, database/support/README.md and docs/DEPLOYMENT.md.

General contact and publisher content (v0.4.3): `src/module/content/` owns the typed publisher identity and authored trust-page content.
`src/module/contact/` owns the public general-contact contract, validation, bounded body reader, origin checks and the server-only
Resend email sender. General contact is separate from support reporting: the support-reporting backend remains the existing v0.4.2 owner
(`src/module/support/`). Contact message content never enters observability, and no contact database is introduced.

Browser-local workflows (Prompt 6): `src/module/workflow/` owns the four workflows (prepare-image-for-upload, heic-photos-to-pdf,
assemble-pdf-packet, pdf-pages-for-slides). `registry.ts` is the only source of workflow identity and status; `type.ts` is the frozen public
request/result contract; `runner.client.ts` is the single dispatcher and orchestrates stages; `adapters.client.ts` is the only bridge to the
existing image, HEIC, PDF.js, pdf-lib and QPDF owners, which keep their limits and are reused, never copied. `WorkflowClient.tsx` alone owns the
run lifecycle (one AbortController and generation per run, result object URLs revoked on edit, reset and unmount); the three `*Form.tsx` files own
fields, ordering and request construction only. Packet assembly is the additive `assemble` operation of the existing pdf-lib worker
(`pdfLib.workerType.ts`, `pdfLib.client.ts`, `pdfLib.worker.ts`); do not add a second PDF worker or engine, and never rasterize PDF pages to build a
PDF. A failed or cancelled run returns `outputs: []` and a success requires an independent re-read of the final output. File bytes, names and page
mappings stay in browser memory and local Blob URLs: no upload, storage, query string or telemetry. See docs/architecture.md and docs/DESIGN.md.