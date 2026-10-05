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

The unreleased v0.3 feature branch additionally serves same-origin
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
is recorded below. v0.3 remains unreleased and undeployed, with readiness and
release preparation not run and package version still 0.2.0.

## Opt-in production integrations

See [ADVERTISING](ADVERTISING.md) and [OBSERVABILITY](OBSERVABILITY.md). NEXT_PUBLIC_ADSENSE_ENABLED and NEXT_PUBLIC_OBSERVABILITY_ENABLED default false; exact true is explicit opt-in. Next public flags are baked at build time. Docker builder accepts each as a build argument with false defaults. Container validation forces false. Rebuild after changing flags; a runtime variable alone cannot activate an already-built browser bundle. Ad activation additionally requires verified ownership, site Ready, ads.txt Authorized and applicable Google-certified CMP / Privacy & messaging. Meta and ads.txt work while disabled. No public activation or deployment is performed by this implementation. Runtime stdout remains active; explicit server-only OBSERVABILITY_PERSISTENCE_ENABLED=true additionally enables Neon writes through OBSERVABILITY_DATABASE_URL. CRON_SECRET protects public-project maintenance. Dashboard uses only OBSERVABILITY_DASHBOARD_DATABASE_URL with read-only grants; no secret is NEXT_PUBLIC.

## Environment variable contract

The committed `.env.example` and `dashboard/.env.example` files contain safe
local defaults and empty secret placeholders. Secret-bearing env files are
ignored by Git. The matrix below describes source reads, not configured
production state.

| Name | Owner / visibility | Required when | Default / off behavior | Production | Preview | Development | Secret? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_OBSERVABILITY_ENABLED` | Root / public build-time | Browser transport intentionally enabled | Unset/false uses local providers only | False until explicitly activated | False | False | No |
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

## Current public production state — 2026-10-04

The public Vercel project is iworkhere-space, linked to this GitHub repository
with automatic production deployment from master. Current production source is
c8406412301ff382dcf4e10e00789e93caad6f39, deployment
dpl_48kp2LTbcC3Htczho459KZw1UCCy, at https://iworkhere.space. Delivery 2
technical launch checks passed. The observability dashboard remains a separate
project with Vercel Authentication protection; never expose credentials or
bypass values in deployment records.
