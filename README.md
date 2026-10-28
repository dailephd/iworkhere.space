# iworkhere.space

Documentation-first utility tools built with Next.js, React, TypeScript, and
Tailwind CSS.

The current release candidate is application version v0.4.4. It includes 18 registered utilities
across seven populated categories, five original verified worked examples, a
task-first homepage, improved Discover navigation and category guidance,
publisher About and Contact pages, privacy improvements, and 30 canonical
public routes. The header is fixed and the footer is ordinary document-flow
content with its conditional Report Issues action. Contact uses the direct
Resend integration
with a sender and recipient configured externally; Production delivery was
verified on 2026-10-21. The v0.4.2 issue-reporting entry remains conditional on
`NEXT_PUBLIC_SUPPORT_ENABLED=true`; Report Issues and advertising remain
default-off. Source integration, GitHub Release publication, and Vercel
Production deployment are distinct release records. Production deploys from
`master`.
The earlier v0.4.1 release introduced a homepage that grouped tools by
category. The current application retains those utilities and Calculator accepts
keyboard `=`; the existing appearance system includes six named palettes with
Light, Dark and System modes plus fixed-dark One Dark; and Converters owns
Length and Weight while QR Code Generator belongs to Developer. The historical
v0.4.0 release added the canonical `developer` category, JSON Formatter /
Validator, Word / Character Counter, and QR Code Generator. JSON formatting
and counter input remain browser-local; QR generation and PNG download are
browser-local. The private dashboard remains an independent application at
version `0.1.0`. The public Vercel project continuously deploys `master`;
deployed application source and numbered GitHub releases are distinct. The
historical `v0.4.1` release tag points to `master` commit
`90a718458e6fd2e3e80eb190cd7d55748bd1f6bb` (PR #32). Vercel Web Analytics
measures automatic page views only in
public Production with URL query/hash redaction; application observability is
separate and no Vercel custom events are sent. See [deployment documentation](docs/DEPLOYMENT.md)
and [the changelog](CHANGELOG.md).

## v0.4.4 release preparation

[v0.4.4 — Site Quality & Search Recovery](docs/plans/v0.4.4-implementation-plan.md)
is implemented on the `release/v0.4.4` candidate. Its local validation includes
the calculator correction, security-clean dependency audits, default-off,
preview-denial and stubbed enabled advertising checks, browser tests and the
production-container gate. The candidate is release-prepared but not published
or production-deployed; exact-SHA hosted validation remains pending. The
[October 26 audit](docs/reports/ADSENSE_QUALITY_AUDIT_2026-10-26.md) records
the original findings and their limits. The [roadmap](docs/ROADMAP.md) retains
the planned v0.5.0/v0.6.0 catalogs. The `/guide` hub and four task guides are
documented in [Practical File Workflows](docs/modules/TaskGuide.md), and the
implementation history remains in the [implementation report](docs/reports/V0_4_4_SITE_QUALITY_IMPLEMENTATION_REPORT.md).

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
npm run support:migrate   # Apply database/support migrations (operator credential required)
npm run test:support-db   # Support database tests (disposable PostgreSQL)
npm run test:support-e2e  # Support-enabled browser journey (disposable PostgreSQL, provider doubles)
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
CI/verify is independent and requires no production secret. Production services and deployment settings are configured separately; see [deployment documentation](docs/DEPLOYMENT.md) for their requirements.

The repository has eight GitHub Actions workflow files. Its public-app
workflows define seven required jobs because `e2e.yaml` contains both `e2e` and
`e2e-support`; the dashboard and observability database workflows add two more,
for nine required jobs total:

- `typecheck.yaml` — `npm run typecheck`
- `lint.yaml` — `npm run lint`
- `test.yaml` — `npm run test`
- `build.yaml` — `npm run build`
- `e2e.yaml` — `e2e` runs `npm run test:e2e`; `e2e-support` selects `footer-flow.spec.ts`, `v0.4.2-integration.spec.ts` and `v0.4.3-contact-footer.spec.ts` in a support-enabled build
- `container.yaml` — `npm run test:container` (Docker production runtime and browser gate)

Separate `dashboard.yaml` and `observability-db.yaml` workflows validate the
private dashboard and disposable PostgreSQL schema/maintenance path. The
repository therefore has eight workflow files and nine required jobs in total; see
[CI/CD](docs/CI_CD.md) for artifact and trigger details.

All eight workflows run on pull requests and pushes to `main`, `master`, and
`validation/**`. The validation namespace is reserved for immutable exact-SHA
pre-release checks; see [CI/CD](docs/CI_CD.md).

`npm run verify` runs typecheck, lint, test and build; E2E remains separate.
`npm run test:container` reuses the browser suite against a built Docker image.
Neither E2E nor Container is part of `npm run verify`. Historical v0.2.0
readiness passed at the implementation SHA recorded in [CI/CD](docs/CI_CD.md).
v0.3.0 local implementation validation is recorded in its
[implementation report](docs/reports/V0_3_0_PDF_DOCUMENT_ESSENTIALS_IMPLEMENTATION_REPORT.md).

All nine required jobs must pass for a pull request. The local aggregate
command does not replace them.

Docker is optional for local development. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
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

- `docs/plans/v0.4.3-implementation-plan.md` — frozen five-batch v0.4.3 scope and acceptance
- `docs/ROADMAP.md` — canonical version-level goals, scope, dependencies,
  exclusions, acceptance, and deferred work
- `docs/project-status.md` — actual current implementation and exact next action
- `docs/doc_index.md` — documentation ownership and planning/implementation
  reading paths
- `docs/architecture.md` — architectural boundaries
- `docs/CI_CD.md` — continuous-integration gates
- `docs/TESTING.md` — testing strategy
- `docs/DEPLOYMENT.md` — Vercel/runtime contracts and environment variable matrix
- `docs/ADVERTISING.md` and `docs/OBSERVABILITY.md` — opt-in integrations and privacy
- `dashboard/README.md` — independent dashboard application
- `dashboard/DEPLOYMENT.md` — external dashboard protection/deployment steps

When an implementation version begins, its concrete batch/validation plan is
created under `docs/plans/vX.Y.Z-implementation-plan.md` after current
repository inspection and fresh my-dev-kit retrieval. The roadmap intentionally
does not prewrite those batches.

## Production telemetry and advertising

Application observability and advertising have separate explicit build-time
activation gates; Vercel Web Analytics is independently enabled in public
Production. See [observability](docs/OBSERVABILITY.md) and [advertising](docs/ADVERTISING.md) for explicit build-time flags, privacy contracts and activation gates. Verification meta and /ads.txt are available without enabling ads. Repository validation does not prove AdSense account readiness, CMP configuration, real serving or revenue.
