# CI/CD

This document defines the CI discipline for this Next.js project.

CI is not optional.
Every pull request must pass all checks before merge.

All eight workflows trigger on `pull_request` and pushes to `main`, `master`,
and `validation/**`. The narrow `validation/**` push namespace exists for
immutable exact-SHA pre-release validation: a validation ref can point to a
frozen candidate commit without changing that commit, opening a PR, or merging.

---

## 1. Objectives

CI enforces:

1. Type correctness across all module boundaries
2. Lint compliance and import discipline
3. Test integrity — unit, contract, and integration
4. Build success — valid Next.js production output
5. SSR and hydration safety
6. Deterministic, traceable test reporting
7. Layer boundary compliance (enforced by TypeScript)

Deployment must never change behavior silently.

---

## 2. Required CI Jobs

The standalone dashboard has an additional independent
`.github/workflows/dashboard.yaml` workflow on Node 24. It runs
`npm --prefix dashboard ci` and `npm --prefix dashboard run verify` without
database secrets, uploads its full unique dashboard/test-report hierarchy and
does not deploy. The dashboard owns a local PostCSS boundary for its plain CSS
and installs/builds without root `node_modules` or the root Tailwind plugin.
Root jobs do not compile the dashboard application.
`.github/workflows/observability-db.yaml` independently runs the isolated
Postgres 17 schema/rollup/query/role smoke and uploads each complete run directory.
Together these are two additional workflows beyond the six public-app gates
below. The dashboard and database workflows each have one required job; eight
workflow jobs run in total.

Six jobs run on every push and pull request:

| Job | Command | Enforces |
|-----|---------|----------|
| `typecheck` | `npm run typecheck` | TypeScript correctness, interface contracts |
| `lint` | `npm run lint` | ESLint rules, import discipline |
| `test` | `npm run test` | Unit, contract, and integration tests |
| `build` | `npm run build` | Next.js production build, RSC correctness |
| `e2e` | `npm run test:e2e` after build | Production desktop/mobile Chromium behavior and diagnostics |
| `container` | `npm run test:container` | Built Docker runtime, health, image hygiene, and the same browser suite against the container without host `.next` dependencies |

All six public-app jobs plus the dashboard and database jobs must pass.
If any job fails, merge is blocked.

The Delivery 2 production launch on master SHA
c8406412301ff382dcf4e10e00789e93caad6f39 satisfied all eight required
workflow responsibilities. The first Observability database run
37198138568 failed with a PostgreSQL socket-not-ready startup error before
any SQL assertion; its exact-SHA failed-job-only retry (attempt 2, job
111431961045) passed. This is retained as a transient CI startup flake, not a
schema/product failure. All eight workflows remain required; no retry policy
was added.

For local aggregate validation, run `npm run verify`. This command runs the
same four checks sequentially with a shared `RUN_ID` and per-command logs; it
does not include E2E or Container and does not replace the six public-app or two
additional GitHub Actions jobs. `npm run test:container` is the
production-container gate.

Each job runs in a separate GitHub Actions workflow file under `.github/workflows/`.

---

## 3. Job Definitions

### 3.1 Typecheck

Command: `npm run typecheck` (`tsc --noEmit`)

Fails if:

- Type errors in any source file
- Missing required properties on declared interfaces
- Incompatible assignments across layer boundaries
- Invalid `ToolDefinition` shape

No type suppressions (`@ts-ignore`, `@ts-expect-error`) without documented
justification.

### 3.2 Lint

Command: `npm run lint` (ESLint)

Fails if:

- Import from a forbidden layer (e.g., `lib/` importing from `module/`)
- Unused imports
- Missing `"use client"` on Client Components
- ESLint rule violations defined in the project config

### 3.3 Test

Command: `npm run test` (Vitest)

Must include:

- Unit tests for all pure logic
- Contract tests for tool registry, metadata, analytics payloads, and storage SSR
  safety
- Integration tests for API routes and cross-module wiring
- A unique test report written to `test-report/<RUN_ID>/`

Fails if:

- Any test fails
- The `test-report/<RUN_ID>/` directory is not produced
- Registry wiring is broken

### 3.4 Build

Command: `npm run build` (Next.js production build)

Fails if:

- Build errors in any source file
- Invalid Server Component usage (e.g., `"use client"` on a layout)
- Missing `generateMetadata` exports on tool or category pages
- Broken dynamic routes

---

## 4. Test Report Discipline

Every test run must produce a unique report directory under
`test-report/<RUN_ID>/`.

- `RUN_ID` is a timestamp plus random hex suffix, e.g.,
  `2026-02-14T16-14-23-519Z-980e0fe0`
- The report directory must contain `results.json` (JSON) and `results.xml`
  (JUnit format)
- CI must upload `test-report/` as a workflow artifact
- The agent or developer running tests must report the `RUN_ID` and the full
  report path

Violating test report uniqueness is a CI failure.

---

## 5. SSR and Hydration Safety Enforcement

The public application has six independent gates: Typecheck, Lint, Test, Build,
E2E and Container. The repository also runs separate Dashboard and Observability
database workflows, for eight workflow jobs total. Active workflows use Node
24.21.0 (the dashboard/database workflows specify Node 24). The E2E gate installs pinned Chromium,
builds, and runs `npm run test:e2e`; the Container gate checks Docker, installs
Chromium, and runs `npm run test:container`. All eight workflows trigger on
pull requests and pushes to `main`, `master`, and `validation/**`. E2E and
container reports are uploaded with distinct run/attempt artifact names and
30-day retention. Local aggregate verification
remains the original four steps; E2E and Container are separate.

Exact-SHA hosted validation passed at `339091c5aaf4ad31be656756a7f4e4c121cc37de`
on `validation/v0.2.0-heic-license-339091c5`: Typecheck 37092677963, Lint
37092677935, Test 37092678056, Build 37092677967, E2E 37092678000, Container
37092677960, Dashboard 37092678008, and Observability database 37092678028.

**Build-time** (enforced by `npm run build` and type checking):

- Server Components must not use browser APIs
- `"use client"` must not be placed on pages or layouts
- Import violations are caught by TypeScript

**Runtime browser gate** (implemented with Playwright production Chromium):

- No hydration warnings permitted in the browser console
- No `Date.now()` or unseeded `Math.random()` in render paths
- Client-only behavior must render a stable placeholder on the server first

Build and Vitest success alone must not be presented as browser-runtime proof.
The separate browser suite fails on page errors, console errors and hydration
warnings/errors. See TESTING.md for report ownership and diagnostic discipline.

---

## 6. PR Gating Rules

Pull requests must:

1. Pass the six public application gates and the separate dashboard and database workflows
2. Not skip tests or suppress type errors
3. Include tests for new logic (see TESTING.md)
4. Not introduce direct layer violations

Pull request description should include:

- Summary of the change
- Tests added or updated
- Any contract or schema impact (see SCHEMA.md and API.md)

---

## 7. Branch Discipline

| Branch type | Naming convention |
|-------------|------------------|
| Feature work | `feature/<topic>` |
| Bug investigation | `debug/<topic>` |
| Stable state | `master` |

- `master` is always stable.
- No direct commits to `master` without passing CI.
- No force-push to `master`.

---

## 8. Failure Handling Protocol

If CI fails:

1. Identify the failing job.
2. Read the failing step output.
3. Reproduce locally:
   `npm run typecheck && npm run lint && npm run test && npm run build`.
4. Identify the root cause (see `docs/debugging.md`).
5. Apply the smallest fix.
6. Re-run the full suite before pushing.

Never disable a failing test without documented justification.
Never suppress a type error without documented justification.

---

## 9. Dependency Discipline

Rules:

1. All dependencies must be declared in `package.json`.
2. No hidden transitive reliance.
3. No local path imports.
4. No absolute filesystem assumptions.
5. Avoid large dependencies — assume mobile plus slow network.
6. Prefer built-in browser capabilities over third-party libraries.

---

## 10. Absolute Prohibitions

- No skipping tests (`test.skip`, `it.skip`) without justification.
- No suppressing type errors (`@ts-ignore`, `as any` at boundaries).
- No ignoring failing hydration warnings.
- No force-pushing to `master`.
- No weakening lint rules to make CI pass.
- No removing required CI jobs.
- No bypassing the test report discipline.
- No committing `test.only`.

---

## 11. Final Principle

CI enforces:

- Structural integrity
- Type contract compliance
- Test integrity
- Build correctness
- Deterministic, traceable outputs

If CI fails, the architecture contract was violated.

Fix the violation.
Do not weaken the guard.
