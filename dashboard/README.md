# iworkhere.space operational dashboard

An independent Next.js 16.3.8 / React 19.2.3 app on Node 24.x. Production reads
the public application's ONE Neon observability database using a SELECT-only
role. No application authentication, account model, login page or sessions exist.
Vercel Authentication with All Deployments must protect this separate project.
See [deployment setup](DEPLOYMENT.md) before exposing it.

```powershell
cd dashboard
npm ci
npm run build
npm run dev
```

`dashboard/` is independently installable and buildable without the repository
root `node_modules`. It owns a local empty PostCSS configuration because its
styles are plain CSS and it does not use Tailwind; the root application's
Tailwind/PostCSS configuration does not apply here.

Local port is 3001. Configure server-only
`OBSERVABILITY_DASHBOARD_DATABASE_URL` using a dedicated development/read-only
connection. Do not casually reuse production credentials. Missing configuration
fails closed with the dashboard's unavailable page, without metrics or credentials.
Build does not require a database and does not execute queries; the page uses
dynamic server rendering. SQL is parameterized and runs in a read-only consistent
snapshot. The database module has a `server-only` import guard.

`npm run test:runtime` checks the real production Next server with an explicitly
empty database configuration: HTTP 500, unavailable page, absent metrics and
noindex/nofollow/noarchive metadata/headers. It never connects to Neon. Database
queries project received/rollup times to UTC text so Neon Date objects never
reach React table/card children.

## Ranges and calculations

| Query value | Source | Display bins |
| --- | --- | --- |
| `24h` (default) | Raw, rolling 24 hours | Hourly |
| `7d` | Raw, rolling 7 days | Daily |
| `30d` | Raw, rolling 30 days | Daily |
| `90d` | Raw, rolling 90 days | Daily |
| `180d` | Daily history from UTC midnight 180 days ago + today's raw | Daily |
| `1y` | Daily history from UTC midnight one calendar year ago + today's raw | Weekly (Monday UTC) |
| `all` | All retained daily history + today's raw | Monthly |

Unknown/repeated/array values fall back to `24h`. Arbitrary date expressions
are not accepted. Ordinary query links provide navigation; no global client
state is used. Binning preserves all selected counts and does not fabricate
empty chart points. Daily/raw sources have disjoint complete-day/current-day
boundaries. Long-range counts show completed rollups; missed rollups are visible
through the freshness section. Recent failures show the latest 25 selected
client-error rows still present in raw storage (retention 90 days).

Recent vital cards calculate true range p75 using raw samples. Long-range cards
are labeled **Typical daily p75**: the unweighted median of retained daily
route/viewport-group p75 values, including today's incomplete raw groups. It is
not the exact full-range percentile and is not sample-weighted. Sample counts
remain exact for the selected source. CLS is unitless; other vitals use ms.
FID is shown only when there are accepted FID samples.

Navigations, tool opens/executions/copies/mode changes and client errors are
events, not users or sessions. Reliability failure count equals client-error
count; category, route and tool tables describe these same measurements.
Tool ranking uses opens + executions + errors, without a conversion-rate claim.
Viewport class uses CSS viewport width only: mobile <768px, tablet 768–1023px,
desktop >=1024px, absent/invalid width unknown. It does not identify hardware.
Referrers are safe hostnames only. AdSense and Search Console stay separate.

## Validation and visual smoke

`npm run verify` runs typecheck, lint, tests and build independently of the root
application and writes unique reports under `dashboard/test-report/<RUN_ID>/`.
CI runs the same command without production database credentials.

`npm run test:visual` renders the SAME server DashboardView using an isolated
deterministic fixture repository, hosts it on a temporary local HTTP port,
and captures desktop 24h/90d/1y/All time, mobile, and dark screenshots. The test
adapter is never imported or selected by production page/database code. No live
database is required. Install Playwright Chromium locally if necessary.

The operational interface uses ordinary HTML, CSS and inline SVG. System
light/dark comes from media preference. No chart framework, UI framework,
advertising, client-side Neon access or theme persistence is present. Robots
metadata and X-Robots-Tag are noindex/nofollow/noarchive defense in depth; they
are not access control.


## Diagnostic hotfix

Recent diagnostics show latest 25 retained client/server errors in the selected range (30-day detailed retention), actual name/message, UUID/fingerprint, route/tool/boundary/category, deployment and expandable stack/cause/component/runtime fields. Normal React escaping; bounded code regions; no client framework. Metric rows do not pretend legacy detail exists. SELECT-only snapshot now includes diagnostic query.
