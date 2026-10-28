# PROJECT STATUS

## v0.4.4 release source and validation — 2026-10-28

Status: IMPLEMENTED AND EXACT-SHA RELEASE-PREPARATION VALIDATED. GitHub Release and Vercel Production outcomes require separate verification.

The v0.4.4 implementation scope and release-facing documentation are reconciled
on `release/v0.4.4`. The CalculatorTool React Hooks lint violation was fixed by
guarded render-time synchronization of external query expressions while
preserving local editing and result state. Its focused regression tests,
typecheck, lint and `npm run verify` pass. The complete default-off browser run
passed (854 passed, 6 mode skips); the production-container run passed; preview
denial passed (6 passed, 2 mode skips); and enabled advertising passed with
stubbed Google endpoints (4 passed, 4 mode skips). Both production and full npm
audits report zero vulnerabilities. No install scripts were approved.

The release-preparation candidate `f6bee013b8cafa3253f568128be94e192a791ea6`
was committed and pushed on `release/v0.4.4`. Eight GitHub Actions workflows
and nine required jobs passed on that immutable SHA through PR #49. A later
release-documentation commit requires validation at its own SHA before merge;
the merged `master` commit also requires its own checks. Production deployment,
GitHub tag, and GitHub Release must each be verified from their actual records.
Live advertising activation and AdSense submission are not part of this release.

The 2026-10-28 draft PR triggered Vercel preview deployments contrary to the
release-preparation no-deployment condition. The main preview was canceled;
the observability preview reached READY and was reportedly removed, but its
removal was not independently proven at the reconciliation checkpoint. Historical
policy compliance remains FAIL; the project owner accepted a one-time exception
for those specific non-production previews. This does not waive future
preview or production deployment controls. The v0.5.0/v0.6.0 roadmap is
unchanged. The existing local preparation report remains the historical
validation and incident evidence authority:
`.my-dev-kit-workflow/tmp/v0.4.4/release-prep/release-prep-report.txt`.

## Immediate v0.4.4 planning checkpoint — 2026-10-26

Status: PLANNING COMPLETE; APPLICATION IMPLEMENTATION NOT STARTED by this update.

Inspected source: master at 59396b224157ad290e768c7f70998a9c947bda42.
The application package remains 0.4.3; the dashboard remains 0.1.0.
The v0.4.3 GitHub Release was separately verified as published on 2026-10-21;
later master maintenance is not assumed to be a new numbered release.
Historical v0.4.3 identity (verified against Git and GitHub on 2026-10-28, ported from the
open PR #41): the annotated tag `v0.4.3` (tag object `7dd9e1457b0b961b2b97f4da76dff5145af21bb7`)
targets commit `da1c6b48f2319ffa85f17b725d958980eabc7235`, the PR #40 merge commit on `master`
(merged 2026-10-21T19:10:09Z); the GitHub Release was published 2026-10-21T19:28:44Z. The release
tag, the merge and the source Vercel deployed are distinct facts: this check did not verify
which source production serves.

The immediate next scope is [v0.4.4 — Site Quality & Search Recovery](plans/v0.4.4-implementation-plan.md),
before the unchanged v0.5.0/v0.6.0 catalogs. All nine new priorities are included
now, with browser-title restoration first. The [dated quality audit](reports/ADSENSE_QUALITY_AUDIT_2026-10-26.md)
records the evidence and limits; the plan specifies exact owners, paths,
six implementation batches and acceptance gates.

Planning refresh on 2026-10-27 confirmed that master remains at the inspected
commit and reread the official Google guidance. The corrected plan explicitly uses
C:/Users/daile/Projects/iworkhere.space, selects DIRECT_IMPLEMENTATION for
Batches 1-5, and includes the advertising-versus-content layout check. The
October 26 HTTP observations below have not been relabeled as new measurements.

Source findings include the uniform browser-title contract and incorrect
signed calculator arithmetic currently preserved by a guide test. The source
already contains 18 tools/guides, seven category guides, five measured
examples and the existing trust pages. Live HTTP checks on 2026-10-26 found
30/30 sitemap pages reachable with canonical URLs and index/follow metadata;
all 30 HTML titles were iworkhere. The invalid-route probe returned 404/noindex.
These HTTP observations do not identify the production deployment SHA.

This update changes planning documentation only. It does not claim application
fixes, four new guide pages, nine file examples, 35 deployed URLs, a new package
version, release, deployment, ad activation or review submission. Real search
query/traffic and field-performance data were unavailable. The next action is
the detailed plan's implementation preflight, starting with title recovery.

Preserve the current fixed header, document-flow footer and approved About
copy. The title statement in the October 24 snapshot below remains a description
of current code until v0.4.4 implements the explicit new requirement.

## v0.4.4 Batch 3 implementation checkpoint — 2026-10-27

Status: LOCAL COMMIT WITH CONTAINER GATE DEFERRED. The package remains 0.4.3. No
push, release, deployment, ad activation or AdSense change. This is not release
readiness: `npm run test:container` was not run (Docker daemon unavailable) and
must pass for the final candidate before release.

Implemented on `feature/v0.4.4-site-quality` after Batch 2 (6706c50):
a preview guard in `adsenseEnabled` (optional deployment-environment argument,
passed from `process.env.VERCEL_ENV` at the server `AdSenseEligiblePage` gate),
a rewritten `public/sw.js` (cache `iworkhere-shell-v0.4.4`, network-first clean
HTML, allowlisted static prefixes only, owned-cache eviction), and the Privacy
caching sentence and date (October 27, 2026).

Evidence: unit 1,892 passed (verify, default-off); preview-denial E2E 8 passed,
2 skipped by mode; controlled enabled ads E2E 4 passed, 4 skipped by mode;
service-worker E2E 12 passed. The favicon test decoded the unversioned
`/favicon.ico`, which fails under the shared fixture's Playwright routing
independent of the worker (the old broad cache had masked it); it now decodes the
versioned href from the page's icon link. Complete default-off E2E after that
fix: 768 passed, 6 skipped by mode, 0 failed. Container gate not run (Docker
daemon unavailable). Merge/Split/HEIC Batch 2 coverage evidence remains an open gap.

## Current site chrome — 2026-10-24

The header is fixed to the top of the viewport with no Show/Hide navigation mechanism, and the footer is ordinary document-flow content at the end of the page. `FooterViewportControl` and the `--footer-clearance` variable are removed; `HeaderViewportControl` keeps only the fixed placement and measured height footprint. Every page has the browser title `iworkhere`, About is the last primary navigation link, and the default appearance remains Violet & Graphite with System mode. Visitor-facing copy was reviewed across the public pages and all 18 tools. Earlier retractable-chrome and fixed-footer notes are historical.

## Current v0.4.3 Production verification snapshot - 2026-10-21

APPLICATION_VERSION: `0.4.3` (root package remains private; independent dashboard: `0.1.0`).
COMPLETED_RELEASE_PR: #39, merged to `master` at `854477488ca5dddad9a47cc4a5036b3fba1bbf37`.
MASTER_CI: 8/8 workflows and 9/9 required jobs passed on that exact SHA. Workflow runs: Build `39639751144`, Container `39639751053`, Dashboard `39639751074`, E2E `39639751158`, Lint `39639751128`, Observability database `39639751178`, Test `39639751088`, Typecheck `39639751123`.
PRODUCTION_DEPLOYMENT: `dpl_F2KcjMqiiAz1WkAupbMtuGWvo8zN`, READY, source `854477488ca5dddad9a47cc4a5036b3fba1bbf37`.
PUBLIC_ROUTE_ACCEPTANCE: PASS for homepage, health, About, Contact, Privacy, Discover and sitemap; 30 canonical URLs, 18 utilities across seven populated categories.
PUBLIC_EXAMPLE_ASSETS: 13/13 returned HTTP 200.
CONTACT_PRODUCTION: VERIFIED on 2026-10-21. One authorized `POST /api/contact` returned HTTP 200 (`{"ok":true}`) at `2026-10-21T17:42:59Z`; provider acceptance PASS and inbox delivery verified. Sender: `contact@iworkhere.space`; recipient: `dailephd@gmail.com`; Gmail message ID: `1a15f8f2e86d258d`. SPF and DKIM passed; Reply-To was `dailephd@gmail.com`.
PRODUCTION_FIREWALL: Verified enabled and published for `POST /api/contact`; 5 requests per 300 seconds per client IP, exceeded-limit action HTTP 429.
REPORT_ISSUES: default-off. ADVERTISING: default-off.
RELEASE_PUBLICATION: GitHub tag and Release publication are distinct verification steps; consult GitHub records for their current state.

The following release-preparation checkpoint is retained as historical evidence.
Its pending and unverified statements describe the state before PR #39 merged
and before Production Contact was configured and tested.

## Historical release-preparation checkpoint - 2026-10-21

DEFAULT_BRANCH: `master`.

RELEASE_BRANCH: `release/v0.4.3`.
RELEASE_WORKTREE: `.my-dev-kit-workflow/worktrees/v0.4.3-release-prep`.
RELEASE_PREP_BASE_SHA: `73a4998c93ccb8809ea9541516f278a36c4e905e`.
ROOT_APPLICATION_VERSION: `0.4.3` (independent dashboard: `0.1.0`).

VALIDATED_SOURCE_SHA: `73a4998c93ccb8809ea9541516f278a36c4e905e`.
READINESS_VERDICT: `PASS_READY_FOR_RELEASE_PREP`.
READINESS_EVIDENCE: eight hosted workflows and nine required CI jobs passed. The Observability database workflow's initial PostgreSQL image pull failed externally; its permitted retry passed. Local readiness evidence and reports are described in [TESTING](TESTING.md). These historical results do not validate the release-preparation commit.

V0_4_3_BATCH_COMPLETION: all five approved batches are complete; the frozen plan and later version scopes are unchanged.
LOCAL_VALIDATION_EVIDENCE: historical candidate reports recorded `npm run verify` with 1,803 tests passed, public E2E with 758 passed and 4 skipped, support-enabled E2E with 128 passed, advertising-enabled E2E with 4 passed and 2 skipped, support full-stack E2E passed, and container validation passed. These results predate the release-preparation commit; current Step 6 run IDs are reported separately.
RELEASE_PREPARATION: completed locally on `release/v0.4.3`; the release-preparation commit has not passed hosted CI.
GITHUB_RELEASE: v0.4.3 publication is not recorded by this checkpoint.
PRODUCTION_DEPLOYMENT: deployment source identity and live service state require separate Vercel verification.

CONTACT_PRODUCTION_ACTIVATION: PENDING. `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`, a verified sending domain, authorized inbox delivery, production rate limiting for `POST /api/contact`, and deployment identity remain unverified. No production credentials were configured and no real email was sent.
REPORT_ISSUES_PRODUCTION_ACTIVATION: default-off unless `NEXT_PUBLIC_SUPPORT_ENABLED=true`; no production activation is claimed.

## v0.4.2 planning record - 2026-10-14

At this planning checkpoint, the immediate patch was recorded as: v0.4.2 — User Feedback & Retractable Site Chrome.
The [patch plan](plans/v0.4.2-implementation-plan.md) and corresponding
[roadmap scope](ROADMAP.md) specify durable anonymous issue/suggestion intake,
private triage and notifications, a retractable out-of-view header and a
viewport-fixed retractable footer. At the 2026-10-14 planning checkpoint, this was a planning change only; no
patch implementation, support schema migration, provider activation, CI evidence,
GitHub Release or public deployment had then been claimed.

Planning prerequisites are now integrated: documentation PR #33 was merged to
`master` in `a2ba480df167a1b3437727b45451aba8f6011c0e`, and the v0.4.2
planning PR #34 was merged in `5711a21a8d5d09b8a88ea784326def336e1ace1a`.
The planning documents defined scope and do not by themselves constitute implementation evidence. The next catalog expansion remains frozen v0.5.0; v0.4.2 does not replace that scope. The v0.4.1 publication facts above remain historical.

## v0.4.2 release and production activation status — 2026-10-20

APPLICATION_SOURCE_AND_PACKAGE_VERSION: `0.4.2` (independent dashboard: `0.1.0`).
GITHUB_RELEASE: `v0.4.2`, published 2026-10-20 after the release PR and exact-SHA
master validation passed. The v0.4.1 release facts above remain historical.
PRODUCTION_DEPLOYMENT: tracked separately from GitHub release publication; see
[deployment status](DEPLOYMENT.md).

Implemented in the validated source: the anonymous report vertical slice (global entry, accessible dialog, nine categories, strict API with a 16 KiB
cap, origin and Turnstile checks, durable idempotent `support` schema, independent outbox jobs with leasing, retry and dead-letter,
private GitHub issue and Resend adapters, protected dashboard `/support` views, dedicated database roles, retention and deletion
functions); the retractable header; and the fixed, collapsible footer. Contracts live in [API](API.md), [SCHEMA](SCHEMA.md),
[architecture](architecture.md), [DESIGN](DESIGN.md) and [database/support/README.md](../database/support/README.md).

Validation recorded locally (evidence by stage, not a combined count for the final source): Batch 1 reported 1,508 unit tests,
85 support-database assertions, 24 dedicated support browser checks and passing dashboard and container validation. The Batch 4
public-mode Playwright run reported 594 passed, 0 failed and 2 skipped; the skips are existing advertising-enabled scenarios that
the public test configuration cannot exercise. Earlier container runs showed intermittent `ERR_NO_BUFFER_SPACE` failures before later
passing; the cause is not shown to be fixed. See [TESTING](TESTING.md).

PRODUCTION_ACTIVATION_REQUIREMENTS (not verified): Neon support schema and role provisioning; private GitHub support repository and token;
verified Resend sender; production Turnstile keys; Vercel Firewall rules for `/api/support/report`; a 15-minute delivery schedule
(`vercel.json` still schedules only daily observability maintenance); dashboard support credential and Vercel Authentication check;
legal approval of `/privacy` copy and retention (`SUPPORT_RETENTION_ENABLED` defaults off); a synthetic end-to-end report; and
physical iOS/Android keyboard and safe-area checks. The public report entry stays off unless `NEXT_PUBLIC_SUPPORT_ENABLED=true`.

ACCEPTED_RESIDUAL_SECURITY_RISK: `source-map-js` 1.2.1, GHSA-68fv-2mgg-jv7q
(HIGH). This transitive dependency is used by build-time tooling; the reviewed
repository exposure analysis found no attacker-controlled source-map path and
no copy in the examined standalone runtime artifact. Patched version 1.2.2 is
available, but dependencies were not changed because the exact-SHA readiness
audit accepted this pre-existing finding as nonblocking. No repository security
policy requiring remediation was found. Reassess separately if the dependency
path or deployment artifact changes.

## Historical v0.4.3 implementation candidate checkpoint — 2026-10-21

This records the implementation-candidate state before release preparation. The planning record remains historical evidence of the original product decision. The candidate added no new tools and did not change the frozen v0.5.0/v0.6.0 catalog scope or proposed converter waves. At this checkpoint, production Contact, Search Console evidence, AdSense acceptance and live deployment remained unverified; later operational evidence is recorded at the top of this file.

## v0.4.1 released UI and category changes — 2026-10-11

The release incorporates the populated-category homepage and Calculator
keyboard `=` behavior from superseded PR #30, adds six palettes to the
existing appearance owners, and migrates `everyday` to `converter` (public
label **Converters**). Length and Weight remain converters; QR Code Generator
moves to Developer. Existing tool URLs are unchanged, and
`/category/everyday` permanently redirects to `/category/converter`.
PR #29's v0.4.0 status corrections were reconciled into the release. PR #31's
integrated source and PR #32's release preparation were merged as the
v0.4.1 release lineage; historical reports and frozen source acceptance
remain separate from current release status.

## AdSense remediation and Le branding source integration — 2026-10-10

PR #28 merged the accepted changes from PRs #24–27: F-01 privacy policy,
F-02 advertising eligibility, F-03/A-01 utility guides and Slugify
accessibility, and Le branding/icons. Prior local verification and browser
acceptance remain evidence for that implementation; route-specific Observer
acceptance remained REVIEW_REQUIRED. The merge does not establish current
Vercel deployment or enable advertising. AdSense approval and publisher/legal
review remain external and unverified. See [local validation report](reports/adsense-f03-a01-local-validation.md).

## v0.3.1 released and publicly deployed — 2026-10-06

TARGET_VERSION: 0.3.1 — Vercel Web Analytics

PACKAGE_VERSION: 0.3.1

V0_3_1_IMPLEMENTATION: COMPLETE

IMPLEMENTATION_SHA: `3d0dc49a9f850f35f4b75709aa8cffa50768c49d`

DOCUMENTATION_RECONCILIATION: COMPLETE

PRE_RELEASE_READINESS: PASS

RELEASE_PREPARATION: COMPLETE

RELEASE_PREP_SHA: `f0b26c00852fe048cb15839ddfc59504a8453de4`

V0_3_1_PR: #10 — MERGED

MERGE_METHOD: MERGE COMMIT

V0_3_1_RELEASE_MERGE_SHA / LAUNCH_PRODUCTION_SOURCE_SHA:
`2c8c1dec611b228a73137c5ee8ae0a5cd60caab0`

V0_3_1_GITHUB_RELEASE: `v0.3.1` — PUBLISHED

PRODUCTION_DEPLOYMENT: COMPLETE

VERCEL_PROJECT: `iworkhere-space`

V0_3_1_LAUNCH_DEPLOYMENT:
`dpl_67zHEP485iQtHBiM4VNPaURo4iw6`

PUBLIC_DOMAIN: https://iworkhere.space

The SHA and deployment above identify the validated v0.3.1 launch event. Later
documentation-only commits on `master` may cause Vercel to create equivalent
production deployments with newer Git SHAs; those are not new product releases
and do not invalidate the v0.3.1 launch record.

VERCEL_WEB_ANALYTICS: LIVE

PRODUCTION_FLAG:
`NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=true` — Production only

PREVIEW_ANALYTICS: OFF

DEVELOPMENT_ANALYTICS: OFF

LIVE_ANALYTICS_VERIFIED: YES

LIVE_ANALYTICS_DATA_RECEIPT: PASS

QUERY_REDACTION: PASS

HASH_REDACTION: PASS

CLIENT_NAVIGATION: PASS

DUPLICATE_ANALYTICS: NONE

FILE_INPUT_PRIVACY: PASS

CUSTOM_VERCEL_EVENTS: NONE

EXISTING_OBSERVABILITY: PASS / PRESERVED

DASHBOARD_PROTECTION: PRESERVED

RELEASE_BLOCKERS: NONE

The v0.3.1 release adds automatic Vercel Web Analytics page-view traffic to the
public application without replacing the existing application analytics,
Web Vitals, Neon persistence, diagnostics, or the protected observability
dashboard. Production acceptance verified initial/client navigation traffic,
query/hash redaction, file-input privacy, no duplicate Analytics wrapper, and
aggregated page-view receipt for public routes. No Vercel custom events or
Speed Insights were added.

See the
[v0.3.1 launch report](reports/V0_3_1_VERCEL_WEB_ANALYTICS_LAUNCH_REPORT.md),
[implementation report](reports/V0_3_1_VERCEL_WEB_ANALYTICS_IMPLEMENTATION_REPORT.md),
and [documentation reconciliation report](reports/V0_3_1_DOCUMENTATION_RECONCILIATION_REPORT.md).

## Pre-v0.4 indexing and canonical-host checkpoint — 2026-10-07

PRE_V0_4_INDEXING_CHECKPOINT: COMPLETE

CANONICAL_PUBLIC_ORIGIN: https://iworkhere.space

CURRENT_LIVE_SITEMAP: https://iworkhere.space/sitemap.xml — 23 canonical URLs

CANONICAL_URL_LIVE_AUDIT: PASS — all 23 current sitemap URLs returned 200,
did not redirect, were indexable, and exposed self-canonical HTTPS apex URLs.

GOOGLE_REDIRECT_NOTICE: INVESTIGATED

The Search Console "Page with redirect" notice is currently explained by
intentional URL normalization rather than a demonstrated application defect.
Google URL Inspection identifies the HTTP homepage variants as redirecting, and
live checks confirm Next.js trailing-slash variants such as `/discover/`,
`/tool/slugify/`, and `/category/text/` redirect with 308 to the canonical
non-trailing-slash URL. These redirecting variants are not sitemap targets and
must not be made indexable merely to clear the notice.

GOOGLE_SITEMAP: RESUBMITTED 2026-10-07 — Google accepted the current production
sitemap for re-download. Submission does not guarantee crawl, index inclusion,
ranking, or traffic.

WWW_TO_APEX_DEPLOYMENT_VERIFICATION: PASS

Google historical inspection showed `https://www.iworkhere.space/` was indexed
on 2026-09-29. An earlier 2026-10-07 verification found `www` had no DNS record
and was not attached to Vercel (preserved in the checkpoint report). The owner
then completed the Namecheap DNS and Vercel domain setup. Independent
re-verification (no agent-side configuration change) shows `www` resolves,
both domains are attached to project `iworkhere-space`, and every HTTP/`www`
variant reaches the HTTPS apex with the path preserved via permanent 308
redirects (`https://www` in one hop; `http://www` in two). No application
host-redirect layer exists or is needed.

SOURCE_REPAIR_REQUIRED: NO — APPLICATION_SOURCE_REPAIR: NOT_REQUIRED

GOOGLE_INDEXING_MONITORING: CONTINUES IN PARALLEL. Canonical Google recrawl and
index inclusion are evidence collection, not a reason to rewrite working
canonical/redirect behavior. Escalate to a source repair only if later inspection
shows a canonical production URL itself redirects, is blocked, is non-indexable,
or advertises a conflicting canonical.

See
[the pre-v0.4 indexing checkpoint report](reports/PRE_V0_4_INDEXING_CHECKPOINT_2026-10-07.md).

RELEASE_CONTENT_VERSION: 0.4.0 — Core Text, Data & Sharing Utilities

## v0.4.0 release content

TARGET_VERSION: 0.4.0 — Core Text, Data & Sharing Utilities

PACKAGE_VERSION: 0.4.0

PREVIOUS_FORMAL_RELEASE: v0.3.1

V0_4_PLANNING: FROZEN

V0_4_IMPLEMENTATION: COMPLETE

V0_4_DOCUMENTATION_RECONCILIATION: COMPLETE

V0_4_PRE_RELEASE_READINESS: PASS_READY_FOR_RELEASE_PREP — exact implementation candidate `34272e42a0bac1fc27860e1e60a8696f7a15044f`

V0_4_RELEASE_PREPARATION: COMPLETE

PRODUCTION_CONTINUOUS_DEPLOYMENT: ACTIVE — the public Vercel project `iworkhere-space` deploys `master` automatically (see [DEPLOYMENT](DEPLOYMENT.md)); a continuous deployment is not a numbered release

PRE_RELEASE_PRODUCTION_SOURCE_SHA (verified 2026-10-07): `34272e42a0bac1fc27860e1e60a8696f7a15044f` (GitHub Production deployment record `6923149452`); later `master` merges redeploy automatically

V0_4_RELEASE_DAY_CATALOG (verified 2026-10-08): 27 sitemap URLs; `/tool/json-formatter`, `/tool/word-character-counter` and `/tool/qr-code-generator` return 200

Implementation lineage on `master`: Batch 1 (canonical `developer` category +
JSON Formatter / Validator) merged at `59318b5f7b142a8154fead3153674a6c35eca4f2`
(PR #15); Batch 2 (Word / Character Counter) merged at
`d6cd802724bd6fbacc5ffc021cde4f49d52108c3` (PR #16); Batch 3 (QR Code Generator)
merged at `519bedf072be17593c371bfd7242713bdae93b95` (PR #17); a bounded
related-tool-heading correction found by the completeness audit merged at
`6601e119b67715f0ec5e34b86298136b7429572a` (PR #18).

Release-content catalog: 18 tools, 7 populated categories, and 27
registry-derived sitemap URLs at v0.4.0 release. The package version is 0.4.0.
Current source adds `/privacy`, for 28 URLs. Continuous production deployment
source and formal release integration are separate lifecycle facts; the
v0.3.1 launch record (23 URLs) below is historical.

Reports:
[Batch 1](reports/V0_4_BATCH_1_IMPLEMENTATION_REPORT.md),
[Batch 2](reports/V0_4_BATCH_2_IMPLEMENTATION_REPORT.md),
[Batch 3](reports/V0_4_BATCH_3_IMPLEMENTATION_REPORT.md),
[related-tool label correction](reports/V0_4_RELATED_TOOL_LABEL_CORRECTION_REPORT.md),
[completeness and reconciliation](reports/V0_4_IMPLEMENTATION_COMPLETENESS_RECONCILIATION_REPORT.md).

V0_4_GITHUB_RELEASE: `v0.4.0` — PUBLISHED 2026-10-08. PR #21 merged
at `b619920048239e1b60ea20c4db5a4d0f01bdcd39`. This release record is
separate from later source changes and deployments.

## Historical v0.4.0 planning freeze — 2026-10-07

The following planning snapshot is preserved unchanged; the implementation
candidate record above supersedes its not-started status and Batch 1 next action.

### v0.4.0 planning freeze — 2026-10-07

PRE_V0_4_INDEXING_CHECKPOINT: COMPLETE

WWW_TO_APEX_DEPLOYMENT_VERIFICATION: PASS

V0_4_PLANNING: FROZEN

V0_4_IMPLEMENTATION: NOT_STARTED

PACKAGE_VERSION: 0.3.1

PLANNING_BASE_COMMIT: 8b72983ea0ff8f5c25a222ae1a6a767c529d078a

PLANNING_BRANCH: planning/v0.4.0

IMPLEMENTATION_PLAN: [docs/plans/v0.4.0-implementation-plan.md](plans/v0.4.0-implementation-plan.md)

Frozen decisions: `developer` is a canonical `ToolCategory` with one canonical
runtime category-definition owner; JSON Formatter / Validator → `developer`,
Word / Character Counter → `text`, QR Code Generator → `everyday`; exactly three
`DIRECT_IMPLEMENTATION` batches (1: category + JSON, 2: counter, 3: QR). No v0.4
source, dependency, registry or category change exists yet. Google recrawl and
index inclusion continue in parallel and are not claimed complete.

NEXT_ACTION: Planner review and preparation of the bounded v0.4 Batch 1
implementation prompt.

## Historical v0.3.0 planning freeze — 2026-10-04

The following planning snapshot is preserved; the current implementation
record above supersedes its not-started status and Batch 1 next action.

NEXT_NUMBERED_VERSION: 0.3.0

V0_3_PLANNING: FROZEN

V0_3_IMPLEMENTATION: NOT_STARTED

PACKAGE_VERSION: 0.2.0

Delivery 2 documentation commit `d28bb7b8ca8f6aad1e319fdb106138f7978bbb8a`
was integrated through PR #7 after all eight required CI workflows passed.
Post-documentation master: `16c4e225c4a0afc4c877348741d9839e01407f06`.
The [frozen v0.3.0 implementation plan](plans/v0.3.0-implementation-plan.md)
defines five browser-local document tools, pinned PDF.js/pdf-lib/project-owned
QPDF runtimes, product policies, resource limits and six ordered batches.
No implementation, dependency installation, version bump or deployment is
performed by this planning task. Next action: planner review and preparation
of the bounded Batch 1 prompt. Do not begin Batch 1 from this status record.

## Delivery 2 public launch — 2026-10-04

DELIVERY_2: PUBLICLY_DEPLOYED

CANDIDATE_SHA: c07111916554b387be9b3d415229230e5ee0fab8
PR: #6 — UI discovery Delivery 2
MASTER_SHA / PRODUCTION_SHA: c8406412301ff382dcf4e10e00789e93caad6f39
PACKAGE_VERSION: 0.2.0 (cross-version UI/discovery enabling work; no new numbered version)
PUBLIC_DOMAIN: https://iworkhere.space

SITEMAP: LIVE — 17 URLs
ROBOTS: LIVE
PRODUCTION_BROWSER_SMOKE: PASS
OBSERVABILITY: LIVE/PRESERVED
DASHBOARD: LIVE AND PROTECTED
GOOGLE_SEARCH_CONSOLE: MANUAL ACTION PENDING
BING_WEBMASTER: MANUAL ACTION PENDING

Production technical launch passed: public routes/assets, crawl policy, sitemap,
canonicals, server-rendered guides, bounded desktop/mobile browser, representative
image workflows, observability persistence, and anonymous dashboard protection
were verified. No ranking or traffic improvement is claimed. See the durable
[Delivery 2 launch report](reports/UI_DISCOVERY_DELIVERY_2_LAUNCH_REPORT.md) for
merge/CI history, production evidence, and remaining webmaster actions.

## Delivery 2 implementation — 2026-10-03

Delivery 2 is implemented and validated on its dedicated feature branch. The earlier `BLOCKED_OBSERVER_ACCEPTANCE_CONFIG` was a configuration gap, resolved through planner-authorized semantic relationship contracts and supplementary scroll lanes without production corrections. Focused tests, 264 production E2E tests, corrected Observer lanes, final impact review, aggregate verification and container validation passed. See [the implementation report](reports/UI_DISCOVERY_DELIVERY_2_IMPLEMENTATION_REPORT.md) for preserved blocked history and final evidence. At this 2026-10-03 readiness-report timestamp, no merge or Delivery 2 deployment had yet occurred; PR #6 and the public launch followed on 2026-10-04.

At this historical checkpoint, Delivery 1 was user-approved for the homepage,
compact navigation, Image Resizer workspace and four-theme/material behavior.
Delivery 2 later completed the image-family rollout and search foundation. The
current six-palette appearance system is recorded above and in DESIGN.md.

## Implementation state snapshot — 2026-10-02

This dated snapshot is historical and is superseded for current production status by the 2026-10-04 public-launch record above. Reconciled 2026-10-02. Target release v0.2.0; root package version 0.2.0;
independent dashboard package version 0.1.0. The frozen implementation SHA
`339091c5aaf4ad31be656756a7f4e4c121cc37de` passed all eight hosted workflows on
the immutable ref `validation/v0.2.0-heic-license-339091c5`. The owner approved
the HEIC production-license gate. Release documentation is finalized for
v0.2.0; production deployment integrations are tracked separately.

The registry contains **10 tools / 4 image tools**. The theme registry contains
**4 themes**: System, Light, Dark and One Dark. The v0.2 implementation includes
the local image utility family and worker-isolated HEIC conversion, accepted
homepage/discovery and material pilot, production-gated AdSense, opt-in
production observability with optional Neon persistence/maintenance, and the
separate observability dashboard. See ROADMAP.md for accepted extensions and
DESIGN.md for the approved Delivery 1 precedent and bounded Delivery 2 rollout.

**Implementation status:** complete. **Exact-SHA readiness:** all eight hosted
workflows passed on the frozen implementation SHA. **Deployment status:** no
production resources or settings have been provisioned by this repository
work. **Release status:** v0.2.0 release state is finalized. Production deployment
state is tracked separately below. AdSense readiness, production Neon
provisioning and migration, dashboard read-only credential, Vercel dashboard
project and All Deployments protection, dashboard domain/DNS, production
variables, live telemetry and ads serving remain external and unverified.

Historical candidate notes below record prior correction cycles. The frozen
implementation passed exact-SHA readiness and received the owner's HEIC gate
approval. Production integration items remain external configuration tasks.

### Prior validation evidence (historical snapshots)

The 2026-10-01 observability/dashboard review recorded root verify at 544 tests /
44 files, 230 public E2E cases, 230 container browser cases, database smoke and
dashboard verify at 52 tests. Run IDs and reports remain in their original
locations. An earlier implementation batch recorded 423 tests and 170 E2E cases.
These are historical snapshots, not results of the current reconciliation run.
Existing five lint warnings and the previously recorded pinned-dependency audit
warnings were not changed here.

## Historical architecture and validation snapshot

The accepted v0.1.1 development-validation baseline and design reconciliation
remain in place. Next.js Server pages compose registry-driven client tools.
ImageFile shares source primitives, ImageSourcePanel shares identical source
presentation, and operation encoding/state/results/URLs/generations stay local.
Only the dedicated HEIC worker imports heic-to/next; it activates after source
size checks, never on initial routes, and terminates after each operation or
invalidation. No generic file framework is implemented.

The public application has six independent CI gates: Typecheck, Lint, Test,
Build, E2E and Container. Separate dashboard and observability-database workflows
also exist. Root `npm run verify` runs typecheck, lint, test and build;
`npm run test:e2e`, optional Docker `npm run test:container`, dashboard verify,
and the database smoke are separate. Current commands and artifact ownership
are in TESTING.md and CI_CD.md. The dashboard owns its plain-CSS PostCSS
configuration and builds without root `node_modules`. External-runtime E2E uses
`E2E_BASE_URL`, runs the same full browser suite, and has no host `.next`
prerequisite; Container builds the production runtime inside Docker.

Batch 7 container runtime hardening: PASS. Next standalone output, a
digest-pinned Node 24 Docker image, optional Compose preview, Windows Docker
Desktop readiness helper, container smoke orchestration, external Playwright
runtime targeting, and the sixth Container workflow are implemented. The
container runs non-root with a read-only filesystem and passed health, route,
PWA/HEIC, full desktop/mobile E2E, image-hygiene, and graceful-shutdown checks.
Evidence is in the unique `test-report/container/` run directory. Container
runtime validation does not resolve the separate HEIC license or release gate.

## Completed

- Folder structure defined (four-layer: app, module, component, lib)
- Next.js 16 App Router with React 19, TypeScript 5, Tailwind CSS v4
- Root and dashboard Next.js / eslint-config-next dependency contract: 16.3.8;
  React and React DOM remain 19.2.3.
- PWA icons created
- manifest.webmanifest created
- Tool registry pattern established (`src/module/tool/registry.ts`)
- Tool type system (`src/module/tool/type.ts`)
- Tool metadata index layer (`src/module/tool/metadata.ts`)
- ToolPageTemplate and ToolClientFrame scaffolded
- ToolErrorBoundary with automatic `captureError()` integration
- Slug-based routing (`/tool/[slug]`)
- Category pages (`/category/[category]`)
- Tool discovery page (`/discover`) with category grouping and search
- Home page with client-side tool search and status panel
- Logging module (`src/module/log/`) with ConsoleProvider and RustLogProvider
- Observability facade (`src/module/observability/`) unifying analytics and
  logging
- Analytics abstraction (`src/module/analytics/`) with swappable provider
- Persistent state abstraction (`src/lib/storage.ts`)
- SEO automation (`src/lib/seo.ts`) with `generateMetadata` on tool and
  category pages
- AppShell layout with header, footer, vertical navigation, and ad banner slots
- Reusable UI components (Button, Input, StatusPanel, ToolSearch, ThemeToggle)
- Navigation data (`src/app/navData.ts`) wired to real routes via Link
- CSS custom property theming (`src/app/global.css`, `src/style/theme.css`)
- Multi-theme registry (`src/module/theme/`): four retained mode IDs (`system`,
  `light`, `dark`, `onedark`), six palette identities, storage persistence and
  system preference handling
- Recently used tool tracking module (`src/module/tool/recentlyUsed.ts`)
- Navigation items wired to routes (Home, Discover) via VerticalNav with
  `usePathname()`
- Service worker (`public/sw.js`) with offline caching (network-first
  navigation, cache-first assets)
- ServiceWorkerRegister client component for SW registration
- `/api/log` endpoint for RustLogProvider log ingestion
- `/api/health` health check endpoint
- CI/CD pipeline — separate GitHub Actions workflows (typecheck, lint, test,
  build, e2e, container)
- Test infrastructure with Vitest and unique report generation
  (`test-report/<RUN_ID>/`)
- Aggregate local validation runner (`script/verify.ts`) with shared RUN_ID,
  command logs, and Vitest reports
- Separate Playwright `test:e2e` command, desktop/mobile Chromium production
  regression suite, diagnostic gate and reports under `test-report/e2e/<RUN_ID>/`
- Image fixture provenance convention and `modules/ImageFileProcessing.md`
- Production `heic-to@1.5.2` worker-only HEIC decoding, real JPEG/PNG
  conversion, lifecycle/privacy and final application decoder isolation PASS;
  the owner approved the production-license gate and all eight hosted
  exact-SHA workflows passed.
- Project documentation updated (architecture, canonical design, code generation
  guidelines)

### Historical tools implemented at the v0.4.0 release

The v0.3.0 release added the following five document tools to the ten-tool
catalog that preceded v0.4.0:

- **Merge PDF** (`/tool/merge-pdf`) — ordered browser-local PDF page copying.
- **Split PDF** (`/tool/split-pdf`) — ordered page groups and individual PDFs.
- **Images to PDF** (`/tool/images-to-pdf`) — ordered JPEG/PNG assembly.
- **PDF to JPG / PNG** (`/tool/pdf-to-image`) — selected-page raster exports.
- **Compress PDF** (`/tool/compress-pdf`) — lossless structural optimization;
  NO REDUCTION ACHIEVED is a normal possible outcome.

- **Slugify Text** (`/tool/slugify`) — text category
- **HTML Text Extractor** (`/tool/html-text-extractor`) — text category
- **Calculator** (`/tool/calculator`) — math category
- **Length Converter** (`/tool/length-converter`) — everyday category
- **Weight Converter** (`/tool/weight-converter`) — everyday category
- **Time Arithmetic** (`/tool/time-arithmetic`) — time category
- **Image Resizer** (`/tool/image-resizer`) — image category
- **Image Compressor** (`/tool/image-compressor`) — image category; actual JPEG,
  PNG and WebP byte reduction, with truthful no-reduction outcomes

- **JPG / PNG / WebP Converter** (`/tool/image-converter`) — image category;
  all four distinct conversion pairs, exact dimensions/MIME, JPEG white flattening,
  PNG/WebP alpha preservation and canonical downloads

- **HEIC → JPG / PNG Converter** (`/tool/heic-converter`) — image category;
  actual HEIC/HEIF detection, worker-generated PNG preview, exact JPEG/PNG output.


## Historical Batch 5 acceptance

Batch 5 adds HEIC to JPG / PNG Converter, bringing the registry to **10 tools / 4 image tools**, with exact heic-to 1.5.2 isolated inside a lazily created short-lived worker. The synthetic MIT 3,554-byte positive fixture decodes to 480 x 320 and converts to JPEG/PNG at exact dimensions. Source limits remain 25 MiB / 30 MP.

Two planner fixture-selection specification gaps are DEGRADED / WORKED_AROUND: ambiguous image redistribution permission in the first fixture, then a redistributable replacement that exceeded the 30 MP contract. EXTRA_PROMPT_REQUIRED=YES. The previous 45 MP rejection remains actual limit evidence in the ignored corrected Batch 5 report. Technical feature result PASS; ecosystem result DEGRADED. Historical local validation: 396 Vitest tests in 30 files and 146 E2E cases (73 desktop / 73 mobile). Current release gate approval and hosted readiness are recorded above. Complete historical evidence is in `.my-dev-kit-context/reports/batch-5-final/final-report.md`.


## Historical process debt

The roadmap-referenced `docs/plans/v0.2.0-implementation-plan.md` is absent
from the current tree and available Git history. V0_2_VERSION_PLAN_PRESENT=NO;
RETROACTIVE_VERSION_PLAN_CREATED=NO. Historical Batch 3–5 reports and ecosystem
learning remain snapshots; they are not current-state authorities or new Batch 6 gaps.

The dated review/task notes below preserve state and decisions at those
checkpoints. The current implementation, deployment, release and next-workflow
summary at the top of this file is authoritative for the latest verified release.

## Historical UI and discovery planning — 2026-10-01

Source review at `4dcdcd2c64bfbbcacbb37c069090fce8921f310e` confirms that the
header and left banners are removed and their optional slot support remains.
The site header, primary navigation, right banner, footer banner, and footer
remain. This is implemented banner cleanup, not the broader visual redesign.

The planner has added [UI, discovery, and measured growth](plans/ui-discovery-growth-plan.md)
after current repository review and public design/search research. The next
visual direction is a compact top-navigation and preview-first workspace pilot
for the homepage and Image Resizer, followed by visual approval before broader
rollout. The initial scope retains the right/footer banners unless a later
explicit visual decision changes them.

Search/navigation gaps identified in current source include an inactive header
search input, script-button catalog navigation, a minimal ToolPageTemplate,
and absent sitemap/robots implementations in the inspected app/public listings.
These findings are planned work, not fixes performed by this documentation
update. Basic crawlability moves earlier; large content programs, new tools,
AI-search extras, and new analytics infrastructure are not prerequisites.

No new visual implementation, application test run, public deployment, ranking
measurement, or traffic improvement is claimed by this planning update. The
plan is not a retrospective v0.2 version plan. Existing technical acceptance
and the unresolved release/license gate remain separate.

The Delivery 1 homepage, shared-navigation and Image Resizer pilot is now
implemented in the working tree and is `PILOT_IMPLEMENTED_PENDING_VISUAL_APPROVAL`.
Its visual artifacts and final technical validation remain part of the review
package. No broader image-tool rollout or release status change is implied.

## Historical external production integration status

- Visual approval of the homepage/Image Resizer pilot before image-family rollout.
- Any removal of the currently retained right/footer banners requires explicit approval.
- HEIC production-license approval: approved by the owner.
- Release PR and main-branch hosted checks are tracked in publication evidence.
- First-party traffic, indexing, and performance baselines after authorized public availability.
- Later-version/Version-TBD scope remains in ROADMAP.md: authentication, payments,
  analytics/ad providers, server storage, recently-used integration, broader metadata
  enrichment, About content and RustLogProvider activation. The new plan defines
  only the bounded near-term discovery subset, not these entire workstreams.

## Historical next action

After this documentation reconciliation passes, return its exact candidate SHA
to the planner for separate pre-release readiness. The
[frozen v0.3.0 implementation plan](plans/v0.3.0-implementation-plan.md)
has been implemented in all six batches. Readiness and release preparation
have not run; no version bump, PR, merge or v0.3 deployment is performed here.
External launch follow-up remains separately tracked in the Delivery 2 launch
record and [deployment documentation](DEPLOYMENT.md).

## Historical theme refresh pilot

Four selectable themes: System (Light/Dark only), Light, Dark, One Dark (developer syntax palette). Component-color correction extends the uncommitted UI pilot and remains pending human visual review. No rollout, commit or deployment is authorized by passing functional checks.


## Historical component-color correction candidate

Civic Light and Spectrum are visually rejected and retired. Four selectable themes remain: System, Light, Dark, One Dark. Themes define palette; components consume semantic visual roles; categories provide catalog identity. The existing uncommitted layout pilot is preserved. This correction awaits focused human visual review; no rollout, commit or delivery is authorized.


### Historical island/material candidate

Peer section-island and One Dark glass/neomorphic material candidate is pending human visual approval. Four themes remain. Current uncommitted layout/color work is preserved; no rollout or delivery is authorized.

## Production integration review candidate — 2026-10-01

The existing uncommitted four-theme section-island visual pilot is preserved. Vendor-neutral same-origin production telemetry and centrally configured top/right AdSense integration are added with explicit enable flags and disabled defaults. Verification meta/ads.txt are always available. Fake footer/right placeholders are replaced with real conditional placements. No vendor SDK, dependency, image processing, HEIC decoder, commit or deployment change. Functional evidence is recorded under test-report/production-integration; visual approval and external AdSense readiness/CMP activation remain separate gates.

Integration validation: `READY_PRODUCTION_OBSERVABILITY_ADSENSE_FOR_REVIEW`. Typecheck, lint (five existing warnings), build and diff-check pass. Vitest: 493 tests, RUN_ID `2026-10-01T17-55-21-640Z-e113731b`. E2E: 230 tests, RUN_ID `2026-10-01T17-57-41-870Z-d9f7e87b`. Container plus 230 browser tests: RUN_ID `2026-10-01T17-56-26-940Z-1a30fa48`, exact ads.txt/health, clean shutdown and cleanup pass. Automation made zero Google advertising requests. Both enable flags remain off by default. Full evidence and exact review inventory: `test-report/production-integration/production-20261001/`. No commit, push, PR or deployment. AdSense account Ready/Authorized/CMP/serving/revenue remain external and unverified.


## Production diagnostic hotfix (cross-version infrastructure)

Isolated baseline 11219ceaa930b4a96971e2bf32809da100e6cc22 is production-equivalent apart from documentation consolidation/container smoke doc-path update. Diagnostic hotfix code c700407c5a92061d9d5a03caf88bd1e32199e5cc is deployed after additive migration/grants and full local validation. Replacement smoke (explicitly authorized) proves actual error/stack/cause/component/runtime/deployment data in Vercel logs, Neon and the protected dashboard. dashboard.iworkhere.space is ACTIVE. Architecture forward-ported and pushed to Delivery 2 as 0d0839b2542e5afed26b07b6ab5aa64746ba1a50; root/DB/dashboard/browser validation passed. At this 2026-10-03 hotfix-report snapshot, Delivery 2 was not yet deployed; feature scope was unchanged. The later public launch is recorded in [the Delivery 2 launch report](reports/UI_DISCOVERY_DELIVERY_2_LAUNCH_REPORT.md). See docs/reports/PRODUCTION_DIAGNOSTIC_OBSERVABILITY_HOTFIX.md.

## Post-release category migration — 2026-10-11

The released v0.4.1 source carries the migration from `everyday` to `converter`
(Converters), with QR Code Generator in Developer and the historic route
permanently redirected. All 18 tool URLs and seven populated categories remain.
The candidate passed category/layout validation and desktop/mobile Observer
acceptance; the original canonical Observer baseline remains preserved. Proposed
v0.7/v0.8 converter expansion remains subject to planner approval. The v0.4.0
category decision remains a historical record.

## v0.4.4 Batch 1 checkpoint — 2026-10-27

Browser title recovery is implemented in the local working tree on
`feature/v0.4.4-site-quality` (uncommitted, unreleased; package version remains
0.4.3). `buildPageMetadata` now emits the unbranded title plus " - iworkhere" for
the 18 tools, five fixed pages, seven categories and the not-found page. This
checkpoint does not claim the v0.4.4 release or later batches complete.

## v0.4.4 Batch 4 checkpoint — 2026-10-27

Four verified tool examples are implemented on `feature/v0.4.4-site-quality`
(local, unreleased, not pushed; package version remains 0.4.3; the staged v0.4.4
PR #48 remains an integration dependency and PR #41 overlaps documentation).
Merge PDF, Split PDF, Image Compressor and HEIC → JPG / PNG Converter now have a
worked example beside the five v0.4.3 examples: nine in total, with exactly five
featured on the home page (`ValueExample.featuredOnHome`,
`getFeaturedValueExample()`). The original five records and the v0.4.3 assets are
unchanged.

The sources and outputs are under `public/examples/v0.4.4/` with a SHA-256
manifest, README and the HEIC `LICENSE.txt`. `script/v044ExampleFixtures.ts`
produces every output by driving the real tool page in Chromium and saving its
actual download. The HEIC input is not project-authored: it is the synthetic MIT
fixture `asym-base.heic` from the su-engineering/heic-web project (commit
`3261b10a31625dcb395b82081b3e9f7d10c9fc2c`), verified by SHA-256 and Git blob id
before it is copied. That permission covers the test fixture only; the
production decoder release-license gate in `docs/modules/HeicConverter.md` is
separate and unchanged. The JSON Formatter, Word and Character Counter and QR
Code Generator guides gained a short example each, verified against the real
tools. Merge and Split PDF page identity is verified by PDF.js text and rendered
pixels; PDF output bytes vary between runs, so the committed SHA-256 values
identify the committed files while page content is the reproducible part.

Evidence is recorded in `docs/TESTING.md` (v0.4.4 Batch 4). Open items carried to
Batch 6: the container gate ran twice and did not pass (one `net::ERR_NO_BUFFER_SPACE` browser failure per run in an unrelated image-converter spec, everything else green), so it stays release-blocking until a green exact-candidate run; browser-level coverage of the Merge
10-file / 25 MiB / 100-page limits, the Split 20-group limit, the HEIC
30-megapixel limit and a decode of the downloaded HEIC output is still absent,
so the 18 journeys do not all have independent coverage; the Compress PDF,
Images to PDF, PDF to JPG / PNG and image tools were not re-audited here. Batch
5 (four task guides and a hub) needs a separately scoped prompt.

## v0.4.4 Batch 5 implementation checkpoint — 2026-10-27

Status: LOCAL COMMIT, VALIDATED (unit 2,003; full default-off E2E 842 passed, 6 skipped by mode, 0 failed) ON `feature/v0.4.4-site-quality` after Batch 4 (cece08c); package remains 0.4.3. No push, merge, release, deployment, ad activation or AdSense change. This is not release readiness.

Added the `/guide` hub "Practical File Workflows" and four guides (assemble-pdf-packet, prepare-image-for-upload, heic-photos-to-pdf, pdf-pages-for-slides), links in primary navigation (Guides after All tools), a server-rendered home workflow section, the document and image category pages and nine tool pages, and five sitemap URLs (35 total). Planner-authorized documentation-list extension: `docs/modules/NavData.md` was edited only to reconcile the new Home / All tools / Guides / categories / About order.

Inherited release blocker, unchanged by this batch: the Batch 4 `npm run test:container` gate was run twice and failed both times (807 browser tests passed, one `net::ERR_NO_BUFFER_SPACE` navigation failure each, in different image-converter scenarios); host socket exhaustion is a hypothesis only. It must be re-run and resolved on the exact Batch 6 candidate. Merge 10-file/25 MiB/100-page, Split 20-group, HEIC 30-megapixel and downloaded HEIC decode limit evidence also remains for Batch 6; the guide workflows add positive evidence only for the small samples they use.

## v0.4.4 Batch 6 checkpoint - 2026-10-27

Status: NEEDS_CORRECTION, NOT RELEASE READY, NOTHING COMMITTED BY BATCH 6. The package remains 0.4.3. No push, merge, release, deployment, ad activation or AdSense action. Hosted CI was not run for this local candidate.

Passed: `npm run verify` (typecheck, lint, 2,004 unit tests, build); controlled preview-denial ads (6 passed, 2 skipped by mode); controlled enabled stubbed ads (4 passed, 4 skipped by mode); support-enabled subset (84 passed on rerun). Two complete default-off browser runs each ended 851 passed, 6 skipped by mode and 1 failed, with a different transient host-network failure each time (`net::ERR_NO_BUFFER_SPACE`, then a 33 s stall in a test that takes 9 s); neither is counted as a pass. The container gate first failed before its browser pass because `script/publicRouteInventory.ts` expected 30 sitemap URLs while the application serves 35; that helper and its test were then corrected under a one-time scope extension (35 URLs asserted, parity with the sitemap). The corrected container run passed build, health, HTTP, shutdown and cleanup, but its browser pass again had one `ERR_NO_BUFFER_SPACE` failure, and a third full host run had two failures, so no complete browser or container run is green yet.

Closed gaps: browser evidence for the Merge 10-file, 10 MiB, 25 MiB and 100-page limits, the Split 20-group limit, and a decode of downloaded HEIC JPEG and PNG output. Still open: an over-30-MP HEIC through the real decoder in a browser (unit evidence only), a green container gate, a green complete browser run, hosted CI for the exact commit, and the unmerged PR #48 and PR #41 integration. See the [implementation report](reports/V0_4_4_SITE_QUALITY_IMPLEMENTATION_REPORT.md).

Hosted CI correction (2026-10-28): hosted validation of `89f6728` passed 7 of 9 jobs; a test-only correction (Split download pages, calculator URL polling, hydration waits, a real over-30 MP HEIC browser test) passed local `verify`, full E2E and container on the final tree. Actual candidate readiness: **NOT_RELEASE_READY until the exact-SHA hosted run of the correction commit is green** (8 workflows, 9 jobs); no push to `master`, tag, release, deployment, ad activation or AdSense step has occurred.
