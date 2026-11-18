# Production observability

## Ownership and activation

Tools continue to call the observability facade. Existing analytics and logging provider interfaces select the sink. `NEXT_PUBLIC_OBSERVABILITY_ENABLED=true` explicitly selects network analytics and the sanitized RustLogProvider in early client instrumentation. Absent/other values retain local behavior; production mode alone never activates telemetry. The Neon dependency `@neondatabase/serverless@1.1.0` remains server-only; Vercel page-view analytics is independently gated below. Public flags are baked into the browser bundle: rebuild after changing them.

## v0.3.1 Vercel Web Analytics boundary

v0.3.1 is live in the public `iworkhere-space` Vercel project. Vercel Web
Analytics is an additive platform traffic surface, not a replacement for the
application observability facade, `/api/metric`, `/api/log`, Neon persistence,
Web Vitals, diagnostic error capture, or the protected observability dashboard.

The release uses exact-pinned `@vercel/analytics` 2.0.1 for automatic page
views and client-side route transitions. The root layout composes one app-owned
Analytics wrapper; tool components do not import or call Vercel Analytics
directly.

Activation is exact-true and build-time. Production sets
`NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=true`; Preview, Development, local E2E
and container validation remain off. The public flag is not a secret. Live
production acceptance on 2026-10-06 verified provider activity, client
navigation, query/hash redaction, no duplicate wrapper, file-input privacy and
aggregated page-view receipt. Existing observability continued to return normal
Web Vitals metric responses during the launch smoke.

Vercel documents automatic page-view collection as potentially including URL,
filtered query parameters, referrer, coarse geolocation, OS/browser and device
type. To preserve this application's stricter URL policy, the wrapper's
`beforeSend` sanitizer removes query strings and fragments before transmission
and drops malformed or unexpected events. No public route denylist is needed.
The existing application
telemetry prohibition on file contents, filenames, document/image properties,
entered text, generated output, storage/authentication data and raw diagnostic
payloads remains unchanged.

The first delivery does not call Vercel `track()`. Existing
`tool_opened`, `tool_executed`, `tool_result_copied` and
`tool_mode_changed` events remain owned by the current analytics abstraction
and observability pipeline. If Vercel custom events are authorized later, they
must be exposed through an app-owned provider/adapter and the canonical
allowlist rather than direct calls from tools.

Speed Insights, Web Analytics API ingestion, analytics data replication into
Neon, analytics cards in the private dashboard, and replacement of the current
analytics provider are out of scope for the first delivery.

Both same-origin endpoints continue writing a structured server log per accepted request. `/api/log` and RustLogProvider retain their existing sanitized technical-diagnostic contract; they write dedicated diagnostic records when persistence is enabled, without adding text to metric tables. `/api/metric` is the sole durable measurement ingestion owner. With `OBSERVABILITY_PERSISTENCE_ENABLED=true`, it inserts explicit allowlisted columns into Neon through `persistence.server.ts`; otherwise it logs and returns 204 without a connection. Successful inserts return 204. Missing configuration/database failures return empty 503 and a fixed safe operational error, without raw SQL diagnostics or credentials. Browser providers remain fail-silent. Inspect server logs by `source=application-metric`, `application-log`, or `observability-operation`. No identity, session history or profiling is collected.

## Privacy contract

The document family emits only safe tool identity after verified success.
PDF/image bytes, filenames, MIME, byte sizes/savings, page counts or geometry,
page ranges, output settings, extracted text, document metadata and result URLs
remain local and never enter telemetry, URL state, storage or upload payloads.
Compress PDF's NO REDUCTION ACHIEVED outcome emits no success measurement.
Local processing does not imply zero network traffic: ordinary application/
runtime assets and explicitly enabled safe site observability remain possible.

Allowed metric transport fields: ISO timestamp, pathname only, canonical event/tool ID/slug, Web Vital name/value/delta/id/rating/navigation type, initial referrer hostname, and optional bounded deviceClass. Diagnostic logs independently preserve redacted Error fields, useful stacks/causes/children and explicit runtime/component context. The `client-error` measurement variant permits only pathname, timestamp, failureCategory (window-error/unhandled-rejection/tool-render-error/unknown), optional toolId and deviceClass. No free-form diagnostic payload enters that variant. Transport projects explicit fields, validates them again, and server validators reject extra fields. Metric requests are limited to 8 KiB; diagnostic log requests permit 64 KiB, including chunked bodies. Fetch uses keepalive, omitted credentials and no referrer. Endpoint request headers are not logged or stored; server onRequestError permits only bounded safe x-vercel-id correlation.

Forbidden: File/Blob contents, filenames, image dimensions/data, entered text, calculator expressions, HTML input, generated output, full URL/query/hash, storage/cookies/authentication, application-collected IP address, raw referrer, object URLs and user-data stack metadata. The logger preserves ordinary developer-authored messages and structured Error fields after diagnostic-text redaction. Useful stacks, nested causes and AggregateError children survive within bounds. Context is projected explicitly; arbitrary metadata and application objects are excluded. The console provider also redacts messages and excludes unapproved metadata. Neither endpoint logs request headers, cookies or IP addresses. Hosting access logs are a separate operator concern.

`tool_opened`, `tool_executed`, `tool_result_copied` and `tool_mode_changed` remain canonical; mode values are omitted from transport. Image processing, local source primitives, filenames, URL state and HEIC worker isolation remain unchanged. No image-processing data is attached to advertising requests by application code.

## Runtime signals

The isolated WebVitals client uses Next `useReportWebVitals` with a stable module callback. It accepts LCP, INP, CLS, FCP, TTFB and FID when supplied, using sendBeacon with keepalive fetch fallback. Values are real browser observations; local validation does not establish production performance.

`src/instrumentation-client.ts` initializes providers before tool effects and captures window errors, unhandled rejections and router transition starts. Navigation strips query/hash. Global errors and ToolErrorBoundary explicitly send the bounded measurement through `errorMetric.client.ts` alongside captureError technical logging. Independent WeakSets deduplicate each sink by error object identity; the error object is never serialized by the metric helper. Repeated primitive reasons cannot use object-identity deduplication. All instrumentation and transports fail silently. Ad script/slot failures retain the logging abstraction; no separate ad analytics system exists.

DeviceClass is a coarse CSS viewport-width measurement only: mobile <768px,
tablet 768–1023px, desktop >=1024px, missing/invalid viewport unknown. The
central metric sender adds it; existing requests may omit it and persistence
normalizes to unknown. Metric records use no User-Agent or identity. Separate diagnostics include bounded User-Agent, viewport, online/visibility context, per-diagnostic UUID and error-grouping fingerprint; these never identify a user/session. Dashboard terminology is “Viewport class”.

## Database, retention and maintenance

Server-only configuration: `OBSERVABILITY_DATABASE_URL`,
`OBSERVABILITY_PERSISTENCE_ENABLED`, `CRON_SECRET`. Database and cron values
are secrets and must never use NEXT_PUBLIC names. The migration command is
`npm run observability:migrate`, explicitly run against an operator-configured
database, never at startup. See [database ownership](../database/observability/README.md).

The dedicated observability schema contains event, daily_event, daily_vital and
rollup_day. Inserts exclude client time, vital id/delta, diagnostic text/stacks,
arbitrary metadata and all prohibited input/file/identity data. Database now()
defines both occurred_at and received_at. Raw retention is 90 days; daily counts
and percentiles retain indefinitely. No hourly table or unique-user metric exists.

`GET /api/observability/maintenance` requires exact Bearer CRON_SECRET. Missing
configuration/invalid authorization returns 401; success 204; database failure
safe 503. One atomic database operation rolls up uncompleted complete UTC days,
replaces the last three complete days as a late-commit safety window, records
completion, and then deletes only eligible raw events whose day is completed.
Concurrent runs serialize with an advisory lock. Completed old aggregates are
never replaced from partial/pruned raw records. The public project's cron is
`15 2 * * *`; execution is approximate, not an exact-time guarantee.

When production persistence is enabled, available Origin/Sec-Fetch headers
must be consistent with same-origin browser requests. Missing headers remain
compatible. These checks are not cryptographic authentication. Infrastructure
abuse/rate limiting belongs to Vercel Firewall if later required. The application
does not collect IP addresses.

## Separate private dashboard

`dashboard/` is an independent Next.js project, with no app authentication and
server-only Neon read access. Production uses observability_dashboard credentials
with CONNECT, observability USAGE and table SELECT only. The public app remains
public. Vercel Authentication → All Deployments must be enabled only on the
second project `iworkhere-observability`; see its
[deployment instructions](../dashboard/DEPLOYMENT.md). Current production state (2026-10-04): the separate iworkhere-observability
project is deployed at https://dashboard.iworkhere.space with Vercel
Authentication enabled for All Deployments. Anonymous requests are redirected
to Vercel SSO. The public production app and persistence remain enabled and
were verified during the Delivery 2 launch. Credentials and secret values are
not documented here.

Ranges are exactly 24h/7d/30d/90d/180d/1y/All time, with canonical all and default
24h. Recent ranges query raw events and true full-range p75. Long ranges combine
complete daily aggregates and current incomplete raw UTC day, with disjoint
boundaries. “Typical daily p75” is the unweighted median of daily route/viewport
group p75 values, including today's incomplete groups; it is not full-range p75.
Long-range counts reflect successfully completed rollups; freshness identifies
maintenance gaps. UTC bins are hourly/daily/daily/daily/daily/weekly/monthly.
No arbitrary date expressions, users/sessions, geography, AdSense revenue or
Search Console data is added. Empty measurements show No data yet.

AdSense owns impressions, clicks, revenue, RPM, fill and viewability. App telemetry monitors technical effects such as CLS/LCP/INP and failures, not those business measurements.

## Contracts and references

See [SCHEMA](SCHEMA.md) for exact payloads, [ADVERTISING](ADVERTISING.md) for activation gates and [TESTING](TESTING.md) for automated evidence.

- [Next client instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client)
- [Next Web Vitals](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals)


## Structured diagnostic errors

Canonical diagnostic.ts preserves Error name/message/stack, primitive code/digest/status/statusCode/errno/syscall/type, causes to depth 5 with cycle detection and AggregateError children up to 10. Non-Error rejection primitives expose bounded redacted text/type; arbitrary objects/File/Blob expose no contents. Message maximum: 4 KiB; root stack: 24 KiB; component stack: 16 KiB. Nested error text shares a 40 KiB budget; cause/child stacks use 2 KiB to retain useful root stacks. Complete log requests are capped at 64 KiB; oversize requests are rejected.

A single diagnosticText redactor preserves ordinary debugging text and replaces Authorization/Bearer, cookie, password/token/API-key/secret assignments, secret-bearing environment-name assignments and credential URL userinfo with [REDACTED]. URL locations omit query/hash and retain useful terminal line/column references. No arbitrary metadata, user payload, input/output, storage or environment dumps are serialized.

Client context explicitly selects pathname, tool/boundary/category, user-agent (1 KiB), CSS viewport, pixel ratio, online/visibility and reporter timestamp. Per-diagnostic UUID is random; SHA-256 fingerprint groups normalized name/message/top stack frames, excluding UUID/time/browser/deployment. Server enrichment uses only Vercel commit/environment/region/hostname/deployment system variables. No server environment values are exposed to the browser.

For CLI deployments the operator must explicitly supply the tested SHA as runtime/build `VERCEL_GIT_COMMIT_SHA`; Git metadata alone is insufficient. See dashboard/DEPLOYMENT.md. Deployment context must be verified in the diagnostic record before accepting rollout.

Typed src/instrumentation.ts onRequestError captures method/canonical path, router/route type, render source, revalidation reason and runtime. Installed Next has no renderType; none is invented. Only bounded x-vercel-id correlation is eligible; Cookie/Authorization/arbitrary headers/body/forwarded IP are excluded.

Both capture paths emit severity JSON source=application-error before optional Neon diagnostic persistence. Logs work when Neon is unavailable. Persistence errors produce a fixed operational availability record and never recurse/crash capture. /api/log remains diagnostic ingestion; /api/metric remains measurement ingestion.

Additive 002 creates observability.error_diagnostic with typed searchable fields, bounded JSONB and received/fingerprint/path/tool indexes. prune_diagnostics(reference_time default now()) deletes strictly older than 30 days by database received_at; exact-boundary records remain. Maintenance invokes it after existing atomic metric maintenance. Metrics retain 90-day rolled raw/indefinite daily history unchanged.

Private dashboard adds a fifth read-only snapshot query for latest 25 diagnostics in the range. Actual messages, origin, IDs, deployment and runtime show in escaped ordinary HTML/native details, with bounded scrollable stack regions. Legacy metric rows contain no fabricated details. Production migration/grants must precede dashboard/public deployment.

## Vercel URL policy and validation

`vercelWebAnalytics.client.ts` accepts only page views, reconstructs HTTP(S) or root-relative URLs, removes search/hash, and returns only type and URL. Malformed inputs, credential-bearing URLs, non-HTTP schemes and custom events return null. No public private-route denylist is needed: the protected dashboard is a separate application. No tool/file/input/output fields are attached.

Focused unit tests own this policy and the invisible wrapper. `npx tsx script/vercelAnalyticsSmoke.ts` creates a separate copied production build with the flag true, runs the actual SDK and official vendor runtime in fresh desktop/mobile contexts with service workers blocked, and fulfills intake locally. It checks initial/client-navigation page views, query/hash and filename privacy, and browser diagnostics. The runtime ignores automation by default; this proof overrides webdriver detection only in its isolated test context. It records runtime source/hash and requests in a unique report. It proves local behavior, not live Vercel receipt.

## Support reports are outside observability (v0.4.2 Batch 1)

User reports (`/api/support/*`, `src/module/support`, `database/support`) are a separate domain. Report text, contact details and
challenge tokens are never sent through `/api/log`, `/api/metric`, the analytics or logging facades, Vercel Web Analytics or the
observability database, and the observability writer and dashboard roles hold no support privilege. Support code logs only fixed
`support-operation` objects (`operation`, `code`). The observability dashboard pages keep `OBSERVABILITY_DASHBOARD_DATABASE_URL`;
the `/support` pages use `SUPPORT_DASHBOARD_DATABASE_URL`. See [database/support/README.md](../database/support/README.md).

## Aggregate-only reporting core (Track B B1)

Implemented with synthetic fixtures inside the independent dashboard package:

- `aggregateQuery.ts` owns unchanged raw/daily source selection and vital SQL,
  reused by the dashboard and `reportingQuery.ts`. Reporting retrieves complete
  aggregate totals, per-tool activity, navigation routes, client-error categories,
  vital summaries and bounded freshness/reconciliation evidence only. No raw event
  records, support relations or diagnostic columns. SQL collapses unknown tool/route
  identities to null (Other) before retrieval, never arbitrary returned strings.
- `reportingModel.ts` explicitly constructs schemaVersion 1 `observability_report`.
  Request keys are exactly `schemaVersion` and `range`. Seven ranges only: `24h`,
  `7d`, `30d`, `90d`, `180d`, `1y`, `all`. Producer records and DTOs reject unknown
  keys at every depth, unsafe counts, invalid values/enums/identities, accessors,
  prototypes and serialization hooks. Validation runs again before serialization.
  DTO limit: 24 KiB UTF-8; reserve 64 KiB for the future complete MCP envelope.
  No string/JSON truncation, arbitrary filters, SQL or caller-selected timestamps.
- Totals cover the complete selected source before top-ten rankings. Omission
  counts describe ranked rows only. Tool activity ranks opens + executions + errors;
  execution ranking independently considers every tool. Routes rank navigations.
  Errors are the four client categories, not all server failures. Missing vitals
  have null value and zero samples. Raw `range_p75` and long-range
  `typical_daily_p75` retain the dashboard statistics; the latter is an unweighted
  median of daily route/viewport p75 groups including today's raw groups.
- UTC database receipt time and `rangePlan` remain authoritative. Rolling 24h is
  not yesterday. Daily history and incomplete current-day raw have disjoint
  midnight boundaries. Calendar-year/leap-day behavior is unchanged.
- `reportingDatabase.server.ts` owns a fixed three-statement transaction interface:
  read-only RepeatableRead, 15-second cancellation/deadline, 15-second server
  statement timeout and 128 KiB intermediate bound. It has no connection factory,
  secret or environment access. The B2 trusted adapter must enforce server timeout,
  cancellation and intermediate byte bounds using a separate reporting reader.
  Partial tuples and driver errors never become reports; exceptions use fixed codes.
- `reportingIdentity.json` is generated by root command `node --import tsx
  script/reportingIdentity.ts --write-reporting-identity`, from canonical tool and
  workflow metadata plus static app pages. Root tests enforce exact equality; never
  edit this deployment artifact independently. No React/tool implementation or root
  package imports enter the independently installable dashboard at runtime.

`reportingHealth.ts` assesses explicit evidence. Supported states:
HEALTHY_WITH_EVIDENCE, NO_RECENT_TRAFFIC, INGESTION_STALLED, ROLLUP_STALLED,
INGESTION_AND_ROLLUP_UNHEALTHY, INSUFFICIENT_EVIDENCE. Monitoring summaries cover
preceding rolling 24h as of report end; unresolved valid attempts must have passed
an independently established write deadline. Positive health requires accepted
attempts, complete independent monitoring/runtime-log coverage, successful cron
and reconciled retained days. No DB rows alone proves neither outage nor no traffic.
Failed attempts and failed cron are independent failure evidence. A latest timestamp
or successful dashboard render never proves health. B1 has no external monitoring
collector: without that evidence, fixture reports state INSUFFICIENT_EVIDENCE.

Evidence SQL examines every fully retained UTC raw day and completion marker,
plus older retained unrolled raw days. It detects interior missing days independent
of maximum day and compares raw event/vital sample totals with daily totals.
Yesterday is in grace until 03:15 UTC (02:15 schedule plus one hour); today is never
expected complete. The partially pruned retention-edge day and older pruned history
cannot be reconciled from raw data. Health is scoped to that evidence window.
Every DTO discloses events versus users, best-effort telemetry, possible pre-A1
duplicate opens, client-error-only coverage, retention, differing source/percentile
semantics, missing evidence versus zero activity, and unverified historical rollup
completeness. Selected-source totals do not assert complete telemetry. Proven gaps
remain visible. No guessed retroactive duplicate-open correction is applied.

### Required future reader permission contract (not provisioned)

Separate non-owner, non-superuser, non-inheriting, no-BYPASSRLS role: CONNECT only,
observability USAGE only, SELECT on these columns only:

| Relation | Required columns |
| --- | --- |
| observability.event | occurred_at, received_at, kind, pathname, tool_id, event_name, failure_category, metric_name, metric_value, device_class |
| observability.daily_event | day, kind, pathname, tool_id, event_name, failure_category, count |
| observability.daily_vital | day, metric_name, sample_count, p75 |
| observability.rollup_day | day |

No support/diagnostic access, function EXECUTE, sequences, writes, DDL, ownership,
privileged memberships, CREATE or TEMP. Existing dashboard role includes diagnostic
SELECT and must not be reused. Provisioning, effective-grant introspection, secrets
and real connection integration are B2/B3 work. No role SQL or migration changed.

NOT IMPLEMENTED: separate reporting application, MCP endpoint, OAuth/enrolled-operator
authorization, production reporting role/secret, remote ChatGPT connection, live
DB/runtime health verification or production deployment. B1 is not a working
ChatGPT integration. Existing dashboard UI/SSO remains unchanged. Root TypeScript,
ESLint and Docker context continue to exclude dashboard production source.

## Authenticated cloud MCP service (Track B B2, local only)

`reporting/` is the separate Node 24 Next.js service. Its official MCP SDK v2
Streamable HTTP endpoint `/mcp` and public protected-resource discovery expose
only `observability_report`. The unchanged B1 core owns all range, aggregation,
projection, DTO and health semantics. Private adapters add verified JWT access
tokens, per-request active RFC7662 introspection, required `reporting:read` and
explicit server-managed subject enrollment before any reporting query. No custom
authorization server or production test bypass exists. See reporting/README.md
for provider claims/registration prerequisites, failure behavior and local commands.

The separate `observability_reporting` role template in
`database/observability/reporting-role.sql` grants only B1-required columns. It
refuses existing roles or unsafe PUBLIC privileges and does not apply automatically.
The service uses read-only RepeatableRead, SQL timeout, abort and upstream bounds;
B1 validates the 24 KiB DTO before the 64 KiB complete MCP wire bound. Raw support,
diagnostic and arbitrary database records cannot bypass projection. No input,
credential or raw exception logging is introduced. Missing independent monitoring
evidence remains INSUFFICIENT_EVIDENCE; local fixtures do not establish live health.

B2 is locally implemented, not deployed. No production OAuth client, role, secret,
Neon connection or ChatGPT link was created. The existing public app and dashboard
UI remain unchanged, including dashboard Vercel Authentication on All Deployments.
The reporting package installs/builds/tests independently and is excluded from
public root TypeScript/lint and Docker context; CI uploads its unique reports.

## Production integration preparation (Track B B3, 2026-11-16)

The B1/B2 statements above describe their batch-close state. B3 created the
separate Vercel `iworkhere-reporting` project and applied the reviewed reporting
role template to the existing observability database. Its production-only reader
secret is managed by Vercel. Effective column grants, no role memberships,
read-only defaults, query timeout and denied write/DDL/support/diagnostic
privileges were verified through a private operator connection. All seven ranges
passed the existing B1 DTO and B2 size boundaries with live aggregate reads.
No telemetry records, rollups or historical analytics were modified.

Private reporting remains fail-closed pending actual Stytch Live token validation
and explicit subject enrollment. The existing authorized Stytch Live issuer and a
confidential OAuth client are configured; no new identity-provider project or
database was provisioned. Public discovery does not grant reporting access.
See reporting/README.md for provider compatibility and account actions. This is
not a working ChatGPT connection. Missing independent ingestion/runtime coverage
continues to produce `INSUFFICIENT_EVIDENCE`, even with recent rows and no gaps in
the inspected completed-day coverage. Dashboard SSO stays enabled on all deployments.

Hosted reporting CI independently installs, typechecks, lints, tests and builds
the service, exercises the built fail-closed runtime, and verifies the exact role
template and seven B1 query plans against isolated PostgreSQL. No production
credentials are used by CI; complete unique report directories are uploaded.

Stytch Test rotation acceptance uses an explicitly labelled synthetic aggregate
mode in the reporting Preview only. It reuses B1 projection/validation without
database access or dashboard diagnostic fixtures. A separate sensitive next-secret
slot retains the primary credential until real replacement OAuth, all seven report
ranges, revoked-token rejection and other authorization gates pass. Test fixture
mode rejects production environments/resources and any database credential. See
reporting/README.md for exact configuration; this does not activate production
reporting or establish a live ChatGPT connection.

`/oauth/live/authorize` prepares a separate Live login/consent page in the existing
reporting application, reusing its Stytch component with a separately configured
Live public SDK token. Test sign-in remains separate. The page fails unavailable
without Live SDK configuration and does not enable reporting authentication. The
canonical Live issuer has been verified. Actual signed Live compatibility and
enrolled operator binding have now been observed in deny-only requests; production
tool acceptance remains separate and incomplete.

With verified public resource configuration, the MCP SDK can challenge missing
tokens before private enrollment is complete. A separately enabled, time-bounded
Live provider validation mode always denies reporting access and performs no
database reads. It emits only fixed non-identifying compatibility evidence for
signed enrolled operators; no token, subject, raw provider response or diagnostic
data is logged. Expiration does not activate reporting. Live ChatGPT acceptance
remains pending; previously recorded historical rollup gaps remain a separate
finding and no historical aggregates are modified by OAuth setup.

The explicit `stytch-live` profile is based on real RS256/`JWT` evidence, with
exact signed resource, active client-bound introspection, both scopes, enrolled
subject and equal-lifetime 0/+1-second shifts using the earlier expiry. It is
pinned to the Live issuer/endpoints, canonical resource and Vercel Production;
standard and Test contracts remain separate. An optional bounded validation-only
self-check can revoke and re-introspect the same privately held access token,
recording only fixed booleans. Both validation flags must be removed before data
acceptance; no token revocation occurs in normal reporting. No working Live
ChatGPT reporting connection is claimed from compatibility evidence alone.

## Operational health evidence

Persistence emits fixed ingestion/maintenance attempt and terminal outcome records without metric bodies, diagnostics, request headers or secrets. The pure reporting monitoring collector reconciles these records with explicit provider coverage; it never infers complete coverage from latest timestamps or absence of errors. An operator-only read-only audit reuses B1 query/projection/classification and captures only bounded aggregate evidence. It does not grant the MCP application platform-management credentials. Vercel Hobby retains one hour of logs, so that source alone remains partial for the required 24-hour window. No paid monitoring/drain is provisioned. Empty calendar dates without retained events or aggregates are unverified history, not proof of a missed rollup; maintenance completes event-bearing days.

## Durable operational evidence (003)

Migration 003 adds only health_epoch, health_operation and health_collection in the existing observability schema. It does not modify events, daily aggregates, rollup markers, diagnostics or support data. The activation timestamp is inserted once; no historic continuity is inferred. Operational records and checkpoints retain seven days (pruned on collector completion), covering the preceding 24 hours plus delivery/recovery allowance. If collection stops, expired records may physically remain until recovery but never prove current coverage.

The existing safe stdout attempt/outcome records remain the producer. A GitHub-hosted collector queries Vercel production request logs and a separate function-invocation counter for the two fixed ingestion/maintenance routes. It compares request path/method/status counts, validates original operation records, and persists only fixed operation/status/time/HTTP categories and internal random IDs. Request IDs, provider envelopes and unrelated messages are discarded in memory. No metric bodies, user information, tokens, arbitrary metadata or diagnostics are persisted.

Windows are UTC-aligned five-minute intervals. The collector samples three closed windows, with their starts 20 to 25, 15 to 20 and 10 to 15 minutes before execution. Two matching observations at least five minutes apart are required for verified coverage; failed or revised observations remove continuity. Max1000 requests/8MiB logs/100 counter groups are explicit safe limits; reaching a limit is partial, never silently complete. Checkpoints begin before provider access. Immutable completion and retry IDs suppress duplicates; contradictions reject the whole transaction. Provider outages, missing outcomes, abandoned jobs, delayed delivery and skipped windows remain visible. Independent HTTP503 counters retain demonstrated failures even when application logs are absent. A missing outcome becomes unresolved only with corroborated HTTP failure, elapsed deadline and verified source coverage. Empty journals never prove idle traffic.

The collector uses the existing free recent Vercel counter window (queries remain under30 minutes) and GitHub Actions scheduling. This is not a guaranteed scheduler or independent external uptime SLA. GitHub explicitly permits delayed/dropped schedules and disables inactive public-repository schedules; those outages become gaps. No paid drain or new database is required. Source capability and availability are revalidated on each run, not assumed from dashboard rendering.

After reviewed migration, apply health-role.sql as the authorized schema owner, then set its password through protected operator execution. observability_health_collector gets only CONNECT/USAGE and EXECUTE on the two bounded SECURITY DEFINER checkpoint/persistence functions; it cannot read measurement, diagnostic, support or raw health tables. Reporting and dashboard get EXECUTE only on the fixed read-only health_summary(timestamp) aggregate function, with explicit fields and no IDs. PUBLIC function execution is revoked. Dashboard future-table SELECT defaults are removed to prevent accidental operational-ID exposure; its existing five approved table grants remain. No application startup runs migrations.

Create protected GitHub environment observability-health restricted to master. Set OBSERVABILITY_HEALTH_COLLECTOR_DATABASE_URL for the dedicated collector and VERCEL_HEALTH_COLLECTION_TOKEN scoped to the public project, with bounded expiry and rotation. No platform token belongs in the MCP environment. Only the master scheduled/manual job receives these secrets; PR jobs do not. The collector is Node24 with the pinned Vercel CLI62.2.0, existing Neon driver and existing dashboard package. Run npm --prefix dashboard run health:collect only through this protected environment. Failures log fixed categories only.

The reporting adapter performs a five-second read-only aggregate query through the existing restricted reporting reader. Missing schema/grants or invalid/unavailable summaries yield absent monitoring evidence. Valid partial summaries remain partial. The database-evidence query uses the same health observation cutoff (at most30 minutes older than analytics report end); analytics counts, ranges, UTC boundaries and Web Vital semantics are unchanged. The strict DTO optionally includes bounded health.monitoring coverage timestamps, missing-interval/failure counts and delivery delay. Operation IDs and raw records never reach MCP. The existing six-state classifier is unchanged in ownership; positive health requires actual preceding-24-hour verified coverage and maintenance evidence. New deployments must await real coverage.

Corrected history: 2026-10-05 and2026-10-15 had no retained raw events, daily sample counts or completion markers. They are not demonstrated lost event-bearing rollups. The November17 audit found missingCompletedDays=0, mismatchedCompletedDays=0, pendingGraceDays=0. No guessed backfill or artificial zero-day markers are authorized.

Validation: dashboard unit tests exercise collection failures, strict projections and clock alignment; reporting tests cover the read-only adapter and OAuth/privacy regressions. The existing hosted reporting-permission PostgreSQL17 fixture also applies003 twice, tests complete/partial coverage, contradictions, retention and effective role denials. Local Docker absence does not waive hosted database/container gates.

Scheduling reference: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
