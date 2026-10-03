# iworkhere.space

Documentation-first utility tools built with Next.js, React, TypeScript, and
Tailwind CSS.

The repository implements the v0.2.0 scope. Release preparation has bumped the
root package metadata to `0.2.0`; the independently deployed dashboard remains
at `0.1.0`. The root registry contains 10 tools, including four local image
utilities.

## Getting Started

```bash
npm ci
npm run dev
```

## Development Commands

```bash
npm run dev              # Check the environment, then start local Next.js
npm run dev:web           # Start raw Next.js dev server
npm run dev:check         # Validate Node 24 and repository prerequisites
npm run dev:docker        # Optional production-style Docker preview
npm run dev:docker:down   # Stop the optional Docker preview
npm run build             # Production build
npm run lint              # ESLint
npm run typecheck         # TypeScript type checking
npm run test              # Vitest tests
npm run verify            # Aggregate local validation with shared reports
```

`npm run dev` checks the local development environment and starts the normal
host Next.js dev server on port 3000. Docker remains optional; `npm run dev`
does not start or check Docker.

`npm run verify` runs typecheck, lint, test, and build in order. It generates
one unique `RUN_ID`, stops on the first failure, and captures each executed
command's stdout and stderr under `test-report/<RUN_ID>/command/`. The test
step receives `VITEST_RUN_ID`, so its JSON and JUnit reports use the same run
directory.

## CI

Persistent technical measurements optionally use Neon through `/api/metric`.
`/api/log` remains the compatible diagnostic path. The independently deployable
private dashboard lives in [dashboard/](dashboard/README.md); it must use a
read-only role and external Vercel Authentication → All Deployments on its own
project only. The public site remains public. See [database schema/maintenance](database/observability/README.md)
and [exact later deployment setup](dashboard/DEPLOYMENT.md). Run
`npm run observability:migrate` only with an explicitly configured development
or operator database; migrations never run on startup. Local SQL validation is
`npm run test:observability-db` with disposable Docker Postgres 17. Dashboard
CI/verify is independent and requires no production secret. No resources have
been provisioned or deployed by this review candidate.

GitHub Actions keeps six validation jobs independent:

- `typecheck.yaml` — `npm run typecheck`
- `lint.yaml` — `npm run lint`
- `test.yaml` — `npm run test`
- `build.yaml` — `npm run build`
- `e2e.yaml` — `npm run test:e2e` (production browser gate)
- `container.yaml` — `npm run test:container` (Docker production runtime and browser gate)

Separate `dashboard.yaml` and `observability-db.yaml` workflows validate the
private dashboard and disposable PostgreSQL schema/maintenance path. The
repository therefore has eight independent workflow jobs in total; see
[CI/CD](doc/CI_CD.md) for artifact and trigger details.

All eight workflows run on pull requests and pushes to `main`, `master`, and
`validation/**`. The validation namespace is reserved for immutable exact-SHA
pre-release checks; see [CI/CD](doc/CI_CD.md).

`npm run verify` runs typecheck, lint, test and build; E2E remains separate.
`npm run test:container` reuses the browser suite against a built Docker image.
Neither E2E nor Container is part of `npm run verify`. Hosted final-version PR
gates remain pending because no release PR exists.

All eight workflow jobs must pass for a pull request. The local aggregate
command does not replace them.

Docker is optional for local development. See [doc/DEPLOYMENT.md](doc/DEPLOYMENT.md)
for the production-style preview, readiness helper, and container validation commands.

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
- `doc/DEPLOYMENT.md` — Vercel/runtime contracts and environment variable matrix
- `doc/ADVERTISING.md` and `doc/OBSERVABILITY.md` — opt-in integrations and privacy
- `dashboard/README.md` — independent dashboard application
- `dashboard/DEPLOYMENT.md` — external dashboard protection/deployment steps

When an implementation version begins, its concrete batch/validation plan is
created under `doc/plans/vX.Y.Z-implementation-plan.md` after current
repository inspection and fresh my-dev-kit retrieval. The roadmap intentionally
does not prewrite those batches.

## Production telemetry and advertising

Both network integrations are disabled by default. See [observability](doc/OBSERVABILITY.md) and [advertising](doc/ADVERTISING.md) for explicit build-time flags, privacy contracts and activation gates. Verification meta and /ads.txt are available without enabling ads. Repository validation does not prove AdSense account readiness, CMP configuration, real serving or revenue.
