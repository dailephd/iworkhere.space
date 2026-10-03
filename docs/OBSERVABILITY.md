# Production observability

## Ownership and activation

Tools continue to call the observability facade. Existing analytics and logging provider interfaces select the sink. `NEXT_PUBLIC_OBSERVABILITY_ENABLED=true` explicitly selects network analytics and the sanitized RustLogProvider in early client instrumentation. Absent/other values retain local behavior; production mode alone never activates telemetry. The only added root production dependency is `@neondatabase/serverless@1.1.0`, used server-side. Public flags are baked into the browser bundle: rebuild after changing them.

Both same-origin endpoints continue writing a structured server log per accepted request. `/api/log` and RustLogProvider retain their existing sanitized technical-diagnostic contract; they write dedicated diagnostic records when persistence is enabled, without adding text to metric tables. `/api/metric` is the sole durable measurement ingestion owner. With `OBSERVABILITY_PERSISTENCE_ENABLED=true`, it inserts explicit allowlisted columns into Neon through `persistence.server.ts`; otherwise it logs and returns 204 without a connection. Successful inserts return 204. Missing configuration/database failures return empty 503 and a fixed safe operational error, without raw SQL diagnostics or credentials. Browser providers remain fail-silent. Inspect server logs by `source=application-metric`, `application-log`, or `observability-operation`. No identity, session history or profiling is collected.

## Privacy contract

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
[deployment instructions](../dashboard/DEPLOYMENT.md). No external provisioning,
secret setup, protection configuration, domain or deployment has been performed.

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
