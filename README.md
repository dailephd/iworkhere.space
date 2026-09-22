# iworkhere.space

Documentation-first utility tools built with Next.js, React, TypeScript, and
Tailwind CSS.

## Getting Started

```bash
npm ci
npm run dev
```

## Development Commands

```bash
npm run dev          # Start the development server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript type checking
npm run test         # Vitest tests
npm run verify       # Aggregate local validation with shared reports
```

`npm run verify` runs typecheck, lint, test, and build in order. It generates
one unique `RUN_ID`, stops on the first failure, and captures each executed
command's stdout and stderr under `test-report/<RUN_ID>/command/`. The test
step receives `VITEST_RUN_ID`, so its JSON and JUnit reports use the same run
directory.

## CI

GitHub Actions keeps the four validation jobs independent:

- `typecheck.yaml` — `npm run typecheck`
- `lint.yaml` — `npm run lint`
- `test.yaml` — `npm run test`
- `build.yaml` — `npm run build`

All four jobs must pass. The local aggregate command does not replace them.

## Architecture

The application preserves four layers:

- `src/app` — routes and page composition
- `src/module` — domain and platform modules
- `src/component` — reusable UI components
- `src/lib` — generic helpers

Tool definitions are registered through the canonical tool registry. Browser
persistence uses the existing storage abstraction, and analytics/logging use
their existing provider abstractions.

## Testing Reports

Each Vitest run writes JSON and JUnit output under a unique
`test-report/<RUN_ID>/` directory. The `test-report/` directory is gitignored.

## Documentation

- `doc/ROADMAP.md` — canonical version-level goals, scope, dependencies,
  exclusions, acceptance, and deferred work
- `doc/project-status.md` — actual current implementation and exact next action
- `doc/doc_index.md` — documentation ownership and planning/implementation
  reading paths
- `doc/architecture.md` — architectural boundaries
- `doc/CI_CD.md` — continuous-integration gates
- `doc/TESTING.md` — testing strategy

When an implementation version begins, its concrete batch/validation plan is
created under `doc/plans/vX.Y.Z-implementation-plan.md` after current
repository inspection and fresh my-dev-kit retrieval. The roadmap intentionally
does not prewrite those batches.
