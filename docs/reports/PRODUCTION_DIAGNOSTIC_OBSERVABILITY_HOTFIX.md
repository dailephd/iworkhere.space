# Production diagnostic observability hotfix

## 1. VERDICT

Local implementation validated; production rollout and Delivery 2 forward-port pending. This report must not be read as production PASS until the rollout evidence below is completed.

Execution: FULL_STAGE_CONTEXT, FULL-STACK VERTICAL SLICE, project-contained my-dev-kit-orchestrator repair run `20261003T130006-observability-diagnostics-production`. Published tooling pinned at execution: my-dev-kit 1.12.5; orchestrator 1.6.1. No feature scope redesign.

## 2. ROOT CAUSE

RustLogProvider deliberately replaced warning/error messages with `Client failure`; metadata projection discarded error identity, causes, useful stacks and context. The metric stream was incorrectly treated as the limit for diagnostic information. No dedicated persisted diagnostic owner or server request-error hook existed.

## 3. PREVIOUS INFORMATION LOSS

Actual names/messages, useful frames, cause chains, AggregateError children, standard error fields, React component stacks and deployment identity were lost. An ad initialization caller also replaced its caught exception with a new generic error; it now preserves the original exception. Script-load events without an Error still receive an accurate stage label, without event/application payload capture.

## 4. NEW DIAGNOSTIC CONTRACT

One canonical serializer captures explicitly bounded Error/DOMException fields, recursive causes to depth five, cycle markers, and up to ten AggregateError children. Non-Error primitives retain safe text and JavaScript type; arbitrary objects and File/Blob contents are excluded. Message 4 KiB, useful root stack 24 KiB, component stack 16 KiB, shared error representation budget 40 KiB, HTTP body 64 KiB. Cause/child stacks are bounded to 2 KiB to retain multiple failures inside the shared budget. Escaped JSON is measured and truncated; oversized transport envelopes are rejected deterministically. Metrics retain their 8 KiB bound.

UUIDv4 identifies each occurrence. SHA-256 groups normalized name, redacted message and top frames; timestamp, UUID, browser characteristics and deployment are excluded from grouping.

## 5. REDACTION CONTRACT

The reusable idempotent text redactor preserves ordinary debugging text while redacting Authorization/proxy authorization, Bearer credentials, Cookie/Set-Cookie, password/token/API key/secret assignments and credential-bearing URL userinfo. Repository secret-name suffixes are covered. URL query strings/fragments are stripped while stack line/column suffixes remain. Values become `[REDACTED]`; no generic replacement of entire messages. Explicit context projection excludes inputs, outputs, filenames/bytes, storage, arbitrary objects, bodies, form data, IP, identity and sessions. Pattern redaction cannot recognize every unlabelled secret embedded in arbitrary prose; callers must never deliberately interpolate forbidden user data.

## 6. CLIENT ERROR CAPTURE

Global errors, promise rejections and ToolErrorBoundary use existing capture/deduplication owners. Diagnostics include canonical pathname, known tool/boundary/category, timestamp, UA, viewport/DPR, coarse device class, online and visibility state. React-supplied component stack survives. Metrics remain independent from fail-silent diagnostic networking. Tool URL query metadata is no longer passed to logging. Public fallback UI remains unchanged.

## 7. SERVER ERROR CAPTURE

Typed `src/instrumentation.ts` implements installed Next 16.3.8 `Instrumentation.onRequestError`. Captures actual error/digest and method, canonical request path, route path/type, router kind, render source, revalidation reason and runtime. Installed contract has no renderType; none is invented. Only safe bounded `x-vercel-id` is retained from request headers. Authorization, Cookie, body and forwarded IP are excluded. Sink/persistence failures cannot recurse or crash capture.

## 8. VERCEL STRUCTURED LOG RESULT

Both origins use `diagnostic.server.ts`, emitting JSON `source=application-error` with diagnostic ID/fingerprint, true redacted error, stack/causes/component context and deployment facts before optional database insertion. Errors use console.error, warnings console.warn. Ordinary application logs retain redacted developer-authored messages and appropriate severity. Database failure cannot prevent the runtime log.

Production evidence: pending.

## 9. DATABASE MIGRATION

Additive `database/observability/002-diagnostic-error.sql`; applied 001 remains unchanged. Runner discovers explicit three-digit numbered SQL filenames, sorts them and executes each transaction in order. Repeated application is safe. No startup migration.

## 10. DIAGNOSTIC TABLE

`observability.error_diagnostic` stores UUID, database receipt/reporter time, origin/severity, name/message/stack/cause/standard fields/component stack, path/tool/boundary/category/fingerprint and bounded client/server/deployment context. High-value dimensions use typed columns; contexts use bounded JSONB. Receipt, fingerprint/time, path/time and tool/time indexes exist. Event/daily metric schemas remain unchanged.

## 11. RETENTION

Idempotent `prune_diagnostics(reference_time)` removes receipt times strictly older than 30 days. Exact 30-day boundary remains, as do 29-day records; 31-day records prune. Existing atomic metric rollup and 90-day raw retention remain unchanged; daily aggregate history remains indefinite. Maintenance invokes diagnostic pruning separately after metric maintenance.

## 12. DASHBOARD RESULT

Independent protected dashboard retains activity/reliability/performance views and adds latest 25 detailed failures in the selected receipt-time range. True messages, identity/grouping, origin/path/tool/category/boundary, deployment and native expandable stack/cause/component/runtime contexts are server-rendered and React-escaped. Long code regions scroll locally. Historical metric rows honestly state that detailed diagnostics are unavailable for legacy events; counts remain valid.

## 13. READ-ONLY ROLE RESULT

Local real PostgreSQL role can SELECT diagnostics and cannot UPDATE or DELETE. No function execution, ownership or DDL is granted. Existing `dashboard-role.sql` SELECT/default grants cover the additive table and must be reapplied/verified in production without rotating credentials.

Production evidence: pending.

## 14. TESTS

Focused diagnostic/API/client/server/boundary/persistence suite: 90/90 PASS, run `2026-10-03T18-32-16-517Z-cf1e8433`, `test-report/<RUN_ID>/results.json` and `results.xml`. Final root verification includes added ad exception-preservation regression. Tests cover actual name/message/stack/cause/aggregate/component data, secret patterns, idempotence, Unicode/payload bounds, object/input exclusion, UUID/grouping, fail-silent transport, independent metrics, safe server context and deployment.

## 15. DATABASE SMOKE

Real PostgreSQL 17 Docker smoke PASS, run `observability-db-2026-10-03T18-35-03-647Z-5a0aed05`, `test-report/<RUN_ID>/summary.json` and `postgres.log`. Ordered/repeated migrations, full message/stack/cause, constraints/indexes, exact retention boundary, existing rollups/retention/rollback, seven range query plans plus diagnostic plans and actual role SELECT/write denial passed. No production database used by automated tests.

## 16. DASHBOARD VALIDATION

Independent verify PASS `dashboard-verify-2026-10-03T18-39-52-448Z-0da07a29`; runtime PASS `dashboard-runtime-2026-10-03T18-43-38-957Z-b78d9f6b`; browser/visual PASS `dashboard-visual-2026-10-03T18-43-44-185Z-91c5633e`, under `dashboard/test-report/`. Desktop/mobile/dark/system, multiple ranges, long message/stack/nested cause and no document overflow checked. Screenshots visually reviewed. Components test escaping, truthful legacy/empty/unavailable states and ID/context presentation. Explicit Turbopack roots keep public instrumentation outside independent dashboard compilation; public standalone tracing root is the current project.

## 17. ROOT VERIFY

Final PASS `2026-10-03T18-53-18-525Z-da0aff46`, `test-report/<RUN_ID>/summary.json`, results.json/results.xml and command logs. Typecheck, lint, unit/integration/contract tests and production build passed. Earlier failed runs exposed obsolete lossy-log assertions, a test callback typing issue, redactor idempotence and worktree build-root inference; corrected and rerun. Working-file ads.txt line endings were normalized to match HEAD bytes; no asset change.

## 18. E2E/CONTAINER IMPACT

Public E2E 230/230 PASS `2026-10-03T18-43-38-846Z-d6f2b321`, `test-report/e2e/<RUN_ID>/`. Final container PASS `2026-10-03T18-53-29-170Z-9b99785a` after caught ad error preservation, including the full 230-test browser suite against the final production standalone image, non-root/read-only runtime, service worker, HEIC and clean shutdown. Reports: `test-report/container/<RUN_ID>/summary.json`, Docker/runtime logs and `test-report/e2e/<RUN_ID>-browser/`. Automated flags disable live integrations; no ads clicked.

## 19. PRODUCTION MIGRATION

Pending local final gate completion and hotfix commit/push. Use existing configured production Neon writer only, apply ordered migration explicitly, then verify additive objects and reapply read-only grants before deployment.

## 20. PRODUCTION DEPLOYMENT

Pending. Existing public project `iworkhere-space` and dashboard project `iworkhere-observability`; dashboard All Deployments authentication confirmed. Deploy dashboard first, then public exact hotfix candidate. No Delivery 2 deployment.

## 21. PRODUCTION DIAGNOSTIC SMOKE

Pending. Exactly one bounded operator message through normal /api/log; no user data, no additional production error route. Save UUID before sending to avoid duplicate noise.

## 22. VERCEL LOG SMOKE

Pending exact synthetic message/UUID/fingerprint/stack/path/category/commit/environment verification in structured runtime log.

## 23. DASHBOARD DIAGNOSTIC SMOKE

Pending same UUID in writer/reader database queries and protected generated dashboard rendering; actual reader write denial required. Custom domain DNS is a separate issue.

## 24. DELIVERY 2 FORWARD-PORT

Pending production smoke. Preserve branch `feature/ui-discovery-delivery-2` at `4ce594e52afcdd23017059699bd2f7423db01482` until hotfix stable. Forward-port identical architecture with safe Git reconciliation, preserve canonical docs and Delivery 2 UI/guide/SEO, validate and push without deploying.

## 25. SECRETS/PRIVACY CHECK

No credentials, raw environment values or production user diagnostics in this report. Test fixtures are synthetic. Deployment credentials/configuration are read only in operator process memory or ignored protected files; do not publish them. No IP, user/session identity or prohibited payload collection introduced.

## 26. FILES CHANGED

Observability canonical serializer/redactor/server sink/facade/providers/client listeners/body reader/log API/server hook/persistence and tests; additive SQL and migration/database smoke; tool boundary/context caller and ad error-preservation callers; independent dashboard query/model/view/styles/fixtures/tests/visual smoke/config; public build-root config; canonical architecture/design/API/schema/testing/observability/module/component/database/dashboard documentation and this report. Full exact file manifest is Git commit diff; generated artifacts excluded.

## 27. REMAINING RISKS

Bounded truncation necessarily omits exceptionally large tail data. Pattern redaction is defense in depth, not permission to interpolate user payloads. Public ingestion same-origin checks are browser defense, not authentication/rate limiting; existing hosting controls remain relevant. Production migration/deployment/smoke and forward-port not yet complete. Dashboard custom-domain DNS previously pending; generated protected URL is sufficient for hotfix verification.

## 28. FINAL GIT STATE

Hotfix branch `hotfix/observability-diagnostics`, base `11219ceaa930b4a96971e2bf32809da100e6cc22`. Production baseline equivalence verified against `7584ba7a219176bdc8d817552dea42b9d5271094`: only documentation consolidation and corresponding container documentation-path test adjustment, no production app/config/database/dashboard source differences. Delivery 2 source excluded. Commit/push pending; original Delivery 2 tracked worktree clean.

## 29. EXACT NEXT ACTION

Complete final container gate, commit/push, additive production migration/grants, dashboard/public deployment, exactly one smoke and forward-port validation. When all results are recorded, return terminal report to ChatGPT for planner verification and STOP; do not begin another feature, Delivery 3 or v0.3.0.
