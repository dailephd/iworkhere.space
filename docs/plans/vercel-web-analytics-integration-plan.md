# Vercel Web Analytics Integration Plan

Status: FROZEN FOR IMPLEMENTATION PLANNING — CODE NOT STARTED

Date: 2026-10-06

Repository: `iworkhere.space`

Current public application release: v0.3.0

## 1. Purpose

Add Vercel Web Analytics to the public `iworkhere-space` Vercel project so the
owner can measure aggregate traffic such as page views, routes and acquisition
sources without replacing the application's existing observability system.

This is cross-version enabling infrastructure. It is not a catalog version and
must not change the v0.4–v0.6 utility sequence.

## 2. Current architecture to preserve

The application already has:

- `src/module/analytics/` with a swappable application analytics abstraction;
- `src/module/observability/` as the canonical application telemetry facade;
- `/api/metric` for allowlisted metrics and optional Neon persistence;
- `/api/log` plus structured diagnostic capture;
- Next Web Vitals collection;
- a separate protected observability dashboard;
- strict privacy rules that exclude user/file/input/output payloads.

Vercel Web Analytics must not create a second application-domain event system.

## 3. Product decision

The first delivery uses Vercel Web Analytics for automatic traffic/page-view
measurement only.

It does not send application custom events to Vercel.

Existing canonical events such as `tool_opened`, `tool_executed`,
`tool_result_copied` and `tool_mode_changed` remain owned by the existing
analytics/observability pipeline.

This avoids double-counting behavior and keeps the first integration easy to
audit.

## 4. Vercel package

Use `@vercel/analytics` version 2.

At implementation time:

1. query the npm registry for the current compatible v2 release;
2. pin an exact version in `package.json` and `package-lock.json`;
3. do not commit a floating `latest` dependency.

Version 2 is selected because Vercel documents Resilient Intake for the v2
package.

## 5. Proposed ownership

The expected implementation boundary is:

- `src/module/analytics/vercelWebAnalytics.client.ts`
  - parses the explicit enable flag;
  - owns the pure `beforeSend` sanitizer;
  - strips query strings and URL fragments;
  - owns any explicit private-route denylist.
- `src/component/observability/VercelWebAnalytics.tsx`
  - imports `Analytics` from `@vercel/analytics/next`;
  - supplies the app-owned `beforeSend` policy;
  - renders no visible UI.
- `src/app/layout.tsx`
  - composes the wrapper once near the root;
  - contains no provider-specific event logic.

If retrieval at implementation time finds a stronger existing owner, file names
may change, but provider isolation may not: tool components and tool-domain
modules must not import `@vercel/analytics` directly.

## 6. Activation contract

Add:

`NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED`

Semantics:

- unset / anything other than exact `true`: disabled;
- Production: set to `true` only after Web Analytics is enabled for the public
  Vercel project;
- Preview: disabled by default;
- Development/local/container/CI: disabled by default.

Because this is a public build-time variable, it contains no secret.

Vercel Dashboard activation is an external operator step. The application code
must remain safe when the dashboard feature is not enabled.

## 7. Privacy contract

Vercel documents Web Analytics as cookie-free and anonymized, but its documented
data points can include URL, filtered query parameters, referrer, coarse
geolocation, operating system/browser and device type.

The application therefore imposes a stricter outgoing URL policy:

- remove `search` / query data before transmission;
- remove URL fragments;
- never construct analytics URLs from arbitrary user text;
- return `null` from `beforeSend` for explicitly private routes if such a
  route exists in the public project;
- never attach file names, MIME, byte counts, page counts/ranges, image/PDF
  properties, user-entered text, generated output, local-storage data,
  authentication data, raw errors or object URLs.

This integration does not change the privacy rules of the existing observability
pipeline.

The documentation must not claim "no network traffic" or "no tracking." It may
state that document/image processing remains browser-local while aggregate
traffic analytics is sent to Vercel when explicitly enabled.

## 8. Automatic page views

Use the framework integration from:

`@vercel/analytics/next`

The root wrapper owns automatic initial page loads and client-side navigation
tracking.

Do not add manual page-view calls unless automated evidence proves the framework
integration misses a supported navigation path.

Avoid duplicate page views.

## 9. Custom events

Custom Vercel events are OUT OF SCOPE for the first delivery.

Do not call:

`track(...)`

from:

- tools;
- shared tool components;
- route components;
- the existing observability facade.

If a later product decision authorizes Vercel custom events, add an app-owned
provider adapter behind the existing analytics abstraction and reuse canonical
event names/allowlists. Do not invent parallel event semantics.

## 10. Speed Insights

Vercel Speed Insights is OUT OF SCOPE.

Do not install `@vercel/speed-insights` as part of this task.

The application already owns Web Vitals through its current observability
architecture. A separate Speed Insights decision requires an explicit
performance/duplication/cost review.

## 11. Web Analytics API

The public Vercel Web Analytics API is OUT OF SCOPE for the first delivery.

Do not:

- add Vercel API tokens;
- replicate Web Analytics data into Neon;
- add Web Analytics API calls to the public app;
- add Vercel traffic cards to the private observability dashboard.

Those can be considered later if the owner needs consolidated reporting.

## 12. Protected dashboard

The separate `iworkhere-observability` dashboard project is not enrolled in
Web Analytics by this plan.

Its Vercel Authentication protection, read-only database role and deployment
boundary remain unchanged.

## 13. Vercel deployment setup

Before the Analytics-enabled production deployment:

1. open the public `iworkhere-space` project in Vercel;
2. enable Web Analytics in the Analytics section;
3. configure `NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=true` for Production only;
4. deploy the exact validated implementation through the normal release path;
5. verify Vercel Web Analytics begins receiving page views.

Do not alter Namecheap DNS, the production domain, Neon credentials, AdSense,
cron configuration or dashboard protection for this integration.

## 14. Resilient Intake

Version 2 uses Resilient Intake.

Tests must not assume one fixed analytics endpoint path. Vercel may expose
managed insight/intake routes, including dynamically selected paths.

Production validation should prove that the provider script/intake is active and
that sanitized traffic reaches Vercel, rather than hard-coding a single route
name.

## 15. Implementation tests

Required unit/contract coverage:

- exact enable flag semantics;
- query-string removal;
- fragment removal;
- path preservation;
- malformed/unexpected event URL fails safely;
- private-route filtering, if configured;
- no custom-event API usage in first delivery.

Required browser coverage:

- Analytics disabled by default in normal local E2E;
- disabled mode introduces no analytics network request;
- enabled test mode mounts one Analytics integration;
- navigation does not double-count through duplicate wrappers;
- outgoing analytics event URL contains no application query/hash data;
- document/image tool workflows send no file/input/output data to Analytics;
- no hydration/page/console errors.

Container validation:

- remains default-off;
- no new secret or deployment dependency is required for container startup.

## 16. Production acceptance

The integration is accepted only when:

- Vercel Web Analytics is enabled on the public project;
- the exact pinned v2 package is committed;
- provider-specific imports are isolated to the approved wrapper/boundary;
- production-only activation is correct;
- `beforeSend` redaction is proven;
- automatic initial and client-navigation page views appear in Vercel;
- query/hash data does not appear in emitted page-view URLs;
- no custom events are emitted;
- no tool/file/input/output payload enters Vercel Analytics;
- existing Neon observability and diagnostics still function;
- the protected dashboard remains unchanged;
- full repository validation passes;
- production browser smoke passes.

## 17. Explicit exclusions

This plan does not authorize:

- Speed Insights;
- Vercel custom events;
- Google Analytics;
- analytics-provider replacement;
- Vercel Analytics API tokens;
- Web Analytics data ingestion into Neon;
- changes to the observability database schema;
- analytics UI in the private dashboard;
- session replay;
- advertising changes;
- cookie banners solely for this feature;
- user/session identity tracking;
- production DNS/domain changes.

## 18. Implementation sequencing

One bounded implementation batch should be sufficient unless retrieval reveals
a material architecture conflict:

1. retrieve current analytics/observability/layout owners;
2. verify/pin the current compatible `@vercel/analytics` v2 package;
3. implement sanitizer and wrapper;
4. mount once in root composition;
5. add explicit environment contract/example;
6. add focused unit/browser tests;
7. run typecheck, lint, test, build, E2E and container;
8. reconcile documentation;
9. run separate readiness;
10. deploy only after release approval and enable Web Analytics in Vercel.

Do not combine this with v0.4 tool implementation.

## 19. Authoritative external references

- Vercel Web Analytics quickstart:
  https://vercel.com/docs/analytics/quickstart
- `@vercel/analytics` advanced configuration and `beforeSend`:
  https://vercel.com/docs/analytics/package
- Vercel Web Analytics privacy/data collection:
  https://vercel.com/docs/analytics/privacy-policy
- Sensitive-data redaction:
  https://vercel.com/docs/analytics/redacting-sensitive-data
- Custom events:
  https://vercel.com/docs/analytics/custom-events
- Public Web Analytics API:
  https://vercel.com/docs/analytics/api

## 20. Planner decision

VERCEL_WEB_ANALYTICS_ARCHITECTURE: FROZEN

FIRST_DELIVERY: AUTOMATIC_PAGE_VIEWS_ONLY

EXISTING_OBSERVABILITY_REPLACED: NO

CUSTOM_EVENTS: DEFERRED

SPEED_INSIGHTS: DEFERRED

WEB_ANALYTICS_API: DEFERRED

PRODUCTION_ENABLEMENT: EXPLICIT

IMPLEMENTATION_STARTED: NO
