# v0.4.4 Site Quality & Search Recovery - Batch 6 implementation report

Date: 2026-10-27 (updated after the route-inventory correction). State: **NEEDS_CORRECTION - not release ready.** Nothing was committed by Batch 6, pushed, merged, released, deployed or submitted for review.

## Identity

- Repository root: `C:\Users\daile\Projects\iworkhere.space`; worktree `.my-dev-kit-workflow\worktrees\v0.4.4-batch1`; branch `feature/v0.4.4-site-quality`.
- Source commit: `f846c92c58d21dfec15f2fdef4ae007d77c86a3c` (ancestors: Batch 4 `cece08c`, Batch 3 `f957edc`, Batch 2 `6706c50`, Batch 1 `1dce0fe`). Package version 0.4.3, unchanged. No `manifest.txt` exists locally.
- The primary checkout (`feature/six-palette-appearance` at `56a3ced`) was not touched.
- Batch 6 working-tree changes (uncommitted; includes `script/publicRouteInventory.ts` and its test): `test/e2e/pdf-page-copy.spec.ts`, `test/e2e/heic-converter.spec.ts`, `src/module/tool/image/imageFeedback.test.ts`, `README.md`, `CHANGELOG.md`, `docs/ROADMAP.md`, `docs/project-status.md`, `docs/doc_index.md`, `docs/TESTING.md`, `docs/modules/{MergePdf,SplitPdf,HeicConverter}.md` and this report. No product source, dependency, workflow or script file changed.

## Scope and provenance

Batch 1 titles (`1dce0fe`), Batch 2 arithmetic and journeys (`6706c50`), Batch 3 preview-ad guard and service worker (`f957edc`), Batch 4 four file examples (`cece08c`), Batch 5 `/guide` hub and four guides (`f846c92`). Their histories are preserved.

## Boundary evidence (items A-D)

All generated PDFs are synthetic, built in memory and never uploaded; no fixture was written to disk or committed. Runs were desktop Chromium; the full suites below also run mobile.

| Item | Result | Test and run |
| --- | --- | --- |
| A. Merge limits | BROWSER_PASS | `Merge PDF limit boundaries` (4 tests), run `2026-10-27T17-22-26-439Z-6ef54cba`. 10 files merge; 11th and an 9+2 batch rejected atomically. Exactly 10 MiB merges; 10 MiB + 1 byte rejected with prior files kept. 10 + 10 + 5 MiB (25 MiB) merges; +1 byte rejected. 50 + 50 pages give a 100-page file; +1 page, 50 + 51 and a single 101-page file rejected. Oracle: PDF.js text of the downloaded file (page count and order). |
| B. Split 20 groups | BROWSER_PASS | `Split: 20 output groups...`, same run. 20 groups added, Add disabled, forced click adds no 21st, all 20 downloads match an independent page table through PDF.js. |
| C. HEIC 30 MP area | UNIT_ONLY; BROWSER_OVERSIZE_UNVERIFIED | `imageFeedback.test.ts` (`HEIC decoded-area limit is exact...`) in the verify run `2026-10-27T17-33-50-121Z-55392033`. No retained oversized HEIC with provenance exists (only the 480x320 MIT fixture), so none was invented. This is a residual gap, not a browser pass. |
| D. HEIC downloaded output | BROWSER_PASS | `real jpeg/png inspection, conversion, download and containment`, run `2026-10-27T17-27-59-036Z-779dd220`. Independent header reader: 480x320 and type; blob type/size equal the saved file; native decode compared with the decoded source (mean difference 0 PNG, 1.57 JPEG; mirrored control 39-40); alpha 255. Invalid-source rejection and reset/replacement remain covered by existing tests in the same spec. |

An earlier HEIC attempt (`2026-10-27T17-23-57-190Z-54240d47`) failed because my new assertion looked for the source preview after the result replaced it; it was a test defect and was fixed before the passing run.

## Gates on this candidate

| Gate | Result | Run id |
| --- | --- | --- |
| `npm run verify` | PASS: typecheck, lint, 2,004 tests in 126 files, default-off build | `2026-10-27T17-33-50-121Z-55392033` |
| Full default-off browser suite, run 1 | **NOT PASS**: 851 passed, 6 skipped by mode, 1 failed (console `net::ERR_NO_BUFFER_SPACE` in the mobile cold-route test) | `2026-10-27T17-35-05-524Z-40814c79` |
| Full browser suite, run 2 | **NOT PASS**: 851 passed, 6 skipped, 1 failed (`tool-value-examples` desktop took 33 s against a normal 9 s and hit the 30 s timeout) | `2026-10-27T17-53-25-644Z-3d30e76e` |
| Isolated rerun of the two failing specs | 85 passed, 1 failed (`ERR_NO_BUFFER_SPACE` in a third, different test) | `2026-10-27T18-12-34-266Z-1bfd0724` |
| Preview ads denial (`VERCEL_ENV=preview`) | PASS: 6 passed, 2 skipped (the enabled-mode tests); the preview-denial test executed | `2026-10-27T18-16-26-591Z-90737b1b` |
| Enabled stubbed ads (`production`, `E2E_ADS_ENABLED`) | PASS: 4 passed, 4 skipped (disabled and preview tests); enabled-mode tests executed | `2026-10-27T18-16-51-527Z-e7fdc2b2` |
| Support-enabled subset | First run 83 passed, 1 failed (footer-flow, a React #418 hydration error plus a 30 s timeout); rerun 84 passed, 0 skipped | `2026-10-27T18-17-14-804Z-25ca3f9b`, `2026-10-27T18-19-18-721Z-3198b22e` |
| Container gate, before route fix | **NOT PASS**: stopped at the stale route inventory; browser pass NOT_RUN | `2026-10-27T18-20-43-014Z-f130376e` |
| Verify after route fix | PASS: 126+ files, typecheck, lint, build (`script/publicRouteInventory.test.ts` and `sitemap.test.ts`: 9 passed) | `2026-10-27T18-43-10-416Z-93a88643` |
| Full default-off browser suite, run 3 | **NOT PASS**: 850 passed, 6 skipped, 2 failed: `ERR_NO_BUFFER_SPACE` on `page.goto` to `/tool/images-to-pdf`, and the new Split 20-group test (the 5 s wait for the `Split PDFs ready` heading expired; it passed in 8 s earlier) | `2026-10-27T18-44-41-424Z-cd1ad17b` |
| Container gate, after route fix | **NOT PASS**: image build, health, 35-URL HTTP smoke (including all guide URLs), shutdown (no OOM, exit 143) and cleanup passed; nested browser pass 851 passed, 6 skipped, 1 failed (`ERR_NO_BUFFER_SPACE` console error in a contact-footer test) | `2026-10-27T19-06-50-347Z-e4996ca8` |
| Hosted CI (8 workflows, 9 required jobs) | HOSTED_CI_PENDING: not run, nothing pushed | none |

No failure was reclassified as a pass and no retry, skip or timeout change was made. The support-mode hydration error did not recur on rerun; its cause is unknown.

## Container investigation

- The earlier `ERR_NO_BUFFER_SPACE` failures (runs `...14-41-14-361Z-01cf74b2`, `...15-01-46-814Z-2db5925a`) were not caused by the runner or by `image-converter.spec.ts`: the plain host suite (no Docker) now shows the same error in other tests (runs 1 and the isolated rerun above) and an unexplained stall (run 2). Running `image-converter.spec.ts` four times (128 tests) against a container started with the runner's exact flags passed (TIME_WAIT peaked at 740; the image was removed afterwards).
- Host evidence (read-only): Windows non-paged pool grew from about 2,158 MB to 2,394 MB during the session, the cumulative TCPv4 connection-failure counter rose by several hundred during each long run, and TIME_WAIT never exceeded about 850, so ephemeral-port exhaustion is not indicated. The most likely explanation is host network-buffer pressure, but **the cause is not proven**. I did not alter system settings, restart Docker or stop other processes.
- New, separate, proven defect: the container run built the image, was healthy, and then stopped at `Container public route inventory mismatch.` `script/publicRouteInventory.ts` builds its expected list from five fixed routes, the tools and the categories (30 URLs) and omits `/guide` plus the four guide URLs added by Batch 5, while the sitemap now has 35. The nested browser suite was therefore NOT_RUN, and the earlier green container result predates Batch 5. Batch 5 did not run the container gate.
- **Corrected under a one-time scope extension:** `script/publicRouteInventory.ts` now appends `/guide` and one URL per `getAllTaskGuide()` record (35 in total) and `script/publicRouteInventory.test.ts` asserts the 35 URLs, the four exact guide paths, parity with `src/app/sitemap.ts`, and rejection of the legacy list or any missing, replaced or query-suffixed guide route. The route check then passed in the container. Earlier text: the original minimal fix was the minimal fix is adding those five URLs to `getExpectedPublicSitemapUrls()` in `script/publicRouteInventory.ts` and updating `script/publicRouteInventory.test.ts`. Neither file is in the Batch 6 authorized path list and `script/containerSmoke.ts` is correct and unchanged, so I did not edit them.

## Documentation, privacy, advertising, runtime

Registered tools, categories, the nine file examples, five home cards, four guides plus hub, 35 sitemap URLs, titles, 404/noindex, ad exclusions and the preview ad guard are asserted by tests that passed in the runs above. README stated the work was not implemented and was corrected. Project status, roadmap, testing, doc index, changelog and the three module documents were updated; `docs/CI_CD.md`, `DEPLOYMENT.md`, `ADVERTISING.md`, `architecture.md` and `DESIGN.md` were reviewed and needed no change. Per-claim checks of the privacy, service-worker and navigation wording beyond those tests were not performed individually, and I did not run a relative-link checker (the repository has no docs check script). No new dependency, network call or telemetry was added. No live advertisement was requested.

## Remaining release gates

1. A complete green `npm run test:container` (route inventory is now corrected; the last run failed once on `ERR_NO_BUFFER_SPACE`). The host showed non-paged pool at about 2.42 GB, not released while idle, and a rising TCPv4 connection-failure counter; four browser runs in a row had one or two unexplained failures, so this remains an unresolved reliability risk and is not attributed to a proven cause.
1a. RESOLVED in the continuation below: the Split 20-group `toBeFocused` wait is now 30 s and passes.
1b. DIAGNOSED in the hydration continuation below: the footer-flow #418 is test-induced timing; no application defect was found.
2. A complete green default-off browser run on an unchanged candidate; the host network-buffer problem likely needs a reboot or driver investigation first.
3. Optionally a real over-30-MP HEIC fixture with provenance, or accept UNIT_ONLY.
4. Commit, then hosted CI on the exact SHA (8 workflows, 9 jobs).
5. Reconcile unmerged PR #48 (plan) and PR #41 (overlapping planning and status documents); version bump, tag, release, Vercel verification and AdSense review are separate, later steps.

## Continuation: Split timing fix and Windows Chromium diagnostic (2026-10-27)

State: **NEEDS_CORRECTION - not release ready; nothing committed.** v0.4.4 not yet released, deployed or AdSense-approved; PR #48/#41 unresolved, hosted validation pending. Unreleased local candidate.

- Split 20-group test (`test/e2e/pdf-page-copy.spec.ts`): the failing assertion was `toBeFocused()` on the `Split PDFs ready` heading (default 5,000 ms), not a visibility check. Only its timeout changed, to `{ timeout: 30_000 }`; locator, operations, 20 downloads and PDF.js checks are unchanged. Focused run `2026-10-27T19-48-48-410Z-56c306ec`: desktop 14.3 s and mobile 15.4 s, exit 0 (default-off build, no flag). The timing defect is resolved; this says nothing about general suite readiness.
- Gates: `npm run verify` PASS, 2,007 of 2,007 tests, run `2026-10-27T19-49-45-652Z-eb7d7fbb`; route inventory and sitemap tests 9 of 9 (35 URLs), run `2026-10-27T19-49-41-243Z-3bb9d5ff`.
- Diagnostic toggle (`playwright.config.ts`): `E2E_DISABLE_TCP_PORT_RANDOMIZATION_WIN=true` on win32 only adds Chromium launch argument `--disable-features=TcpPortRandomizationWin`; unset behaves exactly as before. Set for the current process only and removed afterwards. Chromium is Playwright 1.63.0 build 153.0.8010.12 (the build named in Chromium issue 572515601, an outside hypothesis); the browser launched and ran with the flag, so it was accepted.
- Flagged full E2E, run `2026-10-27T19-52-11-142Z-0839e4a3` (27.2 min): **NOT PASS**, 850 passed, 6 skipped, 2 failed, both in `footer-flow.spec.ts` desktop: a `pageerror` React #418 hydration error on `/discover`, and `the last page action is not covered by the footer` timing out at 30 s. **No `ERR_NO_BUFFER_SPACE` occurred in this run** (correlation with the flag only, not proof; earlier unflagged runs hit it in 1-2 tests per run). One focused retry of `footer-flow.spec.ts` with the flag passed 20 of 20 (run `2026-10-27T20-19-51-328Z-e676e1ac`). The #418 hydration error has now been seen twice (support run, this run) and is intermittent and undiagnosed; it is an open product reliability risk, not a Windows network effect.
- Container gate with the flag: NOT_RUN. It was conditioned on a passing flagged E2E.
- Host read-only measurements: Windows 10.0.26300; 64 GB RAM with about 32 GB available; non-paged pool about 2.47 GB (elevated, not proof of cause); TCP states Established 66, TimeWait 33, no exhaustion; dynamic port range 49152 (16,384 ports). 23 chrome and 11 node processes belonged to other work and were not touched. The failed navigation in run `...cd1ad17b` was `page.goto` to `/tool/images-to-pdf` (mobile) failing after 169 ms with `net::ERR_NO_BUFFER_SPACE`, before any HTTP response, so it is a Chromium or host failure, not an application HTTP error.
- Retrieval (corrected in the later continuation below): this earlier statement that `mdk-1.13.0` and the CURRENT index did not exist was wrong for the worktree; both exist there.
- Unchanged: HEIC over 30 MP is UNIT_ONLY (browser oversize UNVERIFIED); ads, preview and support results above stand; PR #48/#41 not rechecked.

## Continuation: React #418 diagnosis and local gates (2026-10-27)

Worktree `C:/Users/daile/Projects/iworkhere.space/.my-dev-kit-workflow/worktrees/v0.4.4-batch1`, branch `feature/v0.4.4-site-quality`, start SHA `f846c92c58d21dfec15f2fdef4ae007d77c86a3c`. Run identities below are generated report ids, not commit SHAs. Release readiness: **NOT_READY**.

**Failure evidence (run `2026-10-27T19-52-11-142Z-0839e4a3`, desktop):** both failures were in `footer-flow.spec.ts`: `on a long page the footer is in ordinary flow...` (1.3 s, `pageerror` Minified React error #418, `args[]=HTML&args[]=`) and `the last page action is not covered by the footer` (30 s timeout, same #418 in its diagnostics). Both tests append a node to `main` immediately after `page.goto`. The failure snapshot showed "Themes" enabled, a hydrated page and a footer.

**Hypotheses and probe** (read-only Playwright probe against the default-off production build on 127.0.0.1:3101; at most four navigations per scenario; server stopped afterwards):

| Scenario | Result |
| --- | --- |
| A. direct `/discover`, service workers blocked, no DOM mutation, 4 navigations | 0 #418 |
| B. normal context, first visit then warm revisit (service worker controlled, warm response `fromServiceWorker` true), 2 contexts | 0 #418 |
| C. client transition `/` to `/discover`, no mutation, 4 navigations | 0 #418 |
| D. append to `main` immediately after `goto` (Themes still disabled), 4 navigations | 4 of 4 #418; the appended node was discarded |
| E. append to `main` only after Themes was enabled, 4 navigations | 0 #418; node retained; all 198 `main` descendants already had React fibers when Themes enabled |

The aborted link-prefetch `requestfailed` entries occurred in every scenario, including clean ones, and are not associated with #418. `DiscoverClient` renders `ToolSearch` with fixed props; `ToolSearch` initial state is `""` and `null` with no `window`, storage, time or random reads. No source-level first-render mismatch was found, and no application file was changed.

**Classification: PROVEN_TEST_TIMING for the footer-flow failures.** A test that mutates React-managed DOM before hydration finishes causes #418 and a client re-render that discards the node (which also explains the 30 s timeout). The earlier support-mode run also failed in `footer-flow.spec.ts`; I believe it is the same mechanism but did not re-run that configuration, so that attribution is not proven. A passing retry was not used as evidence. Unmutated navigation did not produce #418 in these 10 navigations; this does not prove no application-side race exists elsewhere.

**Change:** `test/e2e/footer-flow.spec.ts` gains a test-local `waitForHydration(page)` (`Themes` button `toBeEnabled()`; `ThemeProvider` sets `ready` in a layout effect during the hydration commit) and calls it after `goto` in exactly the three tests that append to `main`: the long page, content-added-to-short-page, and last-page-action tests. No sleep, timeout, retry or assertion change.

**Gates (default-off build; the opt-in Windows flag only where stated):**

- Route inventory and sitemap tests: 9 of 9, run `2026-10-27T20-49-39-051Z-b03ea229`.
- `npm run verify`: PASS (typecheck, lint, 2,007 of 2,007 tests, build), run `2026-10-27T20-49-50-496Z-1b2c2b91`.
- Focused `footer-flow.spec.ts`, desktop and mobile: 20 passed, run `2026-10-27T20-53-40-386Z-f89f7201`.
- Full browser E2E with `E2E_DISABLE_TCP_PORT_RANDOMIZATION_WIN=true` (process-scoped, removed afterwards): exit 0, 852 passed, 6 skipped (mode-specific), 0 failed, run `2026-10-27T20-54-13-881Z-af0cae0d` (17.6 min). This passed with the mitigation on; the flag is not proven causal, stays opt-in and off by default, and no default-environment (flag-off) full run was made after the fix.
- Container (`npm run test:container`, same opt-in on the host Playwright process), run `2026-10-27T21-12-17-470Z-eb224735`: exit 0. Image build, health (5 of 5 probes exit 0; summary `healthy`), HTTP smoke 47 of 47 URLs 200 (the 35 public routes plus sitemap, health, ads.txt, service worker, manifest and vendor/licence assets), nested browser run `...eb224735-browser` 852 passed, 6 skipped, 0 failed, SIGTERM shutdown exit 143, `OOMKilled` false, no forced SIGKILL, cleanup PASS.

**Retrieval:** my-dev-kit 1.13.0 is installed in the worktree. The CURRENT index `iworkhere-space-v0.4.3-current` is for this worktree (roots `src`, `test/e2e`) and was built before the Batch 6 edits, so it is stale for files edited since. One `search` query located the Discover owners; `ToolSearch.tsx` was checked with a targeted grep and `footer-flow.spec.ts`, `ThemeProvider.tsx`, `ThemeToggle.tsx`, `DiscoverClient.tsx` and `playwright.config.ts` were read directly because they are small and the index was stale for them.

**Still open:** HEIC over 30 MP in a real browser is UNVERIFIED (no provenance-backed fixture); hosted exact-SHA CI (8 workflows, 9 jobs) not run; PR #48 and PR #41 not rechecked and not integrated; no push, merge, tag, release, deployment or AdSense step was taken. Default Windows (flag-off) reliability against `ERR_NO_BUFFER_SPACE` is unresolved.

## Filesystem hygiene

Scratch outputs are under `.my-dev-kit-workflow/tmp/v0.4.4/`, `.my-dev-kit-workflow/npm-cache/v0.4.4/` and `.my-dev-kit-workflow/playwright-browsers/v0.4.4/` (a local copy of the existing Chromium 1243 build); all are ignored. The Docker diagnostic and smoke images and containers were removed. No visible window was opened by these commands.
