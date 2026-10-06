# v0.3.1 Vercel Web Analytics Launch Report

## Verdict

PASS_LAUNCHED_V0_3_1

## Release identity

- Version: `0.3.1`
- Release branch: `release/v0.3.1`
- Release-prepared SHA: `f0b26c00852fe048cb15839ddfc59504a8453de4`
- Pull request: #10 — Release v0.3.1 — Vercel Web Analytics
- PR merged: `2026-10-06T22:27:13Z`
- Merge method: merge commit
- Merged master SHA: `2c8c1dec611b228a73137c5ee8ae0a5cd60caab0`
- Tag: `v0.3.1`
- GitHub Release: https://github.com/dailephd/iworkhere.space/releases/tag/v0.3.1

The release branch and merged master have identical release content. No npm
publication applies because the root application package is private.

## Hosted validation

All eight required workflows passed on the release PR at
`f0b26c00852fe048cb15839ddfc59504a8453de4`:

| Workflow | Run ID | Attempt |
| --- | ---: | ---: |
| Typecheck | 37539667808 | 1 |
| Lint | 37539667768 | 1 |
| Test | 37539667956 | 1 |
| Build | 37539667807 | 1 |
| E2E | 37539667753 | 1 |
| Container | 37539667811 | 1 |
| Dashboard | 37539667760 | 1 |
| Observability database | 37539667826 | 1 |

All eight required workflows then passed on merged master
`2c8c1dec611b228a73137c5ee8ae0a5cd60caab0`, all on attempt 1:

| Workflow | Run ID |
| --- | ---: |
| Typecheck | 37540673054 |
| Lint | 37540673080 |
| Test | 37540673061 |
| Build | 37540673043 |
| E2E | 37540673030 |
| Container | 37540673048 |
| Dashboard | 37540673120 |
| Observability database | 37540673035 |

## Production deployment

- Vercel project: `iworkhere-space`
- Vercel project ID: `prj_OZIQho0P485NwArPlWTQuYfSQtNI`
- Team: `dailephds-projects`
- Team ID: `team_sQEdGnWaessGuITNTUuPtmfx`
- Production deployment: `dpl_67zHEP485iQtHBiM4VNPaURo4iw6`
- Deployment URL: https://iworkhere-space-6f1o35an4-dailephds-projects.vercel.app
- Public domain: https://iworkhere.space
- Production source SHA: `2c8c1dec611b228a73137c5ee8ae0a5cd60caab0`
- Deployment created: `2026-10-06T22:27:18.230Z`
- Deployment ready: `2026-10-06T22:27:59.138Z`
- Status: READY

## Analytics activation

Web Analytics was enabled on the public Vercel project by the owner before
production acceptance. The application flag
`NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=true` is scoped to Production only.
Preview and Development remain off.

The release continues to use exact-pinned `@vercel/analytics@2.0.1`.

## Live acceptance

Production validation passed for:

- Vercel Analytics provider activity;
- automatic initial page-view behavior;
- client-side navigation;
- query-string redaction;
- URL-fragment redaction;
- one Analytics wrapper with no duplicate integration;
- file-input privacy using a deterministic local fixture marker;
- no Vercel custom events;
- zero page or console errors during the Analytics smoke;
- service-worker registration and controlled reload.

Read-only Vercel metrics/API verification showed aggregated production page-view
rows for `/discover` and `/tool/[slug]` after the smoke. Those aggregates are
not interpreted as exact visitors or one-to-one smoke request counts.

## Existing-system regression

Existing application observability remained healthy. Three ordinary Production
Web Vitals requests to `/api/metric` returned HTTP 204 during launch
verification. v0.3.1 did not change the existing observability configuration.

The separate `iworkhere-observability` project remained distinct and protected
by Vercel Authentication; an unauthenticated deployment request redirected to
Vercel SSO. Advertising state was unchanged.

Public health, root/discover smoke, a representative Image Resizer workflow and
the Merge PDF page also passed.

## Remaining risks

None release-blocking.

## Final lifecycle state

v0.3.1 is released, tagged, publicly deployed, and receiving production Web
Analytics page-view data under the documented privacy boundary. The existing
application observability system and protected dashboard remain separate.

The next numbered version is v0.4.0 — Core Text, Data & Sharing Utilities.
