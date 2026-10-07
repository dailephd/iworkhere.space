# v0.4.0 Batch 3 Implementation Report — QR Code Generator

## Identity

- Date: 2026-10-07
- Starting master SHA: `d6cd802724bd6fbacc5ffc021cde4f49d52108c3`
- Branch: `feature/v0.4.0-batch-3-qr-code-generator` (started at the same SHA)
- Validated implementation commit: `8c279bb33902d1089cd490751215b639831edfcc` (this report is added in a later evidence commit; final PR head and CI results are recorded on the PR)
- Package application version: `0.3.1` (unchanged)

## Retrieval

- my-dev-kit `@dailephd/my-dev-kit` 1.12.5 (current published version).
- Fresh index over roots `src`, `test`, `script` (TypeScript, call graph):
  `.my-dev-kit-context/indexes/iworkhere-space-v0.4-batch3-20261007T091756`
  (244 files, 853 symbols; not committed).
- Searches: `QrCode`, `uqr`, `jsqr`, `TextEncoder`, `toBlob`, `createObjectURL`,
  `revokeObjectURL`, `LengthConverterTool`, `WeightConverterTool`,
  `ImageConverterTool`, `ToolComponentProp`, `tool_definition_list`, `guideById`,
  `getToolByCategory`, `getAvailableCategory`, `tool_executed`, `sitemap`,
  `containerSmoke`, `publicRoutes`. No QR implementation existed.
  Index search does not index property-access names such as `createObjectURL`;
  those were located with tracked-file grep instead.
- Bounded source reads: registry/guide/guide-test/registry-test/sitemap-test
  segments, `WordCharacterCounterTool`, `JsonFormatterTool`, and the
  `ImageConverterTool` object-URL and download idiom plus its test harness.
  No whole-file fallback was needed beyond the two small component files read as
  the nearest precedents.
- Orchestrator and lab were not used.

## Catalog-count audit

Literals changed (17→18 tools, 26→27 sitemap URLs): `src/app/sitemap.test.ts`,
`src/module/tool/registry.test.ts`, `script/containerSmoke.ts` (public route
inventory), and E2E specs `app-navigation` (counts, loop bound, test name, sorted
routes), `compress-pdf`, `document-family`, `image-compressor`,
`image-converter`, `images-to-pdf`, `json-formatter`, `pdf-page-copy` (also its
test name), `pdf-to-image`, `ui-discovery`, `word-character-counter`.
Unrelated numbers (PostgreSQL 17, 26 MiB fixtures, PNG bytes) were left alone.
Populated categories remain 7; text category 3; developer unchanged. No matches
in `.github`, `scripts`, `database`, `dashboard/src`.

## Dependencies

npm registry at implementation time:

- `uqr` 0.1.3: MIT, no dependencies, `git+https://github.com/unjs/uqr.git`,
  unpacked 79,278 bytes, last published 2026-04-03.
- `jsqr` 1.4.0: Apache-2.0, no dependencies, `git+https://github.com/cozmo/jsQR.git`.
- `qr` 0.7.2 (fallback): `(MIT OR Apache-2.0)`, no dependencies, 539,239 bytes.
  Not evaluated further: `uqr` satisfied every contract probe, so the fallback
  rule was not triggered.

Probe (isolated under `.my-dev-kit-workflow/probe-qr`, before touching root):
ESM, no native code, no server requirement, explicit `ecc`, `boostEcc` (default
false), `border: 0` removes the library border, `data` is a `boolean[][]`.
A plain `number[]` selects byte mode (a `Uint8Array` would not). Plain text, URL,
Unicode/emoji, exactly 2048 ASCII bytes and exactly 2048 multibyte bytes (version
38, 169 modules) all encoded at ECC M with boost off, format bits `00` (M), and
decoded exactly with `jsqr`.

Root install: `uqr` `0.1.3` in `dependencies`, `jsqr` `1.4.0` in
`devDependencies`, both exact (no carets). The lockfile diff is exactly those two
packages. No other dependency changed and `npm audit fix` was not run. Neither
package has transitive dependencies; no native or runtime binary was added.
`THIRD_PARTY_NOTICES.md` records both; the unmodified `uqr` MIT license is at
`public/licenses/uqr-0.1.3-LICENSE.txt` and is verified by the container smoke
(route and runtime path).

## Implementation

- `src/module/tool/everyday/qrCode.ts`: constants (2048 / 512 / M / 4), byte
  validation with `TextEncoder` before the encoder, matrix generation (UTF-8
  bytes, `ecc: "M"`, `boostEcc: false`, `border: 0`), and a pure RGBA raster
  (`moduleScale = floor(512 / (n + 8))`, centered, exact black/white, no
  anti-aliasing). No React/DOM/storage/telemetry/network.
- `QrCodeGeneratorTool.tsx`: textarea, Generate (disabled only when
  `input.length === 0`, never trimmed), preview (`img` from the PNG object URL),
  `Download PNG` (`qr-code.png`), Reset, `role="alert"` errors. A generation
  counter invalidates pending `canvas.toBlob` callbacks on edit, replacement,
  Reset and unmount; the URL is revoked on every one of those and a stale callback
  never creates a URL. `tool_executed` with `{ toolId, slug }` is emitted only after
  the current PNG URL exists.
- Registry entry and guide exactly as specified; related tools
  `length-converter`, `weight-converter` (heading `Related everyday tools`).
- Specs: `docs/modules/QrCode.md`, `docs/components/QrCodeGeneratorTool.md`,
  `docs/doc_index.md`; `docs/TESTING.md` gained a short QR validation note.

## Proof

- ECC: test-only format-information reader checks both format copies, the BCH
  codeword and the level bits; controls show it distinguishes L/M/Q/H and that a
  boosted encode no longer reads as M.
- Raster: 512×512, integer scale, only exact black/white opaque pixels, quiet zone
  at least 4 modules, centered, module sampling equals the matrix (checked for
  sizes 21 to 177).
- Independent decode: `jsqr` decodes project-rendered RGBA for plain text, URL,
  Unicode/emoji, leading/trailing spaces, 2048 ASCII and 2048 multibyte payloads.
- Boundary: 2048 accepted, 2049 rejected before the encoder, multibyte measured in
  bytes; a unit test asserts `jsqr` is not imported from production `src/`.
- Real PNG (Playwright, desktop and mobile): downloaded file named `qr-code.png`;
  signature `89 50 4E 47 0D 0A 1A 0A`; first chunk `IHDR`; width 512 and height 512;
  the PNG is redrawn in the browser and decoded by Node-side `jsqr` to the exact
  payload for plain text, URL and Unicode/emoji.
- Privacy: no request carries the payload, no non-GET request, no query/hash,
  no storage; telemetry is identity-only.
- Offline: the encoder is bundled locally; no existing warmed-offline tool
  precedent was reused, so no new offline test subsystem was added.

## Final counts

Tools 18, populated categories 7, sitemap URLs 27. `/category/everyday` lists
Length Converter, Weight Converter, QR Code Generator. Discover query `qr` finds
only the QR Code Generator. Container public route inventory 27.

## Local validation

- Typecheck: pass. Lint: 0 errors (5 pre-existing warnings in unrelated files).
- Unit tests: 81 files, 1140 tests passed. RUN_ID
  `2026-10-07T14-26-35-737Z-a169e612`, `test-report/2026-10-07T14-26-35-737Z-a169e612`.
- Build: pass.
- Focused E2E (`qr-code-generator`, `app-navigation`): 34 passed.
  RUN_ID `2026-10-07T14-27-48-536Z-746ce5c4`.
- Full E2E: 348 passed. RUN_ID `2026-10-07T14-29-05-179Z-30df347c`.
- Container: `docker:ready` then `test:container` passed on the first run, no rerun.
  CONTAINER_RUN_ID `2026-10-07T14-37-16-767Z-52ccfc22`
  (`test-report/container/2026-10-07T14-37-16-767Z-52ccfc22`): route inventory 27,
  `/tool/qr-code-generator` and the `uqr` license 200, in-container E2E 348 passed,
  healthy, clean shutdown without SIGKILL, no OOM.
- One transient during development: two component tests timed out under parallel
  load because of a 1,048,576-element `toEqual`; replaced with a byte comparison.

## CI

Recorded on the pull request (not in this file).

## Exclusions preserved

No other utility, QR modes, colors, sizes, SVG, bulk, URL fetching, persistence,
query state, server generation, category or Home/Discover change, shared
sharing/canvas/download framework, ROADMAP log, version bump, release branch, tag
or deployment. Package version remains 0.3.1.
