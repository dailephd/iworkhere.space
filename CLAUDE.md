# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Build & Development Commands

npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript type checking (tsc --noEmit)
npm run test         # Unit tests (vitest run)
npm run verify       # Aggregate local validation with shared reports

CI runs: typecheck, lint, test, build (all must pass). Separate GitHub Actions workflow per step.

## Mandatory Interaction Rule (No Guessing)

Before generating ANY code that depends on existing files:

1. List exactly which existing files you need to see
2. For each file, state why it is required
3. STOP and wait for the user to provide the files

Forbidden:
- Do NOT guess imports, export names, or type shapes
- Do NOT assume file structure from file paths
- Do NOT write placeholder or most likely implementations
- Do NOT generate partial implementations

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
document, image, text, math, time, everyday

Tool capabilities:
client-only, offline, requires-network

Tool components must be self-contained and must not depend on routing.

### Registry-first policy

- src/module/tool/registry.ts is the single source of truth for all tool data
- src/module/tool/metadata.ts provides higher-level queries over the registry
- Never duplicate tool data outside the registry
- New metadata queries go in metadata.ts

### Layout composition

AppShell provides the responsive grid layout with slots for navigation, header and footer banners, and side panels. Navigation items are defined in src/app/navData.ts. The root layout.tsx wraps all pages in AppShell.

### URL state sharing

ToolClientFrame in src/component/tool/ToolClientFrame.tsx syncs tool state with URL query parameters. Tools opt into this via statePolicy.shareableQuery.

### Theming

CSS custom properties in src/app/global.css define light and dark tokens. Supports system preference and user override via data-theme on html. Tokens are wired to Tailwind via theme inline.

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
- One accent hue only
- Theme switch changes color only
- Subtle shadow only
- No surprise animations
- Update styling documentation before style system changes

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

- Architecture changes require updating doc/architecture.md first
- Style changes require updating doc/styling.md first
- New abstractions require updating this file
- Project status tracked in doc/project-status.md
- Do not skip documentation when adding new tools
