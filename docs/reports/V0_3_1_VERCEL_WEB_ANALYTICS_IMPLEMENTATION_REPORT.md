# v0.3.1 Vercel Web Analytics implementation report

Repository: `C:\Users\daile\Projects\iworkhere.space`

Implementation branch: `feature/v0.3.1-vercel-web-analytics`

Starting planning commit: `70d3eefddd6b9d09c4215f3dffccc9373ac948fb`; inspected master baseline: `008458651bc8786b46fcc4b27ef119147e1e2579`.

Validated implementation Git tree before this report: `e7c3980591c7ebe46d7d7f4ff2dededf6a567ed7`. This identifies the staged source/config/test/technical-doc snapshot without making a self-referential commit-hash claim. Implementation code commit: `b292b8f8d60ef69aed910a9da9f2fed5c3947e93`. The report-only follow-up records that exact identity; production source is unchanged. Final completion evidence records the published branch identity and the last enabled proof against that revision.

Target release: v0.3.1. Root package remains **0.3.0**. No release preparation or deployment was performed.

## Result and ownership

Automatic Vercel page views are implemented as a separate, default-off platform traffic surface. `src/module/analytics/vercelWebAnalytics.client.ts` owns exact-true enablement and the pure beforeSend policy. `src/component/observability/VercelWebAnalytics.tsx` is the only production SDK import owner. `RootLayout` composes it once beside WebVitals and AdSenseScript, preserving the existing server layout, ThemeProvider and AppShell.

The current analytics provider singleton, canonical events, observability facade, instrumentation-client, Web Vitals, metrics, diagnostics, database and dashboard were not modified. Provider-specific imports remain out of tools and existing providers. No custom Vercel events, Speed Insights, API ingestion, token, identity feature or manual page-view call was added.

my-dev-kit 1.12.5 revalidated the planning index against unchanged implementation source from master before edits. Initial index: `.my-dev-kit-context/indexes/iworkhere-space-v0.3.1-vercel-analytics-planning`. Final refreshed index: `.my-dev-kit-context/indexes/iworkhere-space-v0.3.1-vercel-analytics-implementation`. Bounded lookup/source retrieval confirmed current owners; no competing architecture was created.

## Dependency evidence

Requested major: **2**. Registry query returned 2.0.0 and **2.0.1**; the latest compatible v2 was pinned exactly in root package metadata and lockfile. Published peers permit Next >=13 and React 18/19, satisfying Next 16.3.8 and React 19.2.3. The package declares no additional Node engine restriction; production builds and the Node 24 container passed. The published Next entry exports Analytics and the beforeSend function contract returning an event or null. SDK license is MIT.

The initial npm install hit optional Svelte/Vite peer resolution. A minimal install with legacy peer resolution added only Analytics; unrelated lockfile classification churn was removed. Ordinary npm ci then succeeded, and the Docker gate also performed ordinary npm ci. No permanent legacy-peer configuration, unrelated dependency upgrade or dashboard dependency change was introduced.

Official references: [package configuration](https://vercel.com/docs/analytics/package), [sensitive-data redaction](https://vercel.com/docs/analytics/redacting-sensitive-data), [registry package](https://registry.npmjs.org/@vercel/analytics/2.0.1).

## Activation and privacy

Only exact `NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=true` enables the component. Unset, false, other casing and arbitrary values are off. This public flag is compiled at build time and contains no secret. Production activation remains external; Preview/development are unset or false by default. A runtime environment change does not alter an already-built browser bundle.

The pure policy accepts page views only, reconstructs HTTP(S) or root-relative URLs, preserves origin/path, clears query and fragment, and returns explicit type/URL fields. Malformed URLs, unexpected types, non-HTTP schemes, credential-bearing URLs, and throwing accessors return null. No public private-route denylist was needed: the dashboard is independently deployed. No file bytes, names, MIME, sizes, image/PDF properties, input/output, storage, identity, raw errors or application metric payload is attached.

The environment example, Docker builder ARG/ENV, container build, normal Playwright server and PDF foundation build commands explicitly use safe defaults. Document/image processing stays browser-local while explicitly enabled aggregate page views may use the network.

## Validation evidence

All paths below are relative to the repository and retain unique run identities.

| Gate | Result | Run / artifact |
| --- | --- | --- |
| Focused policy, component, layout and existing analytics/observability regression | 95 passed, 0 failed | `test-report/2026-10-06T18-50-25-439Z-91759758/results.json` and `results.xml` |
| Focused disabled Analytics and service worker browser tests | 6 passed | `test-report/e2e/2026-10-06T18-54-01-939Z-22ffc6ed/` |
| Enabled SDK/browser proof | PASS, desktop and mobile | `test-report/vercel-analytics-2026-10-06T18-53-37-078Z-b0805cbe/summary.json` |
| Typecheck, lint, full unit tests, normal production build | PASS; 899 unit tests, 0 failed, 0 skipped | VERIFY `2026-10-06T18-54-51-502Z-3aa77d62`; `test-report/<RUN_ID>/results.json`, `results.xml`, `command/` |
| Full normal E2E, sequential final run | 314 passed, 0 failed, 0 skipped, 0 retries | `test-report/e2e/2026-10-06T19-14-24-414Z-e172a758/` |
| Container, sequential final run | PASS; 314 browser tests, no skips/retries | `test-report/container/2026-10-06T19-26-55-539Z-a9641c39/summary.json`; browser report `test-report/e2e/2026-10-06T19-26-55-539Z-a9641c39-browser/` |
| Diff whitespace review | PASS | `git diff --check`, cached review |

Lint retains five pre-existing warnings and no errors. Container image `sha256:90236a737cfffbc511793dfe206859389ee75a3b9c1d8375bffa48bb80b59900` ran healthy as uid 1001, with the requested read-only/hardening flags. Service worker and document/image runtime gates passed. Shutdown used SIGTERM (exit 143), no OOM or forced SIGKILL occurred, and cleanup passed. Analytics remained disabled.

Commands: focused `npx vitest run` with the six affected/current contract test files; `npx playwright test` with Analytics/service-worker cases; `npm run typecheck`; `npm run lint`; `npm run verify`; `npm run test:e2e`; `npm run test:container`; `npx tsx script/vercelAnalyticsSmoke.ts`.

### Enabled proof boundaries

The dedicated script copies source/config/test helpers into a unique project-contained build root, links the installed dependencies, makes an isolated webpack production build with Analytics true, and uses an available isolated server port. It does not overwrite the normal `.next` build. Fresh desktop/mobile browser contexts block service workers. The actual pinned Next SDK loads the actual official vendor runtime; requests are identified by SDK script metadata and payload semantics, not a single endpoint path. Intake is fulfilled locally and unrecognized external requests are blocked. No live traffic event is sent to Vercel.

The vendor runtime source was `https://va.vercel-scripts.com/v1/script.js`, SHA-256 `b1fa9fc8104da15958badc63bbebe46eeea4d9ce88e587d7732b2c4f4238d8af`. Its automation exclusion was overridden only inside the fresh test contexts. Proof observed one SDK script and one initial page view followed by one real Next Link navigation view per viewport. Query/hash markers and a synthetic filename were absent from captured events; resizing produced no custom event or duplicate view. Browser diagnostics were empty. The root unit contract independently checks one wrapper composition. Runtime bytes, source/hash and sanitized captures are retained in the unique report.

A final enabled proof is also required against the resulting committed revision before push; its unique artifact and exact commit binding are returned in the completion report. Local fulfillment proves SDK behavior, not production Vercel receipt or every managed Resilient Intake deployment variant.

### Failed attempts retained and corrected

Early harness attempts lacked a copied test helper, then exposed tsx's Node function-name helper in browser initialization. Copying the test helpers and using a browser-only initialization literal corrected those harness defects; final unit/typecheck/build/browser validation passed.

The first full normal and container suites were run concurrently. Normal run `2026-10-06T18-56-49-802Z-f0cfc6cd` passed 312/314, with Chromium ERR_NO_BUFFER_SPACE in the service-worker case and a HEIC readiness timeout. Container run `2026-10-06T18-55-02-174Z-af95833f` passed 313/314, with a HEIC output timeout; runtime/shutdown/cleanup checks still passed. All five isolated desktop HEIC/service-worker diagnostic cases then passed in `2026-10-06T19-13-47-200Z-84c309b0`. The final complete suites were run sequentially and both passed. No assertion, timeout, retry setting, diagnostic gate or product behavior was weakened. Earlier artifacts remain retained.

## Security review

`npm audit`: 21 findings (2 low, 3 moderate, 15 high, 1 critical). `npm audit --omit=dev`: one high finding, source-map-js. Advisory dictionaries and counts match the pre-install baseline exactly. Analytics introduced no new security blocker. Unrelated upgrades were not performed. Audit JSON is retained under `.my-dev-kit-context/reports/v0.3.1-audit-*.json`.

## Changed files

- `.env.example`, `Dockerfile`, `package.json`, `package-lock.json`, `playwright.config.ts`
- `src/module/analytics/vercelWebAnalytics.client.ts`, `vercelWebAnalytics.test.ts`
- `src/component/observability/VercelWebAnalytics.tsx`, `VercelWebAnalytics.test.tsx`
- `src/app/layout.tsx`, `layout.test.tsx`
- `script/containerSmoke.ts`, `script/pdfFoundationSmoke.ts`, `script/vercelAnalyticsSmoke.ts`
- `test/e2e/vercel-analytics.spec.ts`
- `docs/OBSERVABILITY.md`, `docs/DEPLOYMENT.md`, `docs/architecture.md`
- this implementation report

No dashboard, registry/catalog, tool implementation, service worker, database, vercel.json, frozen plan, roadmap, project-status or doc_index change was made.

## Remaining external work and risks

No implementation gap remains. Inherited audit findings remain for separate readiness review. The controlled test downloads the official runtime and therefore depends on its availability/current service behavior; source/hash is recorded. Production-managed Resilient Intake and actual Vercel receipt still require live release acceptance.

The operator must enable Web Analytics only on public iworkhere-space, set the public flag true for Production only, complete separate documentation/completeness and exact-SHA readiness, prepare the 0.3.0 to 0.3.1 release, merge/deploy the validated release, and verify automatic initial/client-navigation views with URL redaction in Vercel. No live Vercel settings, DNS, Neon, AdSense, dashboard protection, PR, merge, tag or production deployment was changed by implementation.
