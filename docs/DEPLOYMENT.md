# Deployment and Docker Preview

Docker is an optional production-style preview. `npm run dev` validates the
local development environment and starts the normal host Next.js dev server;
it does not start or check Docker. `npm run dev:docker` opts into the
production-style Docker preview.

## Requirements and commands

Persistent observability uses one Neon database and two independent Vercel
projects from the same GitHub repository:

```text
repository root  → public Vercel project → iworkhere.space
dashboard/       → separate Vercel project → dashboard.iworkhere.space
                  Vercel Authentication / All Deployments
                  same Neon database, read-only credential
```

Only the dashboard project enables Vercel Authentication → All Deployments.
The public site remains anonymously reachable. The dashboard has no public
navigation or sitemap registration and includes noindex/nofollow metadata; these
do not replace external deployment protection. No application auth is added.

### Public canonical-host policy

The canonical public origin is `https://iworkhere.space`. Application
canonical metadata, robots sitemap declaration, and generated sitemap URLs must
use that HTTPS apex host.

Host normalization belongs to Vercel/custom-domain configuration:

- `http://iworkhere.space/*` → `https://iworkhere.space/*`;
- `http://www.iworkhere.space/*` → `https://iworkhere.space/*`;
- `https://www.iworkhere.space/*` → `https://iworkhere.space/*`.

Use permanent redirects with the shortest practical chain. Next.js may continue
to normalize trailing-slash route variants to the canonical non-trailing-slash
route. Redirecting HTTP, `www`, or trailing-slash variants are not sitemap
targets and are not expected to be indexed separately.

Do not duplicate the host redirect in application middleware or
`next.config.ts` when Vercel already owns the canonical-domain redirect.
Before the v0.4.0 implementation plan is frozen, verify the current Vercel
custom-domain state because Google retains historical `www` indexing evidence.
If the deployed domain configuration differs from this contract, correct the
deployment/domain layer first. Search Console recrawl/index inclusion is
monitored separately and does not justify changing correct canonical behavior.

See
[the pre-v0.4 indexing checkpoint report](reports/PRE_V0_4_INDEXING_CHECKPOINT_2026-10-07.md).

Follow [exact later setup](../dashboard/DEPLOYMENT.md), including
Marketplace → Neon, writer/read-only credentials, explicit migration,
production environment variables, daily public-project cron and mandatory
deployment protection. No external resources or secrets are configured by code.
Public Docker packaging excludes dashboard/ and defaults persistence false.

Install Docker Desktop on Windows, or Docker Engine with the Compose plugin on
Linux/macOS. On Windows, `npm run docker:ready` silently checks/starts Docker
Desktop and waits for its engine (180 seconds by default; override with the
positive integer `DOCKER_START_TIMEOUT_SECONDS`). The supported local/CI Node
runtime is `24.x`; Docker stages use the digest-pinned
`node:24-bookworm-slim` base.

```sh
npm ci
npm run dev                 # normal development
npm run dev:web              # raw Next.js dev server (without the environment wrapper)
npm run dev:check            # validate Node 24 and repository prerequisites
npm run docker:ready        # optional Docker Desktop readiness check
npm run dev:docker           # build and run the production preview
npm run dev:docker:down      # stop the Compose preview
npm run test:container      # hardened image and browser validation
```

The Docker image uses Next.js standalone output and runs its generated
`server.js` on internal port `3000` as a non-root user. Compose publishes
`3000:3000`; other platforms can map their service port to container port 3000.
`GET /api/health` returns `{"status":"ok"}` and is the image health check.

The runtime image contains the standalone trace, static/public assets and
third-party notices. The application runs without local `.env` files. The
container smoke gate exercises a read-only root filesystem, a temporary `/tmp`,
and the existing desktop/mobile Playwright suite against the running container.
Set `E2E_BASE_URL` only when intentionally running that same suite against an
already-running external runtime; otherwise Playwright owns its normal local
production server. External-runtime mode does not require a host `.next` build;
the browser suite validates the selected runtime. Container smoke builds the app
inside Docker and runs that same suite against the live container.

## Browser runtime assets

The release-prepared v0.3 source additionally serves same-origin
`/vendor/pdfjs/6.4.299/` (native worker and standard fonts) and
`/vendor/qpdf/12.4.2/` (pinned JS/WASM), with manifests and retained licenses.
pdf-lib 1.17.1 runs only in its bundled dedicated mutation worker. Engines
activate at operation time; normal builds consume committed artifacts rather
than compiling QPDF. User PDF/image processing remains browser-local, with no
conversion endpoint. PDF assets cache on demand and are not shell precache.
Batch 6 validated these candidate assets in the non-root standalone container;
that evidence does not deploy v0.3 or describe current live production assets.

The service worker and manifest are served from the application origin. The
HEIC decoder remains lazy: its Worker and decoder assets load from local
application assets after a HEIC source is selected, with no external conversion
service. The runtime retains
`/licenses/heic-to-LICENSE.txt` and
`/licenses/libheif-COPYING.txt`, plus `/THIRD_PARTY_NOTICES.md`.

For internet-facing hosting, run the application behind the platform ingress,
load balancer, or a separately managed reverse proxy. TLS termination and
deployment are outside this application image. No Docker registry publication
or automated deployment is configured. The owner approved the HEIC
production-license gate after reviewing the evidence bundle. Exact-SHA hosted
readiness passed for the frozen v0.2 implementation candidate; its release
preparation sets `HEIC_RELEASE_READY=YES` and `V0_2_RELEASE_READY=YES`.
The earlier pre-deployment state is historical; Delivery 2 production launch
is recorded below. The v0.3.0 source candidate passed readiness and release
preparation with application package metadata at 0.3.0, and was later
integrated and deployed. Its release-prepared PDF assets describe the current
live production runtime recorded below.

## Opt-in production integrations

See [ADVERTISING](ADVERTISING.md) and [OBSERVABILITY](OBSERVABILITY.md). NEXT_PUBLIC_ADSENSE_ENABLED and NEXT_PUBLIC_OBSERVABILITY_ENABLED default false; exact true is explicit opt-in. Next public flags are baked at build time. Docker builder accepts each as a build argument with false defaults. Container validation forces false. Rebuild after changing flags; a runtime variable alone cannot activate an already-built browser bundle. Ad activation additionally requires verified ownership, site Ready, ads.txt Authorized and applicable Google-certified CMP / Privacy & messaging. Meta and ads.txt work while disabled. No public activation or deployment is performed by this implementation. Runtime stdout remains active; explicit server-only OBSERVABILITY_PERSISTENCE_ENABLED=true additionally enables Neon writes through OBSERVABILITY_DATABASE_URL. CRON_SECRET protects public-project maintenance. Dashboard uses only OBSERVABILITY_DASHBOARD_DATABASE_URL with read-only grants; no secret is NEXT_PUBLIC.

## v0.3.1 Vercel Web Analytics integration

v0.3.1 was formally released and publicly deployed on 2026-10-06. Vercel Web
Analytics is enabled for the public Production deployment, with URL query/hash
redaction and no Vercel custom events. The public Vercel project continuously
deploys `master`; this deployment behavior is independent of numbered release
integration. The later v0.4.0 source release completed on 2026-10-08; its deployment
identity and acceptance must be verified separately from this historical launch. See the verified
[v0.3.1 launch report](reports/V0_3_1_VERCEL_WEB_ANALYTICS_LAUNCH_REPORT.md).

The public build-time flag is `NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=true` for
Production only. Preview, Development, local E2E and container builds remain
off by default. The app-owned `beforeSend` policy strips URL queries and
fragments and drops malformed or unexpected events.

No public route denylist is currently needed.

Version 2 uses Vercel Resilient Intake, so validation must not hard-code one
fixed analytics script/intake URL. Enabling Web Analytics can create
Vercel-managed insight/intake routes after deployment. No analytics token or
browser secret belongs in repository environment files.

The independent protected dashboard project is not enrolled in this feature by
default. Speed Insights, custom Vercel events and Web Analytics API ingestion are
separate future decisions.

See the frozen [Vercel Web Analytics integration plan](plans/v0.3.1-implementation-plan.md),
the [implementation evidence](reports/V0_3_1_VERCEL_WEB_ANALYTICS_IMPLEMENTATION_REPORT.md),
the [documentation reconciliation audit](reports/V0_3_1_DOCUMENTATION_RECONCILIATION_REPORT.md),
and [Production observability](OBSERVABILITY.md).

## Environment variable contract

The committed `.env.example` and `dashboard/.env.example` files contain safe
local defaults and empty secret placeholders. Secret-bearing env files are
ignored by Git. The matrix below describes source reads, not configured
production state.

| Name | Owner / visibility | Required when | Default / off behavior | Production | Preview | Development | Secret? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_OBSERVABILITY_ENABLED` | Root / public build-time | Browser transport intentionally enabled | Unset/false uses local providers only | False until explicitly activated | False | False | No |
| `NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED` | Root / public build-time | Public Web Analytics intentionally enabled | Only exact true enables; unset/false is off | True only after external public-project activation | False | False | No |
| `OBSERVABILITY_PERSISTENCE_ENABLED` | Root / server-only | Durable metric writes intentionally enabled | Unset/false skips Neon connection | False until provisioned | False | False | No |
| `OBSERVABILITY_DATABASE_URL` | Root / server-only | Persistence enabled | Empty; no DB connection | Writer credential after schema migration | Empty; never production DB | Empty or isolated local DB | Yes |
| `CRON_SECRET` | Root / server-only | Public maintenance cron configured | Empty; endpoint fails closed | Set after cron setup | Empty | Empty | Yes |
| `NEXT_PUBLIC_ADSENSE_ENABLED` | Root / public build-time | External AdSense gates pass | Unset/false renders no script or slots | False until ownership/site/CMP readiness | False | False | No |
| `OBSERVABILITY_DASHBOARD_DATABASE_URL` | Dashboard / server-only | Dashboard requests need database results | Empty; dashboard shows unavailable state | Read-only credential after project protection | Empty; never production DB | Empty or isolated read-only DB | Yes |
| `NODE_ENV` | Next.js / runtime | Set by Next.js | Framework-managed; do not set manually in deployment | `production` | `production` for deployed preview | `development` for `next dev` | No |
| `E2E_BASE_URL` | Playwright / test runner | E2E intentionally targets an already-running runtime | Unset; Playwright manages its local production server | Not an app setting | Not an app setting | Optional external test target | No |
| `E2E_RUN_ID` | Playwright / test runner | E2E report identity override | Generated when unset; container smoke supplies it | Not an app setting | Not an app setting | Optional test report override | No |
| `VITEST_RUN_ID` | Vitest / test runner | Shared report identity supplied by verify/CI | Generated when unset | Not an app setting | Not an app setting | Generated or supplied by tooling | No |
| `DOCKER_START_TIMEOUT_SECONDS` | Windows dev helper | `npm run docker:ready` needs a custom wait limit | 180 seconds | Not applicable | Not applicable | Positive integer override; unset uses 180 | No |

Production and Preview values are external operator configuration. Public flags
are compiled into the client bundle; changing them requires a new build. Do not
put credentials in public-prefixed variables. Root and dashboard deployments
must not share a writable dashboard credential.

`ComSpec` and `npm_execpath` are read only as Windows/npm process-launch
facilities by helper scripts. `NEXT_TELEMETRY_DISABLED` is set internally by
validation helpers. `VERIFY_TEST_VALUE` is isolated to the verify-script test
fixture. They are not deployment variables and must not contain credentials.


## Exact-SHA diagnostic hotfix deployment

For CLI production uploads, supply the tested commit as both runtime/build VERCEL_GIT_COMMIT_SHA; deployment metadata alone did not populate it. Keep this value per deployment, not pinned at project scope. Apply additive observability migrations and read-only grants before deploying protected dashboard then public app. See dashboard/DEPLOYMENT.md and the durable production diagnostic hotfix report. The 2026-10-03 diagnostic hotfix report records the deployment state before Delivery 2 integration. Current public
production state is recorded below.

## Historical public production launch — 2026-10-06

The public Vercel project is `iworkhere-space`, linked to this GitHub repository
with automatic production deployment from `master`.

Release at the time:

`v0.3.1` — Vercel Web Analytics

v0.3.1 release merge / launch source:

`2c8c1dec611b228a73137c5ee8ae0a5cd60caab0`

v0.3.1 launch deployment:

`dpl_67zHEP485iQtHBiM4VNPaURo4iw6`

v0.3.1 launch deployment URL:

https://iworkhere-space-6f1o35an4-dailephds-projects.vercel.app

Public domain:

https://iworkhere.space

The deployment became READY at `2026-10-06T22:27:59.138Z`. Web Analytics is
enabled on the public project and
`NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=true` is scoped to Production only;
Preview and Development remain off. Live acceptance verified automatic
page-view traffic, client navigation, query/hash redaction, file-input privacy,
no custom Vercel events, clean browser diagnostics and aggregated page-view data
receipt. Existing application observability and the separately protected
`iworkhere-observability` dashboard remained healthy.

Historical Delivery 2 and v0.3.0 deployment records remain valid historical
evidence but are not current production state.

Because the public Vercel project automatically deploys later `master`
commits, a documentation-only merge may create a newer production deployment SHA
without changing application runtime behavior. The source/deployment above is
therefore the durable v0.3.1 launch identity, not a promise that it remains the
newest Vercel deployment forever. Query Vercel deployment metadata when the
operationally current deployment ID/SHA is required.

## v0.4.0 source release — 2026-10-08

The current root application package version is `0.4.0`. PR #21 merged into
`master` at `b619920048239e1b60ea20c4db5a4d0f01bdcd39`; the annotated
tag `v0.4.0` and the published GitHub Release identify that same commit. It
contains 18 registered utilities and seven populated categories. Pre-merge
production checks on 2026-10-08 reported 27 sitemap URLs and HTTP 200 for
the JSON Formatter, Word / Character Counter and QR Code Generator routes.

Because Vercel deploys `master` continuously, the GitHub release alone does
not prove the identity, health, or completion of the post-merge production
deployment. Verify current Vercel deployment ID, source commit, domain, route
health and browser acceptance independently before marking v0.4.0's numbered
release as production-accepted. Do not replace the durable v0.3.1 launch
identity above with an inferred deployment record.

## Vercel Analytics build defaults

`NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED` is a public build-time flag, not a secret.
Only exact `true` enables the integration. Production currently sets it to
`true`; Preview and Development remain absent/off. Docker exposes the flag as a
builder ARG with false default. Container smoke explicitly passes false; normal
Playwright server and PDF foundation validation also force false. Changing
runtime environment alone cannot activate an already-built browser bundle.

`npx tsx script/vercelAnalyticsSmoke.ts` builds an isolated copied project under `.my-dev-kit-workflow/` and writes unique evidence under `test-report/`. It does not overwrite the normal `.next` build or contact live intake. Image/document processing remains browser-local while explicitly enabled aggregate page views may use the network.
