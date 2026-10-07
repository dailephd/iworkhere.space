# v0.4.0 Pre-Release Readiness Correction Report

## 1–4. Identity

- Trigger: `PRE_RELEASE_READINESS: NEEDS_CORRECTION` on candidate
  `196d4c34b5c1a59bb8e5c5eacf5d850ce1fac418` (2026-10-07). Three findings: QR encoder
  bundle isolation, stale `npm run dev:check` paths, deployed-state wording.
- Starting candidate SHA: `196d4c34b5c1a59bb8e5c5eacf5d850ce1fac418`
- Branch: `fix/v0.4.0-readiness-corrections`
- my-dev-kit `@dailephd/my-dev-kit` 1.12.5; fresh index
  `.my-dev-kit-context/indexes/iworkhere-space-v0.4-readiness-correction-20261007T124714`
  (roots `src`, `test`, `script`, `scripts`; not committed).

## A. QR encoder bundle isolation

### 5–6. Reproduction on the starting SHA

After `npm run build`, the emitted client chunk containing `uqr` was identified by the
encoder's own error text ("uqr only supports encoding string and binary data"), not by
file name or size. Fresh Chromium contexts per route showed the same chunk delivered on
every route:

```text
IDENTIFIED_UQR_CHUNK: 1ct_haazuqh7d.js (133,712 B, 30,993 B gzip; shared tool-component chunk)
HOME_UQR_LOADED: YES        DISCOVER_UQR_LOADED: YES      CALCULATOR_UQR_LOADED: YES
JSON_UQR_LOADED: YES        COUNTER_UQR_LOADED: YES       QR_UQR_LOADED: YES
```

The raw HTML of `/` and `/tool/calculator` referenced the chunk.

### 7. Root cause

`app/layout.tsx` and the tool/category pages import `metadata.ts` / `registry.ts`, and
`registry.ts` statically imports every tool's `"use client"` component. Next therefore
preloads every tool component's client chunk on every route. `QrCodeGeneratorTool.tsx`
imported `qrCode.ts`, which statically imports `uqr`, so the encoder rode inside that
shared chunk (`registry → QrCodeGeneratorTool → qrCode → uqr`, confirmed; no registry
redesign was needed).

### 8–9. Correction

`QrCodeGeneratorTool.tsx` no longer imports `qrCode.ts` statically. It loads it through
one memoized `import("./qrCode")` (reset on failure so a later Generate can retry),
preloads it once on mount, and awaits it in Generate. `qrCode.ts` itself is unchanged.
The generation ticket guards the module wait, so an edit, replacement generation, Reset
or unmount during the module load discards the continuation. A module-load failure shows
the bounded message `Could not generate the QR code.`, calls `captureError` with only
the tool id and the fixed boundary name `QrCodeGeneratorTool.loadQrCodeModule`, creates
no preview or download and emits no success event. The preview image size uses a local
512 constant so no value import of `qrCode.ts` remains.

### 10–12. Proof after the correction

- Production build: the encoder is in its own chunk (`0oi2b4u9uwn1n.js` in that build;
  names change per build).
- Durable regression `test/e2e/qr-code-generator.spec.ts` ("the uqr encoder chunk is
  requested only by the QR route"): for `/`, `/discover`, `/tool/calculator`,
  `/tool/json-formatter` and `/tool/word-character-counter` it uses a fresh browser
  context per route and asserts that no emitted `/_next/static/*.js` response contains the
  encoder signature; on `/tool/qr-code-generator` it asserts a script response containing
  the signature is loaded. No hashed file name, byte threshold or sleep is used.
  Negative control: with the previous component restored and rebuilt, the test fails
  (`/ must not load the uqr encoder`); with the correction it passes on desktop and mobile.
- Result after the correction: home, Discover, calculator, JSON and counter do not load the
  encoder (`*_UQR_LOADED: NO`); the QR route does (`QR_ROUTE_UQR_LOADED: YES`). The same test
  passed in the full local E2E, in the container E2E and (see CI on the PR).
- Component tests: `QrCodeGeneratorTool.moduleLoad.test.tsx` adds 8 tests (encoder
  requested only on render with no event/error/payload; Generate waits for the module;
  stale after edit; stale after Reset; newest of two generations only; unmount during
  load; bounded failure with payload-free `captureError`; stale failure not reported).
  A mutation check (removing the post-load stale guard) fails four of them, again after
  the PNG change below.

## B. `npm run dev:check`

- 13–15. Root cause: `scripts/Check-DevEnv.ps1` required `doc\ROADMAP.md` and
  `doc\project-status.md`, but the documentation has lived in `docs\` since commit
  `11219ce` (2026-10-03), so the check (and `npm run dev`, which runs it first) failed on
  Windows with "Required repository path 'doc\ROADMAP.md' is missing". The same script is
  in the v0.3.1 tag. The existing `script/devStartup.test.ts` had codified the stale
  strings.
- Correction: exactly those two entries now read `docs\ROADMAP.md` and
  `docs\project-status.md`. `devStartup.test.ts` asserts the new strings and gains a
  contract test that every static required path exists and that no `'doc\` entry returns.
- Result: `npm run dev:check` prints "Development environment check passed." (Node
  v24.20.0, npm 11.19.0) with exit 0.

## C. Deployment-state wording

- 16–19. Read-only checks (2026-10-07): Vercel project `iworkhere-space`; production
  deployment `dpl_8pVqUG4iN3vyC6f13e8jQnTQopi2`, Ready, aliases `iworkhere.space` and
  `www.iworkhere.space`. The Vercel CLI does not expose the commit SHA here; the source SHA
  was established by matching that deployment's URL to the GitHub deployment record for
  `196d4c34b5c1a59bb8e5c5eacf5d850ce1fac418` ("Production – iworkhere-space", success).
  `LIVE_PRODUCTION_SOURCE_SHA: 196d4c34b5c1a59bb8e5c5eacf5d850ce1fac418`;
  `LIVE_PRODUCTION_SITEMAP_COUNT: 27`; `/tool/json-formatter`,
  `/tool/word-character-counter` and `/tool/qr-code-generator` all return 200;
  `https://www.iworkhere.space/` redirects 308 to the apex.
- 20–21. The v0.4 candidate is therefore already served by production, which already
  deploys `master` automatically (`docs/DEPLOYMENT.md`). The earlier reconciliation wrote
  that production was "still v0.3.1 (23 URLs)" and that v0.4 was "not deployed" without a
  live check; that was wrong. Corrected: README, CHANGELOG Unreleased intro,
  `docs/project-status.md` (new fields `FORMAL_RELEASE_VERSION`, `V0_4_FORMAL_RELEASE`,
  `PRODUCTION_CONTINUOUS_DEPLOYMENT`, `PRODUCTION_SOURCE_SHA`, `LIVE_CATALOG`; readiness
  recorded as NEEDS_CORRECTION; next action updated) and one sentence in
  `docs/architecture.md`. Historical records (v0.3.1 launch, the dated pre-v0.4 checkpoint
  with 23 URLs, plans and earlier reports) are unchanged. A continuous deployment is not a
  numbered release: formal release remains v0.3.1, package 0.3.1, no v0.4.0 tag or GitHub
  Release.

## D. QR preview timeout found during validation

### Original failure (preserved)

The first full local Windows E2E after the QR change
(`2026-10-07T17-57-32-184Z-a265e45e`) finished 349 passed, 1 failed: the desktop
"downloads a real 512x512 PNG that independently decodes to the Unicode and emoji payload"
test timed out at its 5 s `toBeVisible` wait for the preview. The failure snapshot showed
the text entered, Generate enabled and focused, and no preview and no error. A similar 5 s
preview timeout had occurred once earlier, on the pre-dynamic-import component
(`2026-10-07T15-19-09-893Z-03ce9e8b`; a rerun hit an unrelated image-feedback timeout,
`...15-29-00-290Z-fad52924`); each passed in isolation (108/108 and 120/120). They were
not treated as environmental merely because they were intermittent.

### Trace analysis of the failed run

Timeline from the saved Playwright trace (monotonic ms): hydration completed and the
`Tool opened` event fired at ~202,091, the `uqr` chunk (`0oi2b4u9uwn1n.js`) was fetched
with status 200 at 202,090 (the mount preload), the page went network-idle at 202,696,
`fill` ran 202,697–202,780 (Generate became enabled), `click` ran 202,781–202,842, and the
`toBeVisible` expectation failed at 207,862. DOM snapshots after the click show no change
for the whole 5 s (no preview, no alert text).

Candidate causes:

| Candidate | Evidence | Verdict |
|---|---|---|
| Dynamic module import not completing | chunk fetched 200 at mount, ~700 ms before the click | ruled out |
| Stale generation-ticket invalidation | no remount or second input event in the trace; `ToolClientFrame` does not remount the tool | not supported |
| React render/state delay | hydration finished long before; state update on fill was applied (button enabled) | ruled out |
| Playwright assertion timing / contention | assertion waited the full 5 s with the page idle | not the cause |
| `canvas.toBlob()` callback delay | see below | implicated |

### Mechanism reproduced

Chromium schedules `canvas.toBlob()` encoding on browser idle periods (with start and
completion timeouts), so it is slow whenever the page's main thread has no idle time.
Measured in headless Chromium for a 512×512 PNG (idle page / continuous frame work):
`toBlob` 2 ms / ~1.06 s; `toDataURL` 2 ms in both; `OffscreenCanvas.convertToBlob`
~16 ms under load. In the real QR page (built app, a frame loop whose per-frame work leaves
no idle time) click-to-preview with `toBlob` was ~1.6 s (15 ms of work per frame, with and
without tracing) and ~1.9 s (30 ms of work), versus 56–150 ms with light or no load.
The failed run's trace-enabled, long-suite conditions produce exactly this kind of
main-thread pressure, and the preview in the earlier occurrence had appeared after the
5 s window. This is an implementation sensitivity (a user on a busy or slow page waits
seconds for the preview), not only a test artifact. The exact stall length in the failed
run could not be reconstructed from the trace, so the diagnosis is "mechanism proven and
reproduced in-app; failed-run duration inferred".

### Fix (smallest proven cause)

`QrCodeGeneratorTool.tsx` now encodes the PNG synchronously: `canvas.toDataURL("image/png")`
is decoded and wrapped in an `image/png` Blob; a non-PNG data URL, malformed base64 or an
exception gives the existing bounded `Could not prepare the QR code PNG.` error with no
download. After the module-load await the whole generation (raster, canvas, PNG, object
URL, telemetry) runs in one task, so the former asynchronous callback race no longer
exists. No product contract changed (same 512×512 PNG, `qr-code.png`, ECC M, 2048 bytes,
exact payload, revocation, identity-only telemetry). No timeout was raised, no sleep or
retry was added and no assertion was weakened.

Re-measured in the real page under the same loads after the fix: 56 ms, 140 ms, 327 ms,
227 ms and 454 ms for the five conditions (previously ~75, 142, 1670, 1616 and 1906 ms);
the remainder is the busy main thread itself, not Chromium's idle timeout.

Tests: the component suite was rewritten for the synchronous path (19 tests; asserts
`toDataURL` is used and `toBlob` is not, the Blob is `image/png` with the decoded bytes,
and bounded errors for a non-PNG result, malformed base64, a throwing encoder and a
missing 2D context); the module-load suite passes unchanged in intent (8 tests). A new
Playwright test asserts `HTMLCanvasElement.prototype.toBlob` is never called during
generation (deterministic, no timing threshold).

Follow-up (not changed here, outside the bounded QR correction):
`POST_v0.4_CANVAS_TOBLOB_LATENCY_REVIEW_RECOMMENDED`. The Image Resizer, Image
Compressor, JPG / PNG / WebP Converter and PDF to JPG / PNG tools also use
`canvas.toBlob` for their outputs and so share the idle-period latency sensitivity;
those encoders need `toBlob` for JPEG/WebP quality parameters, so any change belongs to
its own reviewed workflow.

## Security dispositions (preserved, no dependency change)

- 22. Vitest critical: dev/test-only; `vitest run` with the Node environment in both
  configs; no UI server or Browser Mode; absent from the standalone runtime —
  `ACCEPTED_SECURITY_DISPOSITION_DEV_ONLY` (Vitest not upgraded). `source-map-js` high:
  Tailwind/PostCSS build tooling, absent from the standalone runtime —
  `ACCEPTED_SECURITY_DISPOSITION_BUILD_ONLY` (not upgraded). Dashboard production audit: 0
  vulnerabilities. `uqr`/`jsqr`: not implicated. No `npm audit fix` was run.
- 23. `POST_v0.4_DEPENDENCY_MAINTENANCE_RECOMMENDED` (non-blocking, out of v0.4 scope):
  update Vitest to a patched compatible release, resolve the Tailwind/PostCSS
  `source-map-js` advisory path where feasible, and rerun full validation.

## 24–26. Validation (final code, local Windows)

- `npm run dev:check`: pass (exit 0).
- `npm run verify`: typecheck, lint (0 errors, 5 pre-existing warnings), tests, build
  passed; 1152 tests passed, 0 failed. RUN_ID `2026-10-07T19-22-26-240Z-f96ccbe2`.
- Focused QR E2E (3 repeats, 66 tests): passed, RUN_ID `2026-10-07T19-20-41-912Z-4ef6e0d1`.
- Full E2E: 352 passed, 0 failed, RUN_ID `2026-10-07T19-23-20-003Z-39123794`.
- Container: passed first run, CONTAINER_RUN_ID `2026-10-07T19-32-07-815Z-465a05fe`;
  in-container E2E 352 passed; healthy, clean shutdown, no SIGKILL, no OOM, cleanup pass.
- Dashboard verify: `dashboard-verify-2026-10-07T19-41-22-823Z-ff50115a`; observability
  database: `observability-db-2026-10-07T19-41-38-923Z-9595eb63`.
- Earlier validation on the pre-PNG-change code (unit 1145 + QR specs, container
  `2026-10-07T18-06-12-112Z-ae1b841f` with 350 in-container E2E passed, full E2E
  `2026-10-07T17-57-32-184Z-a265e45e` with the failure above) is preserved as evidence.

## 27–30. Candidate and state

- Candidate correction SHA, PR and CI results are recorded on the pull request.
- Package version remains `0.3.1`; no dependency version changed; release preparation
  and the new readiness run have not started.
- Exact next action: the planner reruns the full standardized v0.4.0 pre-release readiness
  workflow from scratch on the corrected master SHA.
