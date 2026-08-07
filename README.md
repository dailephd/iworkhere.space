# iworkhere.space

A collection of client-side utility tools built as a Progressive Web App with offline support.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **UI:** React 19, Tailwind CSS v4
- **Testing:** Vitest
- **CI:** GitHub Actions (typecheck, lint, test, build)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript type checking (tsc --noEmit)
npm run test         # Unit tests (vitest run)
```

## Architecture

The codebase follows a strict four-layer architecture:

| Layer       | Path             | Role                                      |
|-------------|------------------|--------------------------------------------|
| **app**     | `src/app/`       | Routing, layouts, pages (composition only) |
| **module**  | `src/module/`    | Domain logic, tools, registries, analytics |
| **component** | `src/component/` | Reusable UI (no domain knowledge)        |
| **lib**     | `src/lib/`       | Generic helpers (no React, no module imports) |

### Tool System

Tools are the core domain concept. Each tool is a React component registered in `src/module/tool/registry.ts`. Adding a new tool:

1. Create a component in `src/module/tool/<category>/` implementing `ToolComponentProp`
2. Register it in `registry.ts` with metadata, SEO, and capabilities
3. The tool automatically gets a page at `/tool/[slug]` and appears in listings

### Current Tools

- **Slugify Text** (`/tool/slugify`) — Convert text into URL-safe slugs
- **HTML Text Extractor** (`/tool/html-text-extractor`) — Extract visible text from HTML and preserve line breaks
- **Calculator** (`/tool/calculator`) — Evaluate simple math expressions
- **Length Converter** (`/tool/length-converter`) — Convert between common length units
- **Weight Converter** (`/tool/weight-converter`) — Convert between common weight units
- **Time Arithmetic** (`/tool/time-arithmetic`) — Add and subtract time values in HH:MM format

### Key Routes

- `/` — Home page
- `/discover` — Browse and search all tools by category
- `/tool/[slug]` — Individual tool page
- `/category/[category]` — Tools filtered by category
- `/api/health` — Health check endpoint
- `/api/log` — Client log ingestion (used by RustLogProvider)

## Observability

All tracking and logging goes through `src/module/observability/`:

- `trackEvent()` — Product metrics (delegates to analytics)
- `logEvent()` — System debugging (delegates to logger)
- `captureError()` — Error capture with logging and optional analytics

## Testing

Tests live alongside source files following the `*.test.ts` convention. Each test run generates a unique report under `test-report/<RUN_ID>/` containing JSON and JUnit results.

## Offline Support

The app includes a service worker (`public/sw.js`) that enables offline usage after first load.

### Testing offline mode locally

1. Run `npm run build && npm start` (service workers require production builds)
2. Open `http://localhost:3000` in your browser
3. Navigate to a few pages (Home, Discover, tool pages) to populate the cache
4. Open DevTools > Application > Service Workers and verify `sw.js` is registered
5. Check "Offline" in the DevTools Network tab, or disconnect your network
6. Reload — cached pages should still load
7. Navigate between cached pages — they should work without network

The service worker uses network-first for page navigation (so you always get fresh content when online) and cache-first for static assets (for fast loads). API routes are never cached.

## Scroll Fix Verification

To verify the main content scrolling fix:
1. Open `src/app/page.tsx`.
2. Wrap the content in a large container to force overflow, e.g., `<div className="h-[200vh] bg-linear-to-b from-blue-500 to-red-500">Scroll Test</div>`.
3. Run `npm run dev` and navigate to `http://localhost:3000`.
4. Verify:
    - Header and Footer are fixed at the top and bottom.
    - Only the middle content area scrolls.
    - Scrollbars appear on the content area, not the body.

## Orchestration

A local orchestration wrapper that injects governance context into Claude Code runs and standardizes CI verification with unique test report artifacts. Lives at `script/orchestrator.ts`.

### Modes

#### context

Reads all governance files (CLAUDE.md, architecture, design, guidelines, status, project tree, package.json, vitest config), concatenates them into a structured context block, and prints to stdout.

```bash
npm run orchestrator:context
```

Output is the full governance bundle. Useful for inspection or piping into other tools.

#### ask

Runs Claude Code with the governance context prepended to your request. Accepts a natural language request via CLI arguments or stdin.

```bash
# Via argument
npm run orchestrator:ask -- "Add a new text tool that reverses strings"

# Via stdin
echo "Fix the calculator tool edge case" | npm run orchestrator:ask
```

This mode:
1. Generates a unique RUN_ID
2. Builds the governance context
3. Constructs a final prompt (context + request + instruction reminders)
4. Saves the prompt to `test-report/<RUN_ID>/prompt.txt`
5. Invokes `claude -p` with the prompt via stdin
6. Saves Claude's stdout and stderr to `test-report/<RUN_ID>/`
7. Prints the RUN_ID and log paths

Set the `CLAUDE_COMMAND` environment variable to override the Claude CLI command (defaults to `claude`).

#### verify

Runs all CI steps in order (typecheck, lint, test, build) with full log capture and a coordinated RUN_ID.

```bash
npm run orchestrator:verify
```

This mode:
1. Generates a unique RUN_ID
2. Creates `test-report/<RUN_ID>/command/`
3. Runs each step sequentially, capturing stdout and stderr
4. Stops on first failure, preserving all logs
5. Passes the RUN_ID to vitest via `VITEST_RUN_ID` so test reports land in the same directory

On success, the following artifacts are produced:
- `test-report/<RUN_ID>/results.json` — Vitest JSON results
- `test-report/<RUN_ID>/results.xml` — Vitest JUnit XML results
- `test-report/<RUN_ID>/command/typecheck.log`
- `test-report/<RUN_ID>/command/lint.log`
- `test-report/<RUN_ID>/command/test.log`
- `test-report/<RUN_ID>/command/build.log`

### RUN_ID format

Every run produces a unique identifier in this format:

```
YYYY-MM-DDTHH-mm-ss-SSSZ-<8hex>
```

Example: `2026-02-14T16-14-23-519Z-980e0fe0`

The timestamp portion is the ISO 8601 UTC time with colons and periods replaced by dashes. The suffix is 8 random hex characters for uniqueness. All logs and reports for a run are stored under `test-report/<RUN_ID>/`.

The `test-report/` directory is gitignored.

## Documentation

- `doc/architecture.md` — Architectural boundaries and layer rules
- `doc/styling.md` — Styling rules and design tokens
- `doc/design.md` — Design philosophy
- `doc/project-status.md` — Current project status and next steps
- `doc/code-generation-guidelines.md` — Code generation rules for LLM agents
- `CLAUDE.md` — Claude Code agent instructions
